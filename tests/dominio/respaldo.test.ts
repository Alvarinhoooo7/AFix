import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { agregarNotaPosterior, cerrarFicha, crearFicha } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha, notaPosterior } from '@/db/esquema'
import { armarRespaldo } from '@/dominio/respaldo'
import { ingresoMinimo } from '../ayudas'

const db = obtenerDb()
const creadas: number[] = []
const equiposCreados = new Set<string>()
let numeroCongelada = 0

beforeAll(async () => {
  const f = await crearFicha(
    ingresoMinimo({
      modeloComercial: 'iPhone 14',
      pidioCliente: 'Cambiar batería',
    }),
  )
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  await cerrarFicha(f.numero, 'entregado')
  await agregarNotaPosterior(f.numero, 'Nota incluida en el respaldo')
  numeroCongelada = f.numero
})

afterAll(async () => {
  for (const n of creadas) {
    await db.delete(notaPosterior).where(eq(notaPosterior.fichaNumero, n))
    await db.delete(ficha).where(eq(ficha.numero, n))
  }
  for (const id of equiposCreados) {
    await db.delete(equipo).where(eq(equipo.id, id))
  }
  await (db.$client as { end: () => Promise<void> }).end()
})

test('el respaldo incluye todo lo necesario para reconstruir el historial', async () => {
  const r = await armarRespaldo()
  expect(r.generadoEn).toBeTruthy()
  expect(Array.isArray(r.equipos)).toBe(true)
  expect(Array.isArray(r.fichas)).toBe(true)
  expect(Array.isArray(r.notasPosteriores)).toBe(true)
  expect(r.ajustes.nombre).toBe('AFIX')
  expect(r.notasPosteriores.some((n) => n.fichaNumero === numeroCongelada)).toBe(true)
})

test('el respaldo trae todas las versiones del catálogo, no solo la activa', async () => {
  const r = await armarRespaldo()
  expect(r.catalogos.length).toBeGreaterThanOrEqual(1)
  expect(r.catalogos.every((c) => c.lineas.length > 0)).toBe(true)
})

test('una ficha congelada viaja con su versión de catálogo', async () => {
  const r = await armarRespaldo()
  const f = r.fichas.find((item) => item.numero === numeroCongelada && item.congeladaEn)!
  expect(f).toBeDefined()
  expect(r.catalogos.some((c) => c.version === f.catalogoVersion)).toBe(true)
})
