import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { catalogoActivo } from '@/datos/catalogo'
import { actualizarFicha, crearFicha } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha } from '@/db/esquema'
import type { Checklist } from '@/dominio/checklist'
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

async function nueva(datos = ingresoVacio()) {
  const f = await crearFicha(datos)
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  return f
}

test('un equipo apagado se guarda con todo en No probado', async () => {
  const { lineas } = await catalogoActivo()
  const todoSinProbar: Checklist = Object.fromEntries(
    lineas.filter((l) => l.bloque === 'funcionamiento').map((l) => [l.clave, { estado: 'No probado' }]),
  )
  const f = await nueva({ ...ingresoVacio(), checklistIngreso: todoSinProbar })
  expect(f.numero).toBeGreaterThan(0)
  expect((f.checklistIngreso as Checklist).face_id.estado).toBe('No probado')
})

test('se guarda una ficha con el checklist completamente vacío', async () => {
  const f = await nueva({ ...ingresoVacio(), checklistIngreso: {} })
  expect(f.checklistIngreso).toEqual({})
})

test('las notas escritas se guardan y las vacías no', async () => {
  const f = await nueva({
    ...ingresoVacio(),
    checklistIngreso: {
      face_id: { estado: 'Falla', nota: 'Ya venía así' },
      carga: { estado: 'Bien', nota: '' },
      parlante: { estado: 'Bien', nota: '   ' },
    },
  })
  const checklist = f.checklistIngreso as Checklist
  expect(checklist.face_id.nota).toBe('Ya venía así')
  expect(checklist.carga.nota).toBeUndefined()
  expect(checklist.parlante.nota).toBeUndefined()
})

test('actualizarFicha también descarta notas vacías del checklist', async () => {
  const f = await nueva()
  const g = await actualizarFicha(f.numero, {
    checklistIngreso: {
      apertura_previa: { estado: 'Con señales', nota: 'Sello cortado' },
      chasis: { estado: 'Sano', nota: '  ' },
    },
  })
  const checklist = g.checklistIngreso as Checklist
  expect(checklist.apertura_previa.nota).toBe('Sello cortado')
  expect(checklist.chasis.nota).toBeUndefined()
})

test('la ficha registra la versión del catálogo que usó', async () => {
  const f = await nueva(ingresoVacio())
  expect(f.catalogoVersion).toBe(1)
})
