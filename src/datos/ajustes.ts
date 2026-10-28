import { eq } from 'drizzle-orm'
import { obtenerDb } from '@/db/cliente'
import { ajustesTaller } from '@/db/esquema'

/** Los datos del taller que encabezan el voucher. Una sola fila, cargada una sola vez. */
export type AjustesTaller = {
  nombre: string | null
  telefono: string | null
  direccion: string | null
  rutaLogo: string | null
}

// La fila 1 se siembra en la migración 0001 con nombre 'AFIX', así que leerAjustes nunca
// devuelve vacío. Si llegara a faltar, es mejor avisarlo que escribir o leer en silencio.
const FALTA_LA_FILA = 'Faltan los ajustes del taller: la fila 1 la siembra la migración 0001.'

/** Un campo que llega en blanco se guarda como nulo: el voucher imprime el nombre, no un espacio. */
function limpiar(valor: string | null): string | null {
  const texto = valor?.trim() ?? ''
  return texto === '' ? null : texto
}

export async function leerAjustes(): Promise<AjustesTaller> {
  const [fila] = await obtenerDb().select().from(ajustesTaller).where(eq(ajustesTaller.id, 1))
  if (!fila) throw new Error(FALTA_LA_FILA)
  return {
    nombre: fila.nombre,
    telefono: fila.telefono,
    direccion: fila.direccion,
    rutaLogo: fila.rutaLogo,
  }
}

export async function guardarAjustes(ajustes: AjustesTaller): Promise<void> {
  const filas = await obtenerDb()
    .update(ajustesTaller)
    .set({
      nombre: limpiar(ajustes.nombre),
      telefono: limpiar(ajustes.telefono),
      direccion: limpiar(ajustes.direccion),
      rutaLogo: limpiar(ajustes.rutaLogo),
    })
    .where(eq(ajustesTaller.id, 1))
    .returning({ id: ajustesTaller.id })
  if (filas.length === 0) throw new Error(FALTA_LA_FILA)
}
