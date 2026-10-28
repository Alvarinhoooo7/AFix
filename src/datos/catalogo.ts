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
