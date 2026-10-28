import { and, eq } from 'drizzle-orm'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha } from '@/db/esquema'
import { normalizarImei } from '@/dominio/equipo'

export type Equipo = typeof equipo.$inferSelect
export type Ficha = typeof ficha.$inferSelect

const CAMPOS_IDENTIDAD = [
  'imei',
  'imei2',
  'numeroSerie',
  'ecid',
  'modeloProducto',
  'modeloComercial',
  'capacidad',
  'color',
] as const

/** Un IMEI ausente o inválido nunca coincide con nada: no se busca por NULL. */
export async function buscarPorImei(imei: string): Promise<Equipo | null> {
  const normalizado = normalizarImei(imei)
  if (!normalizado) return null
  const [fila] = await obtenerDb().select().from(equipo).where(eq(equipo.imei, normalizado))
  return fila ?? null
}

/**
 * Entrada lista para decidirVinculacion: el equipo con ese IMEI y si tiene una ficha
 * abierta (estado 'en_taller'). Hermana de buscarPorImei para no cambiar su firma.
 */
export async function buscarVinculablePorImei(
  imei: string,
): Promise<{ id: string; tieneFichaAbierta: boolean } | null> {
  const encontrado = await buscarPorImei(imei)
  if (!encontrado) return null
  const abiertas = await obtenerDb()
    .select({ numero: ficha.numero })
    .from(ficha)
    .where(and(eq(ficha.equipoId, encontrado.id), eq(ficha.estado, 'en_taller')))
    .limit(1)
  return { id: encontrado.id, tieneFichaAbierta: abiertas.length > 0 }
}

export async function obtenerEquipo(id: string): Promise<Equipo | null> {
  const [fila] = await obtenerDb().select().from(equipo).where(eq(equipo.id, id))
  return fila ?? null
}

export async function fichasDeEquipo(equipoId: string): Promise<Ficha[]> {
  return obtenerDb().select().from(ficha).where(eq(ficha.equipoId, equipoId)).orderBy(ficha.numero)
}

/**
 * Pasa las fichas del origen al destino, completa en el destino los datos de identidad
 * que le falten con los del origen y borra el origen. Todo en una transacción.
 */
export async function fusionarEquipos(origenId: string, destinoId: string): Promise<void> {
  if (origenId === destinoId) throw new Error('No se puede fusionar un equipo consigo mismo.')
  await obtenerDb().transaction(async (tx) => {
    const [origen] = await tx.select().from(equipo).where(eq(equipo.id, origenId))
    const [destino] = await tx.select().from(equipo).where(eq(equipo.id, destinoId))
    if (!origen) throw new Error('El equipo de origen no existe.')
    if (!destino) throw new Error('El equipo de destino no existe.')

    if (origen.imei && destino.imei && origen.imei !== destino.imei) {
      throw new Error('No se pueden fusionar dos equipos con IMEI distintos: son teléfonos diferentes.')
    }

    const heredado: Partial<Record<(typeof CAMPOS_IDENTIDAD)[number], string>> = {}
    for (const campo of CAMPOS_IDENTIDAD) {
      if (destino[campo] == null && origen[campo] != null) heredado[campo] = origen[campo]
    }

    await tx.update(ficha).set({ equipoId: destinoId }).where(eq(ficha.equipoId, origenId))
    // El origen se borra antes de copiar su IMEI: el índice único no admite dos filas con él.
    await tx.delete(equipo).where(eq(equipo.id, origenId))
    if (Object.keys(heredado).length > 0) {
      await tx.update(equipo).set(heredado).where(eq(equipo.id, destinoId))
    }
  })
}
