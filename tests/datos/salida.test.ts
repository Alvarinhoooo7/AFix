import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { actualizarFicha, cerrarFicha, crearFicha } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha, notaPosterior } from '@/db/esquema'
import { compararBateria } from '@/dominio/bateria'
import { ingresoVacio } from '../ayudas'

const db = obtenerDb()
const creadas: number[] = []
const equiposCreados = new Set<string>()

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

async function nueva(datos = ingresoVacio()) {
  const f = await crearFicha(datos)
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  return f
}

test('el checklist de salida usa las mismas líneas que el de ingreso', async () => {
  const f = await nueva(ingresoVacio())
  const g = await actualizarFicha(f.numero, {
    checklistSalida: { face_id: { estado: 'Bien' } },
  })
  expect(g.catalogoVersion).toBe(f.catalogoVersion)
  expect(g.checklistSalida).toEqual({ face_id: { estado: 'Bien' } })
})

test('guarda los datos de batería de salida y permite compararlos con el ingreso', async () => {
  const f = await nueva({ ...ingresoVacio(), bateriaPct: 79, bateriaCiclos: 743 })
  const g = await actualizarFicha(f.numero, {
    bateriaSalidaPct: 100,
    bateriaSalidaCiclos: 0,
  })
  const comparacion = compararBateria(
    { pct: g.bateriaPct, ciclos: g.bateriaCiclos },
    { pct: g.bateriaSalidaPct, ciclos: g.bateriaSalidaCiclos },
  )
  expect(comparacion).toEqual({ pctDelta: 21, ciclosDelta: -743, comparable: true })
})

test('editar una ficha congelada es rechazado por la capa de datos', async () => {
  const f = await nueva(ingresoVacio())
  await cerrarFicha(f.numero, 'entregado')
  await expect(actualizarFicha(f.numero, { observacionSalida: 'otra cosa' })).rejects.toThrow(/congelada/i)
})

test('cerrar dos veces la misma ficha es rechazado', async () => {
  const f = await nueva(ingresoVacio())
  await cerrarFicha(f.numero, 'entregado')
  await expect(cerrarFicha(f.numero, 'entregado')).rejects.toThrow()
})
