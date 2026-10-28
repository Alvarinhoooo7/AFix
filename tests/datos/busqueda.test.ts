import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { actualizarFicha, cerrarFicha, crearFicha, buscar, equiposEnTaller, ultimasEntregadas } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha } from '@/db/esquema'
import { ingresoMinimo } from '../ayudas'

const db = obtenerDb()
const creadas: number[] = []
const equiposCreados = new Set<string>()

const sufijo = Date.now().toString().slice(-8)
const imeiBuscado = `3587299${sufijo}`
const serieBuscada = `F2LX${sufijo}`
let numeroEnTaller = 0
let numeroEntregada = 0

beforeAll(async () => {
  const enTaller = await crearFicha(
    ingresoMinimo({
      imei: imeiBuscado,
      numeroSerie: serieBuscada,
      modeloComercial: 'iPhone 12 Pro',
      quienLoTrajo: 'Marcela González',
    }),
  )
  creadas.push(enTaller.numero)
  equiposCreados.add(enTaller.equipoId)
  numeroEnTaller = enTaller.numero

  const entregada = await crearFicha(
    ingresoMinimo({
      modeloComercial: 'iPhone 13 Mini',
      quienLoTrajo: 'Rodrigo Pérez',
    }),
  )
  creadas.push(entregada.numero)
  equiposCreados.add(entregada.equipoId)
  await actualizarFicha(entregada.numero, { trabajosRealizados: ['Batería'] })
  await cerrarFicha(entregada.numero, 'entregado')
  numeroEntregada = entregada.numero
})

afterAll(async () => {
  for (const n of creadas) {
    await db.delete(ficha).where(eq(ficha.numero, n))
  }
  for (const id of equiposCreados) {
    await db.delete(equipo).where(eq(equipo.id, id))
  }
  await (db.$client as { end: () => Promise<void> }).end()
})

test('los equipos en taller salen primero y no incluyen entregados', async () => {
  const filas = await equiposEnTaller()
  expect(filas.length).toBeGreaterThan(0)
  expect(filas.every((f) => f.estado === 'en_taller')).toBe(true)
  expect(filas.some((f) => f.numero === numeroEnTaller)).toBe(true)
  expect(filas.some((f) => f.numero === numeroEntregada)).toBe(false)
})

test('ultimasEntregadas devuelve solo fichas cerradas hasta el límite pedido', async () => {
  const filas = await ultimasEntregadas(5)
  expect(filas.length).toBeGreaterThan(0)
  expect(filas.length).toBeLessThanOrEqual(5)
  expect(filas.every((f) => f.estado !== 'en_taller')).toBe(true)
  expect(filas.some((f) => f.numero === numeroEntregada)).toBe(true)
})

test('busca por número de ficha', async () => {
  const res = await buscar(String(numeroEnTaller))
  expect(res.length).toBeGreaterThan(0)
  expect(res[0].numero).toBe(numeroEnTaller)
})

test('busca por IMEI, serie y modelo', async () => {
  expect(await buscar(imeiBuscado)).toHaveLength(1)
  expect(await buscar(serieBuscada)).toHaveLength(1)
  expect((await buscar('iPhone 12 Pro')).some((f) => f.numero === numeroEnTaller)).toBe(true)
})

test('busca por quién lo trajo, sin distinguir mayúsculas ni acentos', async () => {
  const porNombre = await buscar('marcela')
  expect(porNombre.some((f) => f.numero === numeroEnTaller)).toBe(true)
  const sinAcento = await buscar('gonzalez')
  expect(sinAcento.some((f) => f.numero === numeroEnTaller)).toBe(true)
})

test('una búsqueda sin resultados devuelve lista vacía, no error', async () => {
  expect(await buscar('nada de esto existe en el taller 999999')).toEqual([])
  expect(await buscar('   ')).toEqual([])
})
