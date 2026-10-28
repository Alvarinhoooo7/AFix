import { expect, test } from 'vitest'
import { validarChecklist, type LineaCatalogo } from '@/dominio/checklist'

const lineas: LineaCatalogo[] = [
  { clave: 'face_id', etiqueta: 'Face ID', bloque: 'funcionamiento', orden: 1, estados: ['Bien', 'Falla', 'No probado'] },
]

test('validarChecklist rechaza un estado que no existe en la línea', () => {
  expect(validarChecklist({ face_id: { estado: 'Rayado' } }, lineas)).toEqual(['face_id'])
})

test('validarChecklist rechaza una clave que no está en el catálogo', () => {
  expect(validarChecklist({ otra: { estado: 'Bien' } }, lineas)).toEqual(['otra'])
})

test('validarChecklist acepta un estado válido', () => {
  expect(validarChecklist({ face_id: { estado: 'Bien', nota: 'ok' } }, lineas)).toEqual([])
})

test('validarChecklist acepta un checklist vacío', () => {
  expect(validarChecklist({}, [])).toEqual([])
})
