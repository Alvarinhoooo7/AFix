import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

/**
 * Dónde viven los PDF emitidos (plan §6.1). En el taller, Supabase Storage (bucket privado
 * 'documentos', creado por la migración 0010). En las pruebas y sin nube, una carpeta
 * (ALMACEN_DIRECTORIO). Un archivo emitido nunca se sobrescribe.
 */
export type Almacen = {
  subir(ruta: string, contenido: Uint8Array, tipo: string): Promise<void>
  bajar(ruta: string): Promise<Uint8Array>
}

export const BUCKET = 'documentos'

export const FALTA_CONFIGURAR =
  'Falta configurar dónde se guardan los PDF: agrega SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local (ver README).'

function enCarpeta(raiz: string): Almacen {
  const base = resolve(raiz)
  const destino = (ruta: string) => {
    const completo = resolve(join(base, ruta))
    if (!completo.startsWith(base + sep)) throw new Error(`Ruta de documento no válida: ${ruta}`)
    return completo
  }
  return {
    async subir(ruta, contenido) {
      const archivo = destino(ruta)
      await mkdir(dirname(archivo), { recursive: true })
      await writeFile(archivo, contenido, { flag: 'wx' })
    },
    async bajar(ruta) {
      return new Uint8Array(await readFile(destino(ruta)))
    },
  }
}

function enSupabase(url: string, clave: string): Almacen {
  const encabezados = { Authorization: `Bearer ${clave}`, apikey: clave }
  const objeto = (ruta: string) => `${url.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${ruta.split('/').map(encodeURIComponent).join('/')}`
  return {
    async subir(ruta, contenido, tipo) {
      const r = await fetch(objeto(ruta), {
        method: 'POST',
        headers: { ...encabezados, 'Content-Type': tipo, 'x-upsert': 'false' },
        body: Buffer.from(contenido),
      })
      if (!r.ok) throw new Error(`Supabase Storage rechazó el archivo (${r.status}): ${await r.text()}`)
    },
    async bajar(ruta) {
      const r = await fetch(objeto(ruta).replace('/object/', '/object/authenticated/'), { headers: encabezados, cache: 'no-store' })
      if (!r.ok) throw new Error(`No se pudo descargar el documento de Supabase Storage (${r.status}).`)
      return new Uint8Array(await r.arrayBuffer())
    },
  }
}

export function almacenConfigurado(): Almacen | null {
  if (process.env.ALMACEN_DIRECTORIO) return enCarpeta(process.env.ALMACEN_DIRECTORIO)
  const url = process.env.SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && clave ? enSupabase(url, clave) : null
}
