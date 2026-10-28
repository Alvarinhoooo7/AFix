import postgres from 'postgres'
import { afterAll, expect, test } from 'vitest'
import { obtenerDb } from '@/db/cliente'
import { ajustesTaller } from '@/db/esquema'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
afterAll(() => sql.end())

for (const rol of ['anon', 'authenticated']) {
  for (const tabla of ['equipo', 'ficha', 'ajustes_taller', 'catalogo_checklist']) {
    test(`el rol ${rol} no puede leer ${tabla}`, async () => {
      await expect(
        sql.begin(async (tx) => {
          await tx.unsafe(`set local role ${rol}`)
          await tx.unsafe(`select * from ${tabla}`)
        }),
      ).rejects.toThrow(/permission denied/)
    })
  }
}

test('el rol duenio que usa la app sigue leyendo con RLS activado', async () => {
  const filas = await obtenerDb().select().from(ajustesTaller)
  expect(filas[0].nombre).toBe('AFIX')
})
