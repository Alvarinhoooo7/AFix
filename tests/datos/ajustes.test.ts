import { afterAll, expect, test } from 'vitest'
import { guardarAjustes, leerAjustes } from '@/datos/ajustes'
import { obtenerDb } from '@/db/cliente'
import { ajustesTaller } from '@/db/esquema'

const db = obtenerDb()
afterAll(async () => {
  // Cierra la conexión del proceso de la prueba.
  await (db.$client as { end: () => Promise<void> }).end()
})

test('los ajustes arrancan con AFIX y sin logo', async () => {
  const a = await leerAjustes()
  expect(a.nombre).toBe('AFIX')
  expect(a.telefono).toBeNull()
  expect(a.direccion).toBeNull()
  expect(a.rutaLogo).toBeNull()
})

test('guardar y volver a leer conserva los datos', async () => {
  const semilla = await leerAjustes()
  try {
    await guardarAjustes({
      nombre: 'AFIX',
      telefono: '+56 9 1234 5678',
      direccion: 'Taller 1',
      rutaLogo: null,
    })
    const a = await leerAjustes()
    expect(a.telefono).toBe('+56 9 1234 5678')
    expect(a.direccion).toBe('Taller 1')
    expect(a.rutaLogo).toBeNull()
  } finally {
    await guardarAjustes(semilla)
  }
})

test('un campo que llega vacío se guarda como nulo, no como texto vacío', async () => {
  const semilla = await leerAjustes()
  try {
    await guardarAjustes({ nombre: 'AFIX', telefono: '   ', direccion: '', rutaLogo: '' })
    const a = await leerAjustes()
    expect(a.telefono).toBeNull()
    expect(a.direccion).toBeNull()
    expect(a.rutaLogo).toBeNull()
  } finally {
    await guardarAjustes(semilla)
  }
})

test('guardar no agrega una segunda fila de ajustes', async () => {
  const semilla = await leerAjustes()
  try {
    await guardarAjustes({ ...semilla, direccion: 'Taller 2' })
    expect(await db.select().from(ajustesTaller)).toHaveLength(1)
  } finally {
    await guardarAjustes(semilla)
  }
})
