import { and, asc, desc, eq, gte, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { catalogoActivo } from '@/datos/catalogo'
import type { Ficha } from '@/datos/equipos'
import { obtenerDb, type DrizzleDb } from '@/db/cliente'
import { equipo, ficha, notaPosterior, registroEquipo } from '@/db/esquema'
import { limpiarChecklist } from '@/dominio/checklist'
import { normalizarImei } from '@/dominio/equipo'
import {
  ESTADOS_ABIERTOS,
  ESTADOS_CERRADOS,
  transicionPermitida,
  type Accesorio,
  type DatosIngreso,
  type EstadoCierre,
  type EstadoFicha,
  type ResultadoVigilancia,
} from '@/dominio/ficha'
import type { EventoEstabilidad, Lectura } from '@/dominio/lectura'

export type NotaPosterior = typeof notaPosterior.$inferSelect
export type FichaConNotas = Ficha & { notasPosteriores: NotaPosterior[] }

export type FilaInicio = {
  numero: number
  estado: EstadoFicha
  modeloComercial: string
  imei: string | null
  quienLoTrajo: string | null
  recibidoEn: Date
  entregadoEn: Date | null
  trabajos: string[]
}

/** Identificadores extra que entrega el USB; con ellos se reconoce un equipo sin IMEI. */
export type IdentidadExtra = {
  imei2?: string | null
  udid?: string | null
  ecid?: string | null
  numeroModelo?: string | null
  region?: string | null
  color?: string | null
}

/**
 * Datos de ingreso; sin catalogoVersion se usa la versión del catálogo en vigor. Lo del
 * rediseño (lectura USB, accesorios, código, cláusulas) es opcional: un ingreso manual
 * sigue siendo válido sin nada de eso.
 */
export type EntradaIngreso = Omit<DatosIngreso, 'catalogoVersion'> & {
  catalogoVersion?: number
  identidad?: IdentidadExtra
  lectura?: Lectura | null
  accesorios?: Accesorio[]
  codigoEntregado?: boolean | null
  clausulasVersion?: number | null
  garantiaMeses?: number | null
}

export type ResultadoIngreso =
  | { ok: true; ficha: Ficha }
  | { ok: false; mensaje: string; datos: EntradaIngreso & { catalogoVersion: number } }

/** Campos que solo cambian por cerrarFicha o por la base: actualizarFicha no los toca. */
const CAMPOS_RESERVADOS = ['numero', 'equipoId', 'estado', 'entregadoEn', 'congeladaEn'] as const

const errorInexistente = (numero: number) => new Error(`La ficha ${numero} no existe.`)
const errorCongelada = (numero: number) =>
  new Error(`La ficha ${numero} está congelada: ya fue entregada y no se puede editar. Agrega una nota posterior.`)

/**
 * El equipo que ya pasó por el taller, por el identificador más fuerte que haya: IMEI,
 * número de serie, UDID o ECID (un iPad Wi-Fi no tiene IMEI y un equipo en recuperación
 * solo da ECID y serie).
 */
async function equipoExistente(
  tx: Pick<DrizzleDb, 'select'>,
  ids: { imei: string | null; numeroSerie: string | null; udid: string | null; ecid: string | null },
): Promise<string | undefined> {
  const condiciones: SQL[] = []
  if (ids.imei) condiciones.push(eq(equipo.imei, ids.imei))
  if (ids.numeroSerie) condiciones.push(sql`upper(${equipo.numeroSerie}) = ${ids.numeroSerie.toUpperCase()}`)
  if (ids.udid) condiciones.push(eq(equipo.udid, ids.udid))
  if (ids.ecid) condiciones.push(eq(equipo.ecid, ids.ecid))
  if (condiciones.length === 0) return undefined
  // El IMEI manda: si hay varios candidatos, gana el que coincide por IMEI.
  const filas = await tx.select({ id: equipo.id, imei: equipo.imei }).from(equipo).where(or(...condiciones))
  return (filas.find((f) => ids.imei && f.imei === ids.imei) ?? filas[0])?.id
}

/** Filas de registro_equipo a partir de los eventos de una lectura. */
function filasRegistro(numero: number, momento: 'ingreso' | 'salida' | 'vigilancia', eventos: EventoEstabilidad[]) {
  return eventos.map((e) => ({
    fichaNumero: numero,
    momento,
    tipo: e.tipo,
    fechaEvento: e.fecha ? new Date(e.fecha) : null,
    nombreOriginal: e.nombre,
    resumen: e.resumen,
    texto: e.texto,
    causaProbable: e.causaProbable,
    lineaChecklist: e.lineaChecklist,
    sha256: e.sha256,
  }))
}

export async function crearFicha(datos: EntradaIngreso, db: DrizzleDb = obtenerDb()): Promise<Ficha> {
  const catalogoVersion = datos.catalogoVersion ?? (await catalogoActivo(db)).version
  // Quien escribe normaliza: un IMEI mal formado se guarda como null, nunca como identidad.
  const imei = datos.imei === null ? null : normalizarImei(datos.imei)
  const extra = datos.identidad ?? {}
  const identidad = {
    imei2: extra.imei2 ? normalizarImei(extra.imei2) : null,
    udid: extra.udid ?? null,
    ecid: extra.ecid ?? null,
    numeroModelo: extra.numeroModelo ?? null,
    region: extra.region ?? null,
    color: extra.color ?? null,
  }

  return db.transaction(async (tx) => {
    let equipoId = await equipoExistente(tx, {
      imei,
      numeroSerie: datos.numeroSerie,
      udid: identidad.udid,
      ecid: identidad.ecid,
    })
    if (equipoId) {
      // Completa lo que el equipo conocido no tenía; nunca pisa un dato ya guardado.
      const [actual] = await tx.select().from(equipo).where(eq(equipo.id, equipoId))
      const candidatos = {
        imei,
        numeroSerie: datos.numeroSerie,
        modeloProducto: datos.modeloProducto,
        modeloComercial: datos.modeloComercial || null,
        capacidad: datos.capacidad,
        ...identidad,
      }
      const completar: Partial<Record<keyof typeof candidatos, string>> = {}
      for (const campo of Object.keys(candidatos) as (keyof typeof candidatos)[]) {
        const valor = candidatos[campo]
        if (valor && actual[campo] == null) completar[campo] = valor
      }
      if (Object.keys(completar).length > 0) await tx.update(equipo).set(completar).where(eq(equipo.id, equipoId))
    } else {
      const [nuevo] = await tx
        .insert(equipo)
        .values({
          imei,
          numeroSerie: datos.numeroSerie,
          modeloProducto: datos.modeloProducto,
          modeloComercial: datos.modeloComercial || null,
          capacidad: datos.capacidad,
          ...identidad,
        })
        .returning({ id: equipo.id })
      equipoId = nuevo.id
    }
    const [creada] = await tx
      .insert(ficha)
      .values({
        equipoId,
        iosVersion: datos.iosVersion,
        build: datos.lectura?.sistema.build ?? null,
        bateriaPct: datos.bateriaPct,
        bateriaCiclos: datos.bateriaCiclos,
        codigoProtegido: datos.lectura?.seguridad.codigoConfigurado ?? null,
        estadoActivacion: datos.lectura?.seguridad.activacion ?? null,
        pidioCliente: datos.pidioCliente,
        quienLoTrajo: datos.quienLoTrajo,
        telefono: datos.telefono,
        observacionIngreso: datos.observacionIngreso,
        checklistIngreso: limpiarChecklist(datos.checklistIngreso),
        catalogoVersion,
        origenDatos: datos.origenDatos,
        lecturaIngreso: datos.lectura ?? null,
        accesorios: datos.accesorios ?? [],
        codigoEntregado: datos.codigoEntregado ?? null,
        clausulasVersion: datos.clausulasVersion ?? null,
        garantiaMeses: datos.garantiaMeses ?? null,
      })
      .returning()
    const eventos = datos.lectura?.estabilidad?.eventos ?? []
    if (eventos.length > 0) await tx.insert(registroEquipo).values(filasRegistro(creada.numero, 'ingreso', eventos))
    return creada
  })
}

/**
 * Intenta persistir un ingreso sin propagar excepciones hacia la interfaz.
 * Si la base de datos no responde, devuelve el mensaje en español junto con los datos
 * originales para que el formulario conserve todo lo que el técnico ya escribió.
 */
export async function intentarGuardarIngreso(
  datos: EntradaIngreso & { catalogoVersion: number },
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

/**
 * Mueve una ficha abierta por el camino del taller (recibido, en reparación, listo) y
 * anota cuándo. Cerrar es cerrarFicha: sella la ficha además de cambiar el estado.
 */
export async function cambiarEstado(numero: number, hacia: 'recibido' | 'en_reparacion' | 'listo'): Promise<Ficha> {
  const actual = await obtenerFicha(numero)
  if (!actual) throw errorInexistente(numero)
  if (actual.congeladaEn !== null) throw errorCongelada(numero)
  if (!transicionPermitida(actual.estado, hacia)) {
    throw new Error(`La ficha ${numero} no puede pasar de "${actual.estado}" a "${hacia}".`)
  }
  const ahora = new Date()
  const marcas = hacia === 'en_reparacion' ? { enReparacionEn: ahora } : hacia === 'listo' ? { listoEn: ahora } : {}
  const [cambiada] = await obtenerDb()
    .update(ficha)
    .set({ estado: hacia, ...marcas })
    .where(and(eq(ficha.numero, numero), eq(ficha.estado, actual.estado), isNull(ficha.congeladaEn)))
    .returning()
  if (!cambiada) throw new Error(`La ficha ${numero} cambió mientras se editaba; vuelve a abrirla.`)
  return cambiada
}

/** Sella la ficha: fija el estado final y escribe entregado_en y congelada_en con la misma hora. */
export async function cerrarFicha(numero: number, estado: EstadoCierre): Promise<Ficha> {
  if (!ESTADOS_CERRADOS.includes(estado)) throw new Error(`Estado de cierre no válido: ${estado}.`)
  const ahora = new Date()
  const [cerrada] = await obtenerDb()
    .update(ficha)
    .set({ estado, entregadoEn: ahora, congeladaEn: ahora })
    .where(and(eq(ficha.numero, numero), inArray(ficha.estado, [...ESTADOS_ABIERTOS]), isNull(ficha.congeladaEn)))
    .returning()
  if (!cerrada) throw await explicarRechazo(numero)
  return cerrada
}

/**
 * Guarda la lectura USB de salida y llena la batería de salida desde ella. Los registros
 * que no estaban en el ingreso quedan como registros de salida.
 */
export async function guardarLecturaSalida(numero: number, lectura: Lectura): Promise<Ficha> {
  const actualizada = await actualizarFicha(numero, {
    lecturaSalida: lectura,
    bateriaSalidaPct: lectura.bateria?.saludPct ?? null,
    bateriaSalidaCiclos: lectura.bateria?.ciclos ?? null,
  })
  await guardarRegistrosNuevos(numero, 'salida', lectura.estabilidad?.eventos ?? [])
  return actualizada
}

/** El resultado de la vigilancia en vivo y las fallas que aparecieron durante ella. */
export async function guardarVigilancia(
  numero: number,
  resultado: ResultadoVigilancia,
  eventos: EventoEstabilidad[],
): Promise<Ficha> {
  const actualizada = await actualizarFicha(numero, { vigilanciaSalida: resultado })
  await guardarRegistrosNuevos(numero, 'vigilancia', eventos)
  return actualizada
}

async function guardarRegistrosNuevos(
  numero: number,
  momento: 'salida' | 'vigilancia',
  eventos: EventoEstabilidad[],
): Promise<void> {
  if (eventos.length === 0) return
  const db = obtenerDb()
  const guardados = await db
    .select({ nombre: registroEquipo.nombreOriginal })
    .from(registroEquipo)
    .where(eq(registroEquipo.fichaNumero, numero))
  const yaGuardados = new Set(guardados.map((r) => r.nombre))
  const nuevos = eventos.filter((e) => !yaGuardados.has(e.nombre))
  if (nuevos.length > 0) {
    await db.insert(registroEquipo).values(filasRegistro(numero, momento, nuevos)).onConflictDoNothing()
  }
}

export type RegistroEquipo = typeof registroEquipo.$inferSelect

export async function registrosDeFicha(numero: number): Promise<RegistroEquipo[]> {
  return obtenerDb()
    .select()
    .from(registroEquipo)
    .where(eq(registroEquipo.fichaNumero, numero))
    .orderBy(desc(registroEquipo.fechaEvento), asc(registroEquipo.id))
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

type FilaCrudaInicio = {
  numero: number
  estado: EstadoFicha
  modeloComercial: string | null
  imei: string | null
  quienLoTrajo: string | null
  recibidoEn: Date
  entregadoEn: Date | null
  trabajosRealizados: string[]
}

function mapearFilaInicio(f: FilaCrudaInicio): FilaInicio {
  return {
    numero: f.numero,
    estado: f.estado,
    modeloComercial: f.modeloComercial ?? 'Sin modelo',
    imei: f.imei,
    quienLoTrajo: f.quienLoTrajo,
    recibidoEn: f.recibidoEn,
    entregadoEn: f.entregadoEn,
    trabajos: Array.isArray(f.trabajosRealizados) ? f.trabajosRealizados : [],
  }
}

/** Las fichas abiertas: recibidas, en reparación o listas para entregar. */
export async function equiposEnTaller(): Promise<FilaInicio[]> {
  const filas = await obtenerDb()
    .select({
      numero: ficha.numero,
      estado: ficha.estado,
      modeloComercial: equipo.modeloComercial,
      imei: equipo.imei,
      quienLoTrajo: ficha.quienLoTrajo,
      recibidoEn: ficha.recibidoEn,
      entregadoEn: ficha.entregadoEn,
      trabajosRealizados: ficha.trabajosRealizados,
    })
    .from(ficha)
    .innerJoin(equipo, eq(ficha.equipoId, equipo.id))
    .where(inArray(ficha.estado, [...ESTADOS_ABIERTOS]))
    .orderBy(desc(ficha.recibidoEn), desc(ficha.numero))
  return filas.map(mapearFilaInicio)
}

export async function ultimasEntregadas(limite: number): Promise<FilaInicio[]> {
  if (limite <= 0) return []
  const filas = await obtenerDb()
    .select({
      numero: ficha.numero,
      estado: ficha.estado,
      modeloComercial: equipo.modeloComercial,
      imei: equipo.imei,
      quienLoTrajo: ficha.quienLoTrajo,
      recibidoEn: ficha.recibidoEn,
      entregadoEn: ficha.entregadoEn,
      trabajosRealizados: ficha.trabajosRealizados,
    })
    .from(ficha)
    .innerJoin(equipo, eq(ficha.equipoId, equipo.id))
    .where(inArray(ficha.estado, [...ESTADOS_CERRADOS]))
    .orderBy(desc(ficha.entregadoEn), desc(ficha.numero))
    .limit(limite)
  return filas.map(mapearFilaInicio)
}

/** El historial completo, de la ficha más nueva a la más vieja; con `estados`, solo los de esos estados. */
export async function listarFichas(estados: readonly EstadoFicha[] | null, limite: number): Promise<FilaInicio[]> {
  if (limite <= 0 || estados?.length === 0) return []
  const filas = await obtenerDb()
    .select({
      numero: ficha.numero,
      estado: ficha.estado,
      modeloComercial: equipo.modeloComercial,
      imei: equipo.imei,
      quienLoTrajo: ficha.quienLoTrajo,
      recibidoEn: ficha.recibidoEn,
      entregadoEn: ficha.entregadoEn,
      trabajosRealizados: ficha.trabajosRealizados,
    })
    .from(ficha)
    .innerJoin(equipo, eq(ficha.equipoId, equipo.id))
    .where(estados ? inArray(ficha.estado, [...estados]) : undefined)
    .orderBy(desc(ficha.numero))
    .limit(limite)
  return filas.map(mapearFilaInicio)
}

/** Cuántas fichas se cerraron (con o sin reparación) desde la fecha dada. */
export async function contarEntregadasDesde(desde: Date): Promise<number> {
  const [fila] = await obtenerDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(ficha)
    .where(and(inArray(ficha.estado, [...ESTADOS_CERRADOS]), gte(ficha.entregadoEn, desde)))
  return fila?.total ?? 0
}

function sinAcentosMinusculas(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export async function buscar(texto: string): Promise<FilaInicio[]> {
  const limpio = texto.trim()
  if (!limpio) return []

  const terminoNormalizado = sinAcentosMinusculas(limpio)
  const patron = `%${terminoNormalizado}%`
  const soloDigitos = limpio.replace(/^#/, '').trim()
  const numeroBuscado = /^\d{1,9}$/.test(soloDigitos) ? Number.parseInt(soloDigitos, 10) : null
  const imeiCandidato = normalizarImei(limpio)
  const patronImei = `%${imeiCandidato ?? terminoNormalizado}%`
  // Un teléfono se busca solo por sus dígitos: "+56 9 1234 5678" encuentra "912345678".
  const digitos = limpio.replace(/[^0-9]/g, '')
  const soloTelefono = digitos.length >= 6 && /^[0-9\s+()-]+$/.test(limpio) ? digitos.replace(/^56/, '') : null

  const condicion = sql`(
    ${numeroBuscado !== null ? sql`${ficha.numero} = ${numeroBuscado} or` : sql``}
    lower(coalesce(${equipo.imei}, '')) like ${patronImei}
    or lower(coalesce(${equipo.numeroSerie}, '')) like ${patron}
    or translate(lower(coalesce(${equipo.modeloComercial}, '')), 'áéíóúüñ', 'aeiouun') like ${patron}
    or translate(lower(coalesce(${ficha.quienLoTrajo}, '')), 'áéíóúüñ', 'aeiouun') like ${patron}
    ${soloTelefono ? sql`or regexp_replace(coalesce(${ficha.telefono}, ''), '[^0-9]', '', 'g') like ${`%${soloTelefono}%`}` : sql``}
  )`

  const ordenPrioridad =
    numeroBuscado !== null ? sql`case when ${ficha.numero} = ${numeroBuscado} then 0 else 1 end` : sql`1`

  const filas = await obtenerDb()
    .select({
      numero: ficha.numero,
      estado: ficha.estado,
      modeloComercial: equipo.modeloComercial,
      imei: equipo.imei,
      quienLoTrajo: ficha.quienLoTrajo,
      recibidoEn: ficha.recibidoEn,
      entregadoEn: ficha.entregadoEn,
      trabajosRealizados: ficha.trabajosRealizados,
    })
    .from(ficha)
    .innerJoin(equipo, eq(ficha.equipoId, equipo.id))
    .where(condicion)
    .orderBy(ordenPrioridad, desc(ficha.numero))

  return filas.map(mapearFilaInicio)
}
