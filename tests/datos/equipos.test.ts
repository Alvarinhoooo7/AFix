import { eq, inArray } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { buscarPorImei, fichasDeEquipo, fusionarEquipos, obtenerEquipo } from '@/datos/equipos'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha } from '@/db/esquema'

const db = obtenerDb()
afterAll(async () => {
  // Cierra la conexión del proceso de la prueba.
  await (db.$client as { end: () => Promise<void> }).end()
})

async function limpiar(ids: string[]) {
  await db.delete(ficha).where(inArray(ficha.equipoId, ids))
  await db.delete(equipo).where(inArray(equipo.id, ids))
}

test('buscarPorImei no confunde dos equipos sin IMEI', async () => {
  const filas = await db
    .insert(equipo)
    .values([{ modeloComercial: 'iPhone 11' }, { modeloComercial: 'iPhone 12' }])
    .returning()
  const ids = filas.map((f) => f.id)
  try {
    expect(ids).toHaveLength(2)
    expect(await buscarPorImei('')).toBeNull()
    expect(await buscarPorImei('basura')).toBeNull()
    expect(await buscarPorImei('358721094473321')).toBeNull()
  } finally {
    await limpiar(ids)
  }
})

test('buscarPorImei encuentra el equipo aunque el IMEI venga con separadores', async () => {
  const [e] = await db.insert(equipo).values({ imei: '358721094473322' }).returning()
  try {
    expect((await buscarPorImei('35 872109-447 3322'))?.id).toBe(e.id)
  } finally {
    await limpiar([e.id])
  }
})

test('fusionar mueve las fichas al equipo destino, completa identidad y borra el origen', async () => {
  const [origen] = await db
    .insert(equipo)
    .values({ imei: '358721094473323', numeroSerie: 'SERIE-ORIGEN', color: 'Negro' })
    .returning()
  const [destino] = await db.insert(equipo).values({ color: 'Azul', modeloComercial: 'iPhone 13' }).returning()
  try {
    await db.insert(ficha).values([{ equipoId: origen.id }, { equipoId: destino.id }])
    await fusionarEquipos(origen.id, destino.id)
    expect(await fichasDeEquipo(destino.id)).toHaveLength(2)
    expect(await obtenerEquipo(origen.id)).toBeNull()
    const fusionado = (await obtenerEquipo(destino.id))!
    expect(fusionado.imei).toBe('358721094473323')
    expect(fusionado.numeroSerie).toBe('SERIE-ORIGEN')
    // El campo que el destino ya tenía no se pisa.
    expect(fusionado.color).toBe('Azul')
    expect(fusionado.modeloComercial).toBe('iPhone 13')
  } finally {
    await limpiar([origen.id, destino.id])
  }
})

test('fusionar contra un equipo inexistente falla y no toca nada', async () => {
  const [origen] = await db.insert(equipo).values({ modeloComercial: 'iPhone 14' }).returning()
  try {
    await db.insert(ficha).values({ equipoId: origen.id })
    await expect(fusionarEquipos(origen.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(/no existe/)
    expect(await fichasDeEquipo(origen.id)).toHaveLength(1)
    expect(await obtenerEquipo(origen.id)).not.toBeNull()
  } finally {
    await limpiar([origen.id])
  }
})

test('fusionar un equipo consigo mismo falla', async () => {
  const [e] = await db.insert(equipo).values({}).returning()
  try {
    await expect(fusionarEquipos(e.id, e.id)).rejects.toThrow(/consigo mismo/)
    expect(await db.select().from(equipo).where(eq(equipo.id, e.id))).toHaveLength(1)
  } finally {
    await limpiar([e.id])
  }
})
