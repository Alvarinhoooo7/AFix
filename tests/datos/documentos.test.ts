import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { unzipSync, strFromU8 } from 'fflate'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { almacenConfigurado } from '@/datos/almacen'
import { contenidoDocumento, documentosDeFicha, emitirDocumento, marcarEnviado, rutaDocumento } from '@/datos/documentos'
import { crearFicha } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { documento, equipo, ficha } from '@/db/esquema'
import { armarZipRespaldo } from '@/dominio/respaldo'
import { ingresoMinimo } from '../ayudas'

let carpeta = ''
let numero = 0
let equipoId = ''
const pdfFalso = (texto: string) => async (url: string) => new TextEncoder().encode(`%PDF-1.7 ${texto} ${url}`)

beforeAll(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'afix-documentos-'))
  process.env.ALMACEN_DIRECTORIO = carpeta
  const f = await crearFicha(ingresoMinimo({ quienLoTrajo: 'Ana' }))
  numero = f.numero
  equipoId = f.equipoId
})

afterAll(async () => {
  const db = obtenerDb()
  await db.delete(documento).where(eq(documento.fichaNumero, numero))
  await db.delete(ficha).where(eq(ficha.numero, numero))
  await db.delete(equipo).where(eq(equipo.id, equipoId))
  delete process.env.ALMACEN_DIRECTORIO
  await rm(carpeta, { recursive: true, force: true })
})

test('la ruta del documento no se repite: incluye ficha, tipo y momento', () => {
  expect(rutaDocumento(52, 'ingreso', new Date('2026-11-01T22:12:00.123Z'))).toBe('2026/0052-ingreso-20261101T221200123Z.pdf')
})

test('sin Storage configurado no se emite y lo dice', async () => {
  const r = await emitirDocumento(numero, 'ingreso', { almacen: null })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.mensaje).toMatch(/SUPABASE_URL/)
})

test('emitir genera el PDF desde /imprimir, lo archiva y guarda su huella', async () => {
  const r = await emitirDocumento(numero, 'ingreso', { generar: pdfFalso('uno'), origen: 'http://app' })
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.documento.sha256).toMatch(/^[0-9a-f]{64}$/)
  const contenido = await contenidoDocumento(r.documento)
  expect(new TextDecoder().decode(contenido)).toBe(`%PDF-1.7 uno http://app/imprimir/ingreso/${numero}`)
})

test('emitir de nuevo agrega otro documento: nunca reemplaza', async () => {
  const r = await emitirDocumento(numero, 'ingreso', { generar: pdfFalso('dos') })
  expect(r.ok).toBe(true)
  const lista = await documentosDeFicha(numero)
  expect(lista).toHaveLength(2)
  expect(lista[0].rutaStorage).not.toBe(lista[1].rutaStorage)
})

test('un PDF alterado en el almacén no se entrega', async () => {
  const [doc] = await documentosDeFicha(numero)
  await expect(contenidoDocumento({ ...doc, sha256: 'f'.repeat(64) })).rejects.toThrow(/huella/)
})

test('marcar enviado deja la fecha', async () => {
  const [doc] = await documentosDeFicha(numero)
  await marcarEnviado(doc.id)
  expect((await documentosDeFicha(numero))[0].enviadoEn).not.toBeNull()
})

test('el respaldo es un zip con el JSON y los PDF', async () => {
  const { zip } = await armarZipRespaldo(almacenConfigurado())
  const archivos = unzipSync(zip)
  const respaldo = JSON.parse(strFromU8(archivos['respaldo.json']))
  expect(respaldo.documentos.some((d: { fichaNumero: number }) => d.fichaNumero === numero)).toBe(true)
  const pdfs = Object.keys(archivos).filter((n) => n.startsWith('documentos/') && n.includes(`${String(numero).padStart(4, '0')}-ingreso`))
  expect(pdfs).toHaveLength(2)
})
