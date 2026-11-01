import { asc, eq, max } from 'drizzle-orm'
import { obtenerDb } from '@/db/cliente'
import { clausula } from '@/db/esquema'

export type Clausula = { orden: number; titulo: string; texto: string }
export type VersionClausulas = { version: number; clausulas: Clausula[] }

async function porVersion(version: number): Promise<VersionClausulas> {
  const filas = await obtenerDb()
    .select()
    .from(clausula)
    .where(eq(clausula.version, version))
    .orderBy(asc(clausula.orden))
  if (filas.length === 0) throw new Error(`No existe la versión ${version} de las cláusulas.`)
  return { version, clausulas: filas.map(({ orden, titulo, texto }) => ({ orden, titulo, texto })) }
}

export async function clausulasActivas(): Promise<VersionClausulas> {
  const [{ version }] = await obtenerDb().select({ version: max(clausula.version) }).from(clausula)
  if (version === null) throw new Error('No hay cláusulas cargadas: la versión 1 la siembra la migración 0010.')
  return porVersion(version)
}

/** Las que aceptó el cliente de una ficha; sin versión guardada (fichas viejas), ninguna. */
export async function clausulasDeFicha(version: number | null): Promise<VersionClausulas | null> {
  return version === null ? null : porVersion(version)
}

/**
 * Editar las cláusulas crea una versión nueva y nunca toca la anterior: una ficha vieja
 * sigue mostrando el texto que aceptó su cliente.
 */
export async function crearVersionClausulas(lista: { titulo: string; texto: string }[]): Promise<number> {
  const limpias = lista
    .map((c) => ({ titulo: c.titulo.trim(), texto: c.texto.trim() }))
    .filter((c) => c.titulo !== '' && c.texto !== '')
  if (limpias.length === 0) throw new Error('Tiene que quedar al menos una cláusula con título y texto.')
  return obtenerDb().transaction(async (tx) => {
    const [{ actual }] = await tx.select({ actual: max(clausula.version) }).from(clausula)
    const version = (actual ?? 0) + 1
    await tx.insert(clausula).values(limpias.map((c, i) => ({ version, orden: i + 1, ...c })))
    return version
  })
}

/** El texto con la garantía en meses puesta donde dice {meses}. */
export function textoClausula(texto: string, garantiaMeses: number): string {
  return texto.replaceAll('{meses}', String(garantiaMeses))
}
