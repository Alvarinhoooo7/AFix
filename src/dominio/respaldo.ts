import { asc } from 'drizzle-orm'
import { leerAjustes, type AjustesTaller } from '@/datos/ajustes'
import { todosLosCatalogos } from '@/datos/catalogo'
import type { Equipo, Ficha } from '@/datos/equipos'
import type { NotaPosterior } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha, notaPosterior } from '@/db/esquema'
import type { Catalogo } from '@/dominio/checklist'

export type Respaldo = {
  generadoEn: string
  equipos: Equipo[]
  fichas: Ficha[]
  notasPosteriores: NotaPosterior[]
  ajustes: AjustesTaller
  catalogos: Catalogo[]
}

/**
 * Reúne todo el historial del taller en un solo objeto exportable (diseño §11.1).
 * Incluye todas las versiones del catálogo de checklist para que cualquier ficha
 * histórica conserve las líneas y etiquetas con las que fue completada.
 */
export async function armarRespaldo(): Promise<Respaldo> {
  const db = obtenerDb()
  const [equiposLista, fichasLista, notasLista, ajustes, catalogos] = await Promise.all([
    db.select().from(equipo).orderBy(asc(equipo.creadoEn)),
    db.select().from(ficha).orderBy(asc(ficha.numero)),
    db.select().from(notaPosterior).orderBy(asc(notaPosterior.fichaNumero), asc(notaPosterior.id)),
    leerAjustes(),
    todosLosCatalogos(),
  ])

  return {
    generadoEn: new Date().toISOString(),
    equipos: equiposLista,
    fichas: fichasLista,
    notasPosteriores: notasLista,
    ajustes,
    catalogos,
  }
}
