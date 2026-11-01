import { asc, eq, max } from 'drizzle-orm'
import { obtenerDb, type DrizzleDb } from '@/db/cliente'
import { catalogoChecklist } from '@/db/esquema'
import type { Catalogo, LineaCatalogo } from '@/dominio/checklist'

type Fila = typeof catalogoChecklist.$inferSelect

function bloqueValido(bloque: string): LineaCatalogo['bloque'] {
  if (bloque === 'funcionamiento' || bloque === 'condicion') return bloque
  throw new Error(`El bloque "${bloque}" del catálogo de checklist no es válido.`)
}

function aLinea(f: Fila): LineaCatalogo {
  return {
    clave: f.clave,
    etiqueta: f.etiqueta,
    bloque: bloqueValido(f.bloque),
    orden: f.orden,
    estados: f.estados,
  }
}

export async function catalogoPorVersion(version: number, db: DrizzleDb = obtenerDb()): Promise<Catalogo> {
  const filas = await db
    .select()
    .from(catalogoChecklist)
    .where(eq(catalogoChecklist.version, version))
    .orderBy(asc(catalogoChecklist.orden))
  if (filas.length === 0) throw new Error(`No existe la versión ${version} del catálogo de checklist.`)
  return { version, lineas: filas.map(aLinea) }
}

export async function catalogoActivo(db: DrizzleDb = obtenerDb()): Promise<Catalogo> {
  const [{ version }] = await db.select({ version: max(catalogoChecklist.version) }).from(catalogoChecklist)
  if (version === null) throw new Error('El catálogo de checklist está vacío.')
  return catalogoPorVersion(version, db)
}

/** Una clave estable a partir de la etiqueta de una línea nueva: "Lentes de cámara" -> "lentes_de_camara". */
export function claveDeEtiqueta(etiqueta: string): string {
  return etiqueta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export type LineaNueva = { clave?: string; etiqueta: string; bloque: LineaCatalogo['bloque']; estados: string[] }

/**
 * Editar el checklist crea una versión nueva (plan §7.6): las fichas viejas siguen leyendo
 * la suya. Una línea que conserva su clave mantiene su historia entre versiones.
 */
export async function crearVersionCatalogo(lineas: LineaNueva[], db: DrizzleDb = obtenerDb()): Promise<number> {
  const limpias = lineas
    .map((l) => ({
      clave: l.clave?.trim() || claveDeEtiqueta(l.etiqueta),
      etiqueta: l.etiqueta.trim(),
      bloque: bloqueValido(l.bloque),
      estados: [...new Set(l.estados.map((e) => e.trim()).filter(Boolean))],
    }))
    .filter((l) => l.etiqueta !== '' && l.clave !== '')
  if (limpias.length === 0) throw new Error('El checklist tiene que tener al menos una línea.')
  const sinEstados = limpias.find((l) => l.estados.length < 2)
  if (sinEstados) throw new Error(`La línea "${sinEstados.etiqueta}" necesita al menos dos estados.`)
  const claves = new Set<string>()
  for (const l of limpias) {
    if (claves.has(l.clave)) throw new Error(`Hay dos líneas con la misma clave: ${l.clave}.`)
    claves.add(l.clave)
  }
  return db.transaction(async (tx) => {
    const [{ version }] = await tx.select({ version: max(catalogoChecklist.version) }).from(catalogoChecklist)
    const nueva = (version ?? 0) + 1
    await tx.insert(catalogoChecklist).values(limpias.map((l, i) => ({ version: nueva, orden: i + 1, ...l })))
    return nueva
  })
}

/** Todas las versiones, de la más vieja a la más nueva: un respaldo las necesita para releer fichas viejas. */
export async function todosLosCatalogos(db: DrizzleDb = obtenerDb()): Promise<Catalogo[]> {
  const filas = await db
    .select()
    .from(catalogoChecklist)
    .orderBy(asc(catalogoChecklist.version), asc(catalogoChecklist.orden))
  const porVersion = new Map<number, LineaCatalogo[]>()
  for (const f of filas) porVersion.set(f.version, [...(porVersion.get(f.version) ?? []), aLinea(f)])
  return [...porVersion].map(([version, lineas]) => ({ version, lineas }))
}
