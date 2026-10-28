import { and, asc, eq, isNull } from 'drizzle-orm'
import { catalogoActivo } from '@/datos/catalogo'
import type { Ficha } from '@/datos/equipos'
import { obtenerDb, type DrizzleDb } from '@/db/cliente'
import { equipo, ficha, notaPosterior } from '@/db/esquema'
import { limpiarChecklist } from '@/dominio/checklist'
import { normalizarImei } from '@/dominio/equipo'
import { transicionPermitida, type DatosIngreso } from '@/dominio/ficha'

export type NotaPosterior = typeof notaPosterior.$inferSelect
export type FichaConNotas = Ficha & { notasPosteriores: NotaPosterior[] }

/** Datos de ingreso; sin catalogoVersion se usa la versión del catálogo en vigor. */
export type EntradaIngreso = Omit<DatosIngreso, 'catalogoVersion'> & { catalogoVersion?: number }

export type ResultadoIngreso =
  | { ok: true; ficha: Ficha }
  | { ok: false; mensaje: string; datos: DatosIngreso }

/** Campos que solo cambian por cerrarFicha o por la base: actualizarFicha no los toca. */
const CAMPOS_RESERVADOS = ['numero', 'equipoId', 'estado', 'entregadoEn', 'congeladaEn'] as const

const errorInexistente = (numero: number) => new Error(`La ficha ${numero} no existe.`)
const errorCongelada = (numero: number) =>
  new Error(`La ficha ${numero} está congelada: ya fue entregada y no se puede editar. Agrega una nota posterior.`)

export async function crearFicha(datos: EntradaIngreso, db: DrizzleDb = obtenerDb()): Promise<Ficha> {
  const catalogoVersion = datos.catalogoVersion ?? (await catalogoActivo(db)).version
  // Quien escribe normaliza: un IMEI mal formado se guarda como null, nunca como identidad.
  const imei = datos.imei === null ? null : normalizarImei(datos.imei)

  return db.transaction(async (tx) => {
    let equipoId: string | undefined
    if (imei) {
      const [existente] = await tx.select({ id: equipo.id }).from(equipo).where(eq(equipo.imei, imei))
      equipoId = existente?.id
    }
    if (!equipoId) {
      const [nuevo] = await tx
        .insert(equipo)
        .values({
          imei,
          numeroSerie: datos.numeroSerie,
          modeloProducto: datos.modeloProducto,
          modeloComercial: datos.modeloComercial || null,
          capacidad: datos.capacidad,
        })
        .returning({ id: equipo.id })
      equipoId = nuevo.id
    }
    const [creada] = await tx
      .insert(ficha)
      .values({
        equipoId,
        iosVersion: datos.iosVersion,
        bateriaPct: datos.bateriaPct,
        bateriaCiclos: datos.bateriaCiclos,
        pidioCliente: datos.pidioCliente,
        quienLoTrajo: datos.quienLoTrajo,
        telefono: datos.telefono,
        observacionIngreso: datos.observacionIngreso,
        checklistIngreso: limpiarChecklist(datos.checklistIngreso),
        catalogoVersion,
        origenDatos: datos.origenDatos,
      })
      .returning()
    return creada
  })
}

/**
 * Intenta persistir un ingreso sin propagar excepciones hacia la interfaz.
 * Si la base de datos no responde, devuelve el mensaje en español junto con los datos
 * originales para que el formulario conserve todo lo que el técnico ya escribió.
 */
export async function intentarGuardarIngreso(
  datos: DatosIngreso,
  deps: { db: DrizzleDb } = { db: obtenerDb() },
): Promise<ResultadoIngreso> {
  try {
    const creada = await crearFicha(datos, deps.db)
    return { ok: true, ficha: creada }
  } catch {
    return {
      ok: false,
      mensaje: 'No se pudo guardar el ingreso. Revisa la conexión con la base de datos y vuelve a intentar.',
      datos,
    }
  }
}

export async function obtenerFicha(numero: number): Promise<FichaConNotas | null> {
  const db = obtenerDb()
  const [fila] = await db.select().from(ficha).where(eq(ficha.numero, numero))
  if (!fila) return null
  const notasPosteriores = await db
    .select()
    .from(notaPosterior)
    .where(eq(notaPosterior.fichaNumero, numero))
    .orderBy(asc(notaPosterior.creadaEn), asc(notaPosterior.id))
  return { ...fila, notasPosteriores }
}

/** Distingue "no existe" de "congelada" cuando un UPDATE condicionado no tocó ninguna fila. */
async function explicarRechazo(numero: number): Promise<Error> {
  const [fila] = await obtenerDb().select({ numero: ficha.numero }).from(ficha).where(eq(ficha.numero, numero))
  return fila ? errorCongelada(numero) : errorInexistente(numero)
}

/**
 * Edita una ficha en taller. La guarda vive en el propio UPDATE (congelada_en is null),
 * así que no hay ventana entre revisar y escribir: una ficha cerrada nunca se modifica.
 */
export async function actualizarFicha(numero: number, cambios: Partial<Ficha>): Promise<Ficha> {
  const reservado = CAMPOS_RESERVADOS.find((c) => c in cambios)
  if (reservado) {
    throw new Error(`El campo "${reservado}" no se edita con actualizarFicha; para cerrar la ficha usa cerrarFicha.`)
  }
  const cambiosLimpios: Partial<Ficha> = { ...cambios }
  if (cambiosLimpios.checklistIngreso) {
    cambiosLimpios.checklistIngreso = limpiarChecklist(cambiosLimpios.checklistIngreso)
  }
  if (cambiosLimpios.checklistSalida) {
    cambiosLimpios.checklistSalida = limpiarChecklist(cambiosLimpios.checklistSalida)
  }
  if (Object.keys(cambiosLimpios).length === 0) {
    const actual = await obtenerFicha(numero)
    if (!actual) throw errorInexistente(numero)
    if (actual.congeladaEn !== null) throw errorCongelada(numero)
    return actual
  }
  const [actualizada] = await obtenerDb()
    .update(ficha)
    .set(cambiosLimpios)
    .where(and(eq(ficha.numero, numero), isNull(ficha.congeladaEn)))
    .returning()
  if (!actualizada) throw await explicarRechazo(numero)
  return actualizada
}

/** Sella la ficha: fija el estado final y escribe entregado_en y congelada_en con la misma hora. */
export async function cerrarFicha(numero: number, estado: 'entregado' | 'entregado_sin_reparar'): Promise<Ficha> {
  if (!transicionPermitida('en_taller', estado)) throw new Error(`Estado de cierre no válido: ${estado}.`)
  const ahora = new Date()
  const [cerrada] = await obtenerDb()
    .update(ficha)
    .set({ estado, entregadoEn: ahora, congeladaEn: ahora })
    .where(and(eq(ficha.numero, numero), eq(ficha.estado, 'en_taller'), isNull(ficha.congeladaEn)))
    .returning()
  if (!cerrada) throw await explicarRechazo(numero)
  return cerrada
}

/** Única forma de agregar algo a una ficha cerrada. Solo inserta: nunca toca la ficha. */
export async function agregarNotaPosterior(numero: number, texto: string): Promise<void> {
  const limpio = texto.trim()
  if (!limpio) throw new Error('La nota no puede estar vacía.')
  const [fila] = await obtenerDb().select({ congeladaEn: ficha.congeladaEn }).from(ficha).where(eq(ficha.numero, numero))
  if (!fila) throw errorInexistente(numero)
  if (fila.congeladaEn === null) {
    throw new Error(
      `La ficha ${numero} sigue en taller: edítala directamente; las notas posteriores son para fichas cerradas.`,
    )
  }
  await obtenerDb().insert(notaPosterior).values({ fichaNumero: numero, texto: limpio })
}
