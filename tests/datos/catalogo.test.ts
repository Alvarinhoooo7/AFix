import postgres from 'postgres'
import { afterAll, expect, test } from 'vitest'
import { catalogoActivo, catalogoPorVersion, todosLosCatalogos } from '@/datos/catalogo'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
afterAll(() => sql.end())

test('la versión activa trae las 17 líneas del diseño', async () => {
  const { version, lineas } = await catalogoActivo()
  expect(version).toBe(1)
  expect(lineas.filter((l) => l.bloque === 'funcionamiento')).toHaveLength(13)
  expect(lineas.filter((l) => l.bloque === 'condicion')).toHaveLength(4)
})

test('las líneas de funcionamiento tienen los tres estados', async () => {
  const { lineas } = await catalogoActivo()
  const faceId = lineas.find((l) => l.clave === 'face_id')!
  expect(faceId.estados).toEqual(['Bien', 'Falla', 'No probado'])
})

test('cada línea de condición tiene sus propios estados', async () => {
  const { lineas } = await catalogoActivo()
  expect(lineas.find((l) => l.clave === 'apertura_previa')!.estados).toEqual(['Sin señales', 'Con señales'])
  expect(lineas.find((l) => l.clave === 'indicador_humedad')!.estados).toEqual(['Sin indicio', 'Activado'])
  expect(lineas.find((l) => l.clave === 'vidrio_trasero')!.estados).toEqual(['Sano', 'Rayado', 'Trizado'])
  expect(lineas.find((l) => l.clave === 'chasis')!.estados).toEqual(['Sano', 'Golpes', 'Doblado'])
})

test('las líneas vienen ordenadas y con sus etiquetas', async () => {
  const { lineas } = await catalogoActivo()
  const ordenes = lineas.map((l) => l.orden)
  expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b))
  expect(lineas[0].etiqueta).toBe('Pantalla y táctil')
  expect(lineas.find((l) => l.clave === 'wifi_senal')!.etiqueta).toBe('Wi-Fi y señal')
})

test('catalogoPorVersion devuelve la versión pedida y falla si no existe', async () => {
  const { version, lineas } = await catalogoPorVersion(1)
  expect(version).toBe(1)
  expect(lineas).toHaveLength(17)
  await expect(catalogoPorVersion(999)).rejects.toThrow(/999/)
})

test('una versión nueva que reutiliza una clave no cambia la etiqueta de la versión 1', async () => {
  try {
    await sql`insert into catalogo_checklist (version, clave, etiqueta, bloque, orden, estados)
      values (2, 'face_id', 'Reconocimiento facial', 'funcionamiento', 1, '["Bien","Falla"]'::jsonb)`
    const v1 = await catalogoPorVersion(1)
    const faceId = v1.lineas.find((l) => l.clave === 'face_id')!
    expect(faceId.etiqueta).toBe('Face ID')
    expect(faceId.estados).toEqual(['Bien', 'Falla', 'No probado'])
    const v2 = await catalogoPorVersion(2)
    expect(v2.lineas[0].etiqueta).toBe('Reconocimiento facial')
  } finally {
    await sql`delete from catalogo_checklist where version = 2`
  }
})

test('una versión nueva no altera la vieja y todosLosCatalogos trae ambas', async () => {
  try {
    await sql`insert into catalogo_checklist (version, clave, etiqueta, bloque, orden, estados)
      values (2, 'linea_nueva', 'Línea nueva', 'funcionamiento', 1, '["Bien","Falla"]'::jsonb)`
    expect((await catalogoActivo()).version).toBe(2)
    const v1 = await catalogoPorVersion(1)
    expect(v1.lineas).toHaveLength(17)
    const todos = await todosLosCatalogos()
    expect(todos.map((c) => c.version)).toEqual([1, 2])
  } finally {
    await sql`delete from catalogo_checklist where version = 2`
  }
})
