import { obtenerDb } from '@/db/cliente'
import { modeloIphone } from '@/db/esquema'

export async function cargarTablaModelos(): Promise<Map<string, string>> {
  const filas = await obtenerDb().select().from(modeloIphone)
  return new Map(filas.map((f) => [f.productType, f.modeloComercial]))
}
