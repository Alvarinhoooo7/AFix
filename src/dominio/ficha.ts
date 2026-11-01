import type { ficha } from '@/db/esquema'
import type { Checklist } from '@/dominio/checklist'

type Ficha = typeof ficha.$inferSelect

export type EstadoFicha = 'recibido' | 'en_reparacion' | 'listo' | 'entregado' | 'entregado_sin_reparar'
export type EstadoCierre = 'entregado' | 'entregado_sin_reparar'

/** Los estados de una ficha que sigue en el taller. */
export const ESTADOS_ABIERTOS: readonly EstadoFicha[] = ['recibido', 'en_reparacion', 'listo']
export const ESTADOS_CERRADOS: readonly EstadoFicha[] = ['entregado', 'entregado_sin_reparar']

export const ETIQUETA_ESTADO: Record<EstadoFicha, string> = {
  recibido: 'Recibido',
  en_reparacion: 'En reparación',
  listo: 'Listo para entregar',
  entregado: 'Entregado',
  entregado_sin_reparar: 'Entregado sin reparar',
}

export const TRABAJOS: readonly string[] = [
  'Batería',
  'Pantalla',
  'Parlante',
  'Auricular',
  'Cámara trasera',
  'Cámara frontal',
  'Puerto de carga',
  'Vibrador',
  'Botones',
  'Vidrio trasero',
  'Placa',
] as const

export const ACCESORIOS: readonly string[] = [
  'Funda',
  'Mica / protector',
  'Chip SIM',
  'Bandeja SIM',
  'Cargador',
  'Cable',
  'Caja',
] as const

/** Un accesorio recibido: uno de la lista o "Otro" con su detalle. */
export type Accesorio = { nombre: string; detalle?: string }

export type CalidadPieza = 'original' | 'compatible'
export type PiezaCambiada = { trabajo: string; pieza: string; calidad: CalidadPieza }

/** Lo que dejó la vigilancia en vivo de la salida (plan §3.7). */
export type ResultadoVigilancia = { minutos: number; fallas: number; desconexiones: number; terminadaEn: string }

export type DatosIngreso = {
  imei: string | null
  numeroSerie: string | null
  modeloProducto: string | null
  modeloComercial: string
  capacidad: string | null
  iosVersion: string | null
  bateriaPct: number | null
  bateriaCiclos: number | null
  pidioCliente: string
  quienLoTrajo: string | null
  telefono: string | null
  observacionIngreso: string
  checklistIngreso: Checklist
  catalogoVersion: number
  origenDatos: 'usb' | 'manual' | 'mixto'
}

export function estaAbierta(estado: EstadoFicha): boolean {
  return ESTADOS_ABIERTOS.includes(estado)
}

/**
 * El camino del taller: recibido -> en reparación -> listo, con vuelta de listo a
 * reparación si falla la prueba de salida. Se cierra desde cualquier estado abierto
 * (un equipo se puede entregar sin reparar en cualquier momento) y una ficha cerrada no
 * vuelve a abrirse.
 */
export function transicionPermitida(desde: EstadoFicha, hacia: EstadoFicha): boolean {
  if (!estaAbierta(desde) || desde === hacia) return false
  if (ESTADOS_CERRADOS.includes(hacia)) return true
  if (desde === 'recibido') return hacia === 'en_reparacion' || hacia === 'listo'
  if (desde === 'en_reparacion') return hacia === 'listo' || hacia === 'recibido'
  return hacia === 'en_reparacion'
}

export function estaCongelada(f: Pick<Ficha, 'congeladaEn'>): boolean {
  return f.congeladaEn !== null
}

/** "Garantía hasta el 1 de febrero de 2027": meses calendario desde la entrega. */
export function vencimientoGarantia(entregadoEn: Date, meses: number): Date {
  const fecha = new Date(entregadoEn)
  const dia = fecha.getDate()
  fecha.setMonth(fecha.getMonth() + meses)
  // 31 de enero + 1 mes no es 3 de marzo: se queda en el último día del mes.
  if (fecha.getDate() !== dia) fecha.setDate(0)
  return fecha
}
