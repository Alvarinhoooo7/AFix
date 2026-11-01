import postgres from 'postgres'
import { afterAll, expect, test } from 'vitest'
import { catalogoActivo, catalogoPorVersion, claveDeEtiqueta, crearVersionCatalogo } from '@/datos/catalogo'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
afterAll(async () => {
  await sql`delete from catalogo_checklist where version > 2`
  await sql.end()
})

test('la clave de una línea nueva sale de su etiqueta', () => {
  expect(claveDeEtiqueta('Lentes de cámara')).toBe('lentes_de_camara')
  expect(claveDeEtiqueta('  Wi-Fi y señal ')).toBe('wi_fi_y_senal')
})

test('editar el checklist crea una versión nueva y la anterior no cambia', async () => {
  const activo = await catalogoActivo()
  const lineas = [
    ...activo.lineas.map((l) => (l.clave === 'face_id' ? { ...l, etiqueta: 'Face ID / Touch ID' } : l)),
    { etiqueta: 'Lector de huella', bloque: 'funcionamiento' as const, estados: ['Bien', 'Falla', 'No probado', 'Bien'] },
  ]
  const version = await crearVersionCatalogo(lineas)
  expect(version).toBe(activo.version + 1)
  const nueva = await catalogoActivo()
  expect(nueva.lineas.find((l) => l.clave === 'face_id')!.etiqueta).toBe('Face ID / Touch ID')
  expect(nueva.lineas.at(-1)).toMatchObject({ clave: 'lector_de_huella', estados: ['Bien', 'Falla', 'No probado'] })
  expect((await catalogoPorVersion(activo.version)).lineas.find((l) => l.clave === 'face_id')!.etiqueta).toBe('Face ID')
})

test('rechaza líneas sin estados suficientes o con claves repetidas', async () => {
  await expect(crearVersionCatalogo([{ etiqueta: 'Sola', bloque: 'funcionamiento', estados: ['Bien'] }])).rejects.toThrow(/dos estados/)
  await expect(
    crearVersionCatalogo([
      { etiqueta: 'Carga', bloque: 'funcionamiento', estados: ['Bien', 'Falla'] },
      { etiqueta: 'carga', bloque: 'funcionamiento', estados: ['Bien', 'Falla'] },
    ]),
  ).rejects.toThrow(/misma clave/)
  await expect(crearVersionCatalogo([])).rejects.toThrow()
})
