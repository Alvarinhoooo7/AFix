import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { historialDeImei } from '@/datos/equipos'
import { actualizarFicha, cerrarFicha, crearFicha } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha } from '@/db/esquema'
import { ingresoVacio } from '../ayudas'

const db = obtenerDb()
const creadas: number[] = []
const equiposCreados = new Set<string>()

const sufijo = Date.now().toString().slice(-8)
const imeiConHistoria = `3587210${sufijo}`
const imeiSinHistoria = `3511900${sufijo}`

afterAll(async () => {
  for (const n of creadas) {
    await db.delete(ficha).where(eq(ficha.numero, n))
  }
  for (const id of equiposCreados) {
    await db.delete(equipo).where(eq(equipo.id, id))
  }
  await (db.$client as { end: () => Promise<void> }).end()
})

async function sembrarFicha(imei: string, trabajos: string[]) {
  const f = await crearFicha({ ...ingresoVacio(), imei })
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  await actualizarFicha(f.numero, { trabajosRealizados: trabajos })
  await cerrarFicha(f.numero, 'entregado')
  return f
}

test('un IMEI con historia la devuelve, de la más nueva a la más vieja', async () => {
  await sembrarFicha(imeiConHistoria, ['Parlante'])
  await sembrarFicha(imeiConHistoria, ['Batería'])

  const h = await historialDeImei(imeiConHistoria)
  expect(h).toHaveLength(2)
  expect(h[0].numero).toBeGreaterThan(h[1].numero)
  expect(h[0].trabajos).toEqual(['Batería'])
  expect(h[1].trabajos).toEqual(['Parlante'])
  expect(h[0].entregadoEn).toBeInstanceOf(Date)
})

test('un IMEI sin historia devuelve lista vacía', async () => {
  expect(await historialDeImei(imeiSinHistoria)).toEqual([])
  expect(await historialDeImei('no-es-imei')).toEqual([])
})

test('el aviso no impide crear la ficha nueva', async () => {
  const f = await crearFicha({ ...ingresoVacio(), imei: imeiConHistoria })
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  expect(f.numero).toBeGreaterThan(0)
  expect(await historialDeImei(imeiConHistoria)).toHaveLength(3)
})
