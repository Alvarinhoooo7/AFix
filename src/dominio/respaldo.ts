import { asc } from 'drizzle-orm'
import { zipSync, strToU8 } from 'fflate'
import { leerAjustes, type AjustesTaller } from '@/datos/ajustes'
import { almacenConfigurado, type Almacen } from '@/datos/almacen'
import { todosLosCatalogos } from '@/datos/catalogo'
import { contenidoDocumento, type Documento } from '@/datos/documentos'
import type { Equipo, Ficha } from '@/datos/equipos'
import type { NotaPosterior, RegistroEquipo } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { clausula, documento, equipo, ficha, notaPosterior, registroEquipo } from '@/db/esquema'
import type { Catalogo } from '@/dominio/checklist'

export type Respaldo = {
  generadoEn: string
  equipos: Equipo[]
  fichas: Ficha[]
  notasPosteriores: NotaPosterior[]
  registros: RegistroEquipo[]
  documentos: Documento[]
  clausulas: (typeof clausula.$inferSelect)[]
  ajustes: AjustesTaller
  catalogos: Catalogo[]
}

/**
 * Reúne todo el historial del taller en un solo objeto exportable (diseño §11.1). Incluye
 * todas las versiones del catálogo y de las cláusulas para que cualquier ficha histórica
 * conserve lo que tenía.
 */
export async function armarRespaldo(): Promise<Respaldo> {
  const db = obtenerDb()
  const [equiposLista, fichasLista, notasLista, registros, documentos, clausulas, ajustes, catalogos] = await Promise.all([
    db.select().from(equipo).orderBy(asc(equipo.creadoEn)),
    db.select().from(ficha).orderBy(asc(ficha.numero)),
    db.select().from(notaPosterior).orderBy(asc(notaPosterior.fichaNumero), asc(notaPosterior.id)),
    db.select().from(registroEquipo).orderBy(asc(registroEquipo.fichaNumero), asc(registroEquipo.id)),
    db.select().from(documento).orderBy(asc(documento.fichaNumero), asc(documento.emitidoEn)),
    db.select().from(clausula).orderBy(asc(clausula.version), asc(clausula.orden)),
    leerAjustes(),
    todosLosCatalogos(),
  ])

  return {
    generadoEn: new Date().toISOString(),
    equipos: equiposLista,
    fichas: fichasLista,
    notasPosteriores: notasLista,
    registros,
    documentos,
    clausulas,
    ajustes,
    catalogos,
  }
}

/**
 * El respaldo descargable (plan §4): un .zip con respaldo.json y los PDF emitidos en
 * documentos/, con la misma ruta que tienen en Storage. Un PDF que no se pueda bajar no
 * frena el respaldo: queda anotado en faltantes.txt.
 */
export async function armarZipRespaldo(almacen: Almacen | null = almacenConfigurado()): Promise<{ zip: Uint8Array; fecha: string }> {
  const respaldo = await armarRespaldo()
  const archivos: Record<string, Uint8Array> = {
    'respaldo.json': strToU8(JSON.stringify(respaldo, null, 2)),
  }
  const faltantes: string[] = []
  for (const doc of respaldo.documentos) {
    try {
      if (!almacen) throw new Error('Storage sin configurar')
      archivos[`documentos/${doc.rutaStorage}`] = await contenidoDocumento(doc, almacen)
    } catch (error) {
      faltantes.push(`${doc.rutaStorage}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (faltantes.length > 0) archivos['faltantes.txt'] = strToU8(faltantes.join('\n'))
  return { zip: zipSync(archivos, { level: 6 }), fecha: respaldo.generadoEn.slice(0, 10) }
}
