import type { ficha } from '@/db/esquema'
import type { Checklist } from '@/dominio/checklist'

type Ficha = typeof ficha.$inferSelect

export type EstadoFicha = 'en_taller' | 'entregado' | 'entregado_sin_reparar'

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
] as const

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

/** Solo se cierra desde en_taller; una ficha cerrada no vuelve a abrirse. */
export function transicionPermitida(desde: EstadoFicha, hacia: EstadoFicha): boolean {
  return desde === 'en_taller' && (hacia === 'entregado' || hacia === 'entregado_sin_reparar')
}

export function estaCongelada(f: Pick<Ficha, 'congeladaEn'>): boolean {
  return f.congeladaEn !== null
}
