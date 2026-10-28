import { afterEach, expect, test } from 'vitest'
import { obtenerDb } from '@/db/cliente'
import { ajustesTaller, equipo } from '@/db/esquema'

afterEach(async () => {
  await obtenerDb().delete(equipo)
})

test('un equipo se puede crear sin IMEI', async () => {
  const [e] = await obtenerDb().insert(equipo).values({ modeloComercial: 'iPhone 11' }).returning()
  expect(e.id).toBeTruthy()
  expect(e.imei).toBeNull()
})

test('dos equipos sin IMEI conviven como registros separados', async () => {
  const db = obtenerDb()
  const [a] = await db.insert(equipo).values({ modeloComercial: 'iPhone 11' }).returning()
  const [b] = await db.insert(equipo).values({ modeloComercial: 'iPhone 12' }).returning()
  expect(a.id).not.toBe(b.id)
})

test('dos equipos no pueden compartir el mismo IMEI', async () => {
  const db = obtenerDb()
  await db.insert(equipo).values({ imei: '358721094473321' })
  await expect(db.insert(equipo).values({ imei: '358721094473321' })).rejects.toThrow()
})

test('ajustes_taller admite una sola fila', async () => {
  await expect(obtenerDb().insert(ajustesTaller).values({ id: 2, nombre: 'Otro' })).rejects.toThrow()
})

test('ajustes_taller arranca sembrada con AFIX', async () => {
  const filas = await obtenerDb().select().from(ajustesTaller)
  expect(filas).toHaveLength(1)
  expect(filas[0].id).toBe(1)
  expect(filas[0].nombre).toBe('AFIX')
  expect(filas[0].telefono).toBeNull()
})
