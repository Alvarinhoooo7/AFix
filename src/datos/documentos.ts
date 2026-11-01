import { createHash } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { almacenConfigurado, FALTA_CONFIGURAR, type Almacen } from '@/datos/almacen'
import { generarPdf, origenApp } from '@/datos/pdf'
import { obtenerDb } from '@/db/cliente'
import { documento } from '@/db/esquema'

export type Documento = typeof documento.$inferSelect
export type TipoDocumento = 'ingreso' | 'salida'

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  ingreso: 'Comprobante de ingreso',
  salida: 'Informe de entrega',
}

type Dependencias = {
  generar?: (url: string) => Promise<Uint8Array>
  almacen?: Almacen | null
  origen?: string
}

export type ResultadoDocumento = { ok: true; documento: Documento } | { ok: false; mensaje: string }

/** "2026/0052-ingreso-20261101T221200123Z.pdf": nunca se repite, así que nada se pisa. */
export function rutaDocumento(numero: number, tipo: TipoDocumento, emitido: Date): string {
  const sello = emitido.toISOString().replace(/[-:.]/g, '')
  return `${emitido.getUTCFullYear()}/${String(numero).padStart(4, '0')}-${tipo}-${sello}.pdf`
}

/**
 * Genera el PDF desde la página /imprimir, lo archiva y guarda su huella (plan §6.1). El
 * registro es exactamente lo que se envió: un documento emitido no se reemplaza; si hay
 * que corregir, se emite otro y queda el historial.
 */
export async function emitirDocumento(numero: number, tipo: TipoDocumento, deps: Dependencias = {}): Promise<ResultadoDocumento> {
  const almacen = deps.almacen === undefined ? almacenConfigurado() : deps.almacen
  if (!almacen) return { ok: false, mensaje: FALTA_CONFIGURAR }
  try {
    const emitido = new Date()
    const contenido = await (deps.generar ?? generarPdf)(`${deps.origen ?? origenApp()}/imprimir/${tipo}/${numero}`)
    const sha256 = createHash('sha256').update(contenido).digest('hex')
    const ruta = rutaDocumento(numero, tipo, emitido)
    await almacen.subir(ruta, contenido, 'application/pdf')
    const [fila] = await obtenerDb()
      .insert(documento)
      .values({ fichaNumero: numero, tipo, emitidoEn: emitido, sha256, bytes: contenido.byteLength, rutaStorage: ruta })
      .returning()
    return { ok: true, documento: fila }
  } catch (error) {
    console.error(`No se pudo emitir el documento ${tipo} de la ficha ${numero}.`, error)
    const detalle = error instanceof Error ? error.message : String(error)
    return { ok: false, mensaje: `No se pudo generar el PDF: ${detalle}` }
  }
}

export async function documentosDeFicha(numero: number): Promise<Documento[]> {
  return obtenerDb().select().from(documento).where(eq(documento.fichaNumero, numero)).orderBy(asc(documento.emitidoEn))
}

export async function obtenerDocumento(id: string): Promise<Documento | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [fila] = await obtenerDb().select().from(documento).where(eq(documento.id, id))
  return fila ?? null
}

/** El PDF archivado, verificado contra su huella: si no coincide, no se entrega. */
export async function contenidoDocumento(doc: Documento, almacen: Almacen | null = almacenConfigurado()): Promise<Uint8Array> {
  if (!almacen) throw new Error(FALTA_CONFIGURAR)
  const contenido = await almacen.bajar(doc.rutaStorage)
  const sha256 = createHash('sha256').update(contenido).digest('hex')
  if (sha256 !== doc.sha256) throw new Error(`El archivo del documento ${doc.id} no coincide con su huella registrada.`)
  return contenido
}

export async function marcarEnviado(id: string): Promise<void> {
  await obtenerDb().update(documento).set({ enviadoEn: new Date() }).where(eq(documento.id, id))
}

export function nombreArchivo(doc: Pick<Documento, 'fichaNumero' | 'tipo'>): string {
  return `AFix-ficha-${String(doc.fichaNumero).padStart(4, '0')}-${doc.tipo === 'ingreso' ? 'ingreso' : 'entrega'}.pdf`
}
