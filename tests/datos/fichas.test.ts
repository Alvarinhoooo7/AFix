import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { catalogoActivo } from '@/datos/catalogo'
import { obtenerEquipo } from '@/datos/equipos'
import { actualizarFicha, agregarNotaPosterior, cerrarFicha, crearFicha, obtenerFicha } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha, notaPosterior } from '@/db/esquema'
import { baseCaida, ingresoMinimo, ingresoVacio } from '../ayudas'

const db = obtenerDb()
const creadas: number[] = []
const equiposCreados = new Set<string>()

afterAll(async () => {
  for (const n of creadas) {
    await db.delete(notaPosterior).where(eq(notaPosterior.fichaNumero, n))
    await db.delete(ficha).where(eq(ficha.numero, n))
  }
  for (const id of equiposCreados) await db.delete(equipo).where(eq(equipo.id, id))
  await (db.$client as { end: () => Promise<void> }).end()
})

async function nueva(datos: Parameters<typeof crearFicha>[0] = ingresoMinimo()) {
  const f = await crearFicha(datos)
  creadas.push(f.numero)
  equiposCreados.add(f.equipoId)
  return f
}

test('el correlativo avanza y no se repite', async () => {
  const a = await nueva()
  const b = await nueva()
  expect(b.numero).toBe(a.numero + 1)
})

test('una ficha en taller se puede editar', async () => {
  const f = await nueva()
  const g = await actualizarFicha(f.numero, { observacionIngreso: 'corregido' })
  expect(g.observacionIngreso).toBe('corregido')
})

test('cerrar escribe congelada_en', async () => {
  const f = await cerrarFicha((await nueva()).numero, 'entregado')
  expect(f.congeladaEn).toBeTruthy()
  expect(f.entregadoEn).toBeTruthy()
  expect(f.estado).toBe('entregado')
})

test('actualizarFicha rechaza una ficha ya congelada', async () => {
  const f = await nueva(ingresoMinimo({ observacionIngreso: 'original' }))
  await cerrarFicha(f.numero, 'entregado')
  await expect(actualizarFicha(f.numero, { observacionIngreso: 'otra' })).rejects.toThrow(/congelada/i)
  expect((await obtenerFicha(f.numero))!.observacionIngreso).toBe('original')
})

test('el checklist de ingreso tampoco se edita después de cerrar', async () => {
  const f = await nueva()
  await cerrarFicha(f.numero, 'entregado_sin_reparar')
  await expect(actualizarFicha(f.numero, { checklistIngreso: { pantalla: { estado: 'ok' } } })).rejects.toThrow(
    /congelada/i,
  )
})

test('no se puede cerrar dos veces ni cambiar el estado por actualizarFicha', async () => {
  const f = await nueva()
  await expect(actualizarFicha(f.numero, { estado: 'entregado' })).rejects.toThrow(/cerrarFicha/)
  await expect(actualizarFicha(f.numero, { congeladaEn: new Date() })).rejects.toThrow(/cerrarFicha/)
  await cerrarFicha(f.numero, 'entregado')
  await expect(cerrarFicha(f.numero, 'entregado_sin_reparar')).rejects.toThrow(/congelada/i)
  expect((await obtenerFicha(f.numero))!.estado).toBe('entregado')
})

test('actualizar o cerrar una ficha inexistente da un error claro', async () => {
  await expect(actualizarFicha(2147483000, { pidioCliente: 'x' })).rejects.toThrow(/no existe/i)
  await expect(cerrarFicha(2147483000, 'entregado')).rejects.toThrow(/no existe/i)
})

test('se puede entregar sin reparar', async () => {
  const f = await cerrarFicha((await nueva()).numero, 'entregado_sin_reparar')
  expect(f.estado).toBe('entregado_sin_reparar')
  expect(f.congeladaEn).toBeTruthy()
})

test('una nota posterior no pisa la observación original', async () => {
  const f = await nueva(ingresoMinimo({ observacionIngreso: 'original' }))
  await cerrarFicha(f.numero, 'entregado')
  await agregarNotaPosterior(f.numero, 'apareció otra cosa')
  const g = (await obtenerFicha(f.numero))!
  expect(g.observacionIngreso).toBe('original')
  expect(g.notasPosteriores[0].texto).toBe('apareció otra cosa')
  expect(g.notasPosteriores[0].creadaEn).toBeInstanceOf(Date)
})

test('las notas posteriores solo van en fichas cerradas y no vacías', async () => {
  const abierta = await nueva()
  await expect(agregarNotaPosterior(abierta.numero, 'algo')).rejects.toThrow(/cerrada/i)
  await cerrarFicha(abierta.numero, 'entregado')
  await expect(agregarNotaPosterior(abierta.numero, '   ')).rejects.toThrow(/vacía/i)
  await expect(agregarNotaPosterior(2147483000, 'algo')).rejects.toThrow(/no existe/i)
})

test('las notas posteriores salen en orden', async () => {
  const f = await nueva()
  await cerrarFicha(f.numero, 'entregado')
  await agregarNotaPosterior(f.numero, 'primera')
  await agregarNotaPosterior(f.numero, 'segunda')
  expect((await obtenerFicha(f.numero))!.notasPosteriores.map((n) => n.texto)).toEqual(['primera', 'segunda'])
})

test('obtenerFicha devuelve null si no existe', async () => {
  expect(await obtenerFicha(2147483000)).toBeNull()
})

test('se guarda un ingreso totalmente vacío (equipo apagado)', async () => {
  const f = await nueva(ingresoVacio())
  expect(f.estado).toBe('en_taller')
  expect(f.congeladaEn).toBeNull()
  expect((await obtenerEquipo(f.equipoId))!.imei).toBeNull()
})

test('un ingreso con IMEI crea el equipo con IMEI normalizado', async () => {
  const f = await nueva(ingresoMinimo({ imei: '35 872109-447 3331' }))
  expect((await obtenerEquipo(f.equipoId))!.imei).toBe('358721094473331')
})

test('un IMEI mal escrito no se guarda como identidad', async () => {
  const f = await nueva(ingresoMinimo({ imei: '123' }))
  expect((await obtenerEquipo(f.equipoId))!.imei).toBeNull()
})

test('dos ingresos con el mismo IMEI reutilizan el equipo', async () => {
  const a = await nueva(ingresoMinimo({ imei: '358721094473332' }))
  const b = await nueva(ingresoMinimo({ imei: '358721094473332 ' }))
  expect(b.equipoId).toBe(a.equipoId)
})

test('sin versión de catálogo, la ficha toma la activa', async () => {
  const activa = await catalogoActivo()
  const f = await nueva({ ...ingresoMinimo(), catalogoVersion: undefined })
  expect(f.catalogoVersion).toBe(activa.version)
})

test('una versión de catálogo explícita se respeta', async () => {
  const f = await nueva(ingresoMinimo({ catalogoVersion: 1 }))
  expect(f.catalogoVersion).toBe(1)
})

test('baseCaida rechaza cualquier consulta', async () => {
  await expect(baseCaida().select().from(ficha)).rejects.toThrow(/no responde/)
  await expect(baseCaida().insert(ficha).values({ equipoId: 'x' }).returning()).rejects.toThrow(/no responde/)
})
