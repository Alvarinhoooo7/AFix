import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { obtenerEquipo } from '@/datos/equipos'
import { crearFicha, intentarGuardarIngreso } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha } from '@/db/esquema'
import { baseCaida, ingresoMinimo, ingresoVacio } from '../ayudas'

const db = obtenerDb()
const creadas: number[] = []
const equiposCreados = new Set<string>()
let secuenciaImei = 0

function imeiUnico(): string {
  secuenciaImei += 1
  const cola = `${Date.now().toString().slice(-8)}${String(secuenciaImei).padStart(2, '0')}`
  return `35872${cola}`.slice(0, 15).padEnd(15, '0')
}

afterAll(async () => {
  for (const n of creadas) {
    await db.delete(ficha).where(eq(ficha.numero, n))
  }
  for (const id of equiposCreados) {
    await db.delete(equipo).where(eq(equipo.id, id))
  }
  await (db.$client as { end: () => Promise<void> }).end()
})

test('se guarda un ingreso sin IMEI ni modelo', async () => {
  const f = await crearFicha({ ...ingresoVacio(), pidioCliente: 'Cambiar la batería' })
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  expect(f.numero).toBeGreaterThan(0)
  expect(f.estado).toBe('en_taller')
})

test('un ingreso con IMEI crea el equipo con ese IMEI', async () => {
  const imei = imeiUnico()
  const f = await crearFicha({ ...ingresoVacio(), imei })
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  expect((await obtenerEquipo(f.equipoId))!.imei).toBe(imei)
})

test('un IMEI mal escrito no se guarda como identidad', async () => {
  const f = await crearFicha({ ...ingresoVacio(), imei: '123' })
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  expect((await obtenerEquipo(f.equipoId))!.imei).toBeNull()
})

test('si la base no responde, el error es en español y trae lo escrito', async () => {
  const datos = ingresoMinimo({
    modeloComercial: 'iPhone 12',
    pidioCliente: 'Cambiar batería',
    quienLoTrajo: 'Marcela',
    observacionIngreso: 'Viene apagado',
  })
  const resultado = await intentarGuardarIngreso(datos, { db: baseCaida() })
  expect(resultado.ok).toBe(false)
  if (!resultado.ok) {
    expect(resultado.mensaje).toMatch(/no se pudo guardar/i)
    expect(resultado.datos).toEqual(datos)
  }
})

test('intentarGuardarIngreso devuelve la ficha cuando la base responde', async () => {
  const datos = ingresoMinimo({
    imei: imeiUnico(),
    modeloComercial: 'iPhone 13',
    pidioCliente: 'Cambiar pantalla',
  })
  const resultado = await intentarGuardarIngreso(datos, { db })
  expect(resultado.ok).toBe(true)
  if (resultado.ok) {
    creadas.push(resultado.ficha.numero)
    equiposCreados.add(resultado.ficha.equipoId)
    expect(resultado.ficha.numero).toBeGreaterThan(0)
    expect(resultado.ficha.estado).toBe('en_taller')
  }
})
