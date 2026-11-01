import postgres from 'postgres'
import { afterAll, expect, test } from 'vitest'
import { catalogoActivo, catalogoPorVersion, todosLosCatalogos } from '@/datos/catalogo'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
afterAll(() => sql.end())

// La versión 2 (migración 0010) es la activa. Las pruebas que insertan versiones nuevas
// usan la 3 y solo borran la 3.
const PRUEBA = 3

test('la versión activa es la 2 del plan: 16 de funcionamiento y 11 de estado físico', async () => {
  const { version, lineas } = await catalogoActivo()
  expect(version).toBe(2)
  expect(lineas.filter((l) => l.bloque === 'funcionamiento')).toHaveLength(16)
  expect(lineas.filter((l) => l.bloque === 'condicion')).toHaveLength(11)
})

test('las líneas de funcionamiento tienen los tres estados', async () => {
  const { lineas } = await catalogoActivo()
  for (const linea of lineas.filter((l) => l.bloque === 'funcionamiento')) {
    expect(linea.estados).toEqual(['Bien', 'Falla', 'No probado'])
  }
})

test('cada línea de estado físico tiene sus propios estados', async () => {
  const { lineas } = await catalogoActivo()
  expect(lineas.find((l) => l.clave === 'vidrio_pantalla')!.estados).toEqual([
    'Sano',
    'Rayas leves',
    'Rayas profundas',
    'Trizado',
    'Quebrado',
  ])
  expect(lineas.find((l) => l.clave === 'indicador_humedad')!.estados).toEqual(['Sin indicio', 'Activado', 'No visible'])
  expect(lineas.find((l) => l.clave === 'imagen_pantalla')!.estados).toContain('No verificable')
})

test('las líneas vienen ordenadas y con sus etiquetas', async () => {
  const { lineas } = await catalogoActivo()
  const ordenes = lineas.map((l) => l.orden)
  expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b))
  expect(lineas[0].etiqueta).toBe('Pantalla y táctil')
  expect(lineas.find((l) => l.clave === 'llamada')!.etiqueta).toBe('Llamada (auricular y micrófono)')
})

test('la versión 1 sigue intacta para las fichas viejas', async () => {
  const { version, lineas } = await catalogoPorVersion(1)
  expect(version).toBe(1)
  expect(lineas).toHaveLength(17)
  expect(lineas.find((l) => l.clave === 'indicador_humedad')!.estados).toEqual(['Sin indicio', 'Activado'])
  await expect(catalogoPorVersion(999)).rejects.toThrow(/999/)
})

test('una versión nueva que reutiliza una clave no cambia la etiqueta de las anteriores', async () => {
  try {
    await sql`insert into catalogo_checklist (version, clave, etiqueta, bloque, orden, estados)
      values (${PRUEBA}, 'face_id', 'Reconocimiento facial', 'funcionamiento', 1, '["Bien","Falla"]'::jsonb)`
    const v1 = await catalogoPorVersion(1)
    const faceId = v1.lineas.find((l) => l.clave === 'face_id')!
    expect(faceId.etiqueta).toBe('Face ID')
    expect(faceId.estados).toEqual(['Bien', 'Falla', 'No probado'])
    const nueva = await catalogoPorVersion(PRUEBA)
    expect(nueva.lineas[0].etiqueta).toBe('Reconocimiento facial')
  } finally {
    await sql`delete from catalogo_checklist where version = ${PRUEBA}`
  }
})

test('una versión nueva pasa a ser la activa y todosLosCatalogos las trae todas', async () => {
  try {
    await sql`insert into catalogo_checklist (version, clave, etiqueta, bloque, orden, estados)
      values (${PRUEBA}, 'linea_nueva', 'Línea nueva', 'funcionamiento', 1, '["Bien","Falla"]'::jsonb)`
    expect((await catalogoActivo()).version).toBe(PRUEBA)
    expect((await catalogoPorVersion(1)).lineas).toHaveLength(17)
    const todos = await todosLosCatalogos()
    expect(todos.map((c) => c.version)).toEqual([1, 2, PRUEBA])
  } finally {
    await sql`delete from catalogo_checklist where version = ${PRUEBA}`
  }
})
