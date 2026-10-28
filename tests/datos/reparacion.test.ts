import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { actualizarFicha, cerrarFicha, crearFicha } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha } from '@/db/esquema'
import { TRABAJOS } from '@/dominio/ficha'
import { ingresoVacio } from '../ayudas'

const db = obtenerDb()
const creadas: number[] = []
const equiposCreados = new Set<string>()

afterAll(async () => {
  for (const n of creadas) {
    await db.delete(ficha).where(eq(ficha.numero, n))
  }
  for (const id of equiposCreados) {
    await db.delete(equipo).where(eq(equipo.id, id))
  }
  await (db.$client as { end: () => Promise<void> }).end()
})

async function nueva() {
  const f = await crearFicha(ingresoVacio())
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  return f
}

test('TRABAJOS contiene los diez trabajos estándar del taller', () => {
  expect(TRABAJOS).toEqual([
    'Batería',
    'Pantalla',
    'Parlante',
    'Auricular',
    'Cámara trasera',
    'Cámara frontal',
    'Puerto de carga',
    'Vibrador',
    'Botones',
    'Vidrio trasero',
  ])
})

test('se guardan varios trabajos a la vez, incluyendo otro personalizado', async () => {
  const f = await nueva()
  const g = await actualizarFicha(f.numero, {
    trabajosRealizados: ['Batería', 'Parlante', 'Limpieza de malla inferior'],
  })
  expect(g.trabajosRealizados).toEqual(['Batería', 'Parlante', 'Limpieza de malla inferior'])
})

test('la nota de reparación se guarda', async () => {
  const f = await nueva()
  const g = await actualizarFicha(f.numero, {
    notaReparacion: 'El flex estaba pegado con exceso de adhesivo',
  })
  expect(g.notaReparacion).toContain('adhesivo')
})

test('se puede cerrar una ficha sin ningún trabajo registrado', async () => {
  const f = await nueva()
  const g = await cerrarFicha(f.numero, 'entregado_sin_reparar')
  expect(g.estado).toBe('entregado_sin_reparar')
})

test('actualizarFicha sin cambios devuelve la ficha actual sin error en inglés', async () => {
  const f = await nueva()
  const g = await actualizarFicha(f.numero, {})
  expect(g.numero).toBe(f.numero)
})
