import { eq } from 'drizzle-orm'
import { obtenerDb } from '@/db/cliente'
import { ajustesTaller } from '@/db/esquema'

/** Los datos del taller que encabezan los documentos. Una sola fila, editable desde Ajustes. */
export type AjustesTaller = {
  nombre: string | null
  telefono: string | null
  direccion: string | null
  rutaLogo: string | null
  razonSocial: string | null
  rut: string | null
  correo: string | null
  instagram: string | null
  whatsapp: string | null
  garantiaMeses: number
}

export const GARANTIA_POR_DEFECTO = 3

// La fila 1 se siembra en la migración 0001 con nombre 'AFIX', así que leerAjustes nunca
// devuelve vacío. Si llegara a faltar, es mejor avisarlo que escribir o leer en silencio.
const FALTA_LA_FILA = 'Faltan los ajustes del taller: la fila 1 la siembra la migración 0001.'

/** Un campo que llega en blanco se guarda como nulo: el documento imprime el nombre, no un espacio. */
function limpiar(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? ''
  return texto === '' ? null : texto
}

/** La garantía en meses entre 0 y 60 (lo que permite la base); lo inválido vuelve al valor por defecto. */
export function mesesValidos(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number.parseInt(String(valor ?? ''), 10)
  return Number.isInteger(numero) && numero >= 0 && numero <= 60 ? numero : GARANTIA_POR_DEFECTO
}

export async function leerAjustes(): Promise<AjustesTaller> {
  const [fila] = await obtenerDb().select().from(ajustesTaller).where(eq(ajustesTaller.id, 1))
  if (!fila) throw new Error(FALTA_LA_FILA)
  return {
    nombre: fila.nombre,
    telefono: fila.telefono,
    direccion: fila.direccion,
    rutaLogo: fila.rutaLogo,
    razonSocial: fila.razonSocial,
    rut: fila.rut,
    correo: fila.correo,
    instagram: fila.instagram,
    whatsapp: fila.whatsapp,
    garantiaMeses: fila.garantiaMeses,
  }
}

export async function guardarAjustes(ajustes: Partial<AjustesTaller> & Pick<AjustesTaller, 'nombre'>): Promise<void> {
  const filas = await obtenerDb()
    .update(ajustesTaller)
    .set({
      nombre: limpiar(ajustes.nombre),
      telefono: limpiar(ajustes.telefono),
      direccion: limpiar(ajustes.direccion),
      rutaLogo: limpiar(ajustes.rutaLogo),
      razonSocial: limpiar(ajustes.razonSocial),
      rut: limpiar(ajustes.rut),
      correo: limpiar(ajustes.correo),
      instagram: limpiar(ajustes.instagram),
      whatsapp: limpiar(ajustes.whatsapp),
      garantiaMeses: mesesValidos(ajustes.garantiaMeses ?? GARANTIA_POR_DEFECTO),
    })
    .where(eq(ajustesTaller.id, 1))
    .returning({ id: ajustesTaller.id })
  if (filas.length === 0) throw new Error(FALTA_LA_FILA)
}
