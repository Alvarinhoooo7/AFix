import { expect, test } from 'vitest'
import type { Ficha } from '@/datos/equipos'
import { estaCongelada, transicionPermitida } from '@/dominio/ficha'

test('solo se puede cerrar desde en_taller', () => {
  expect(transicionPermitida('en_taller', 'entregado')).toBe(true)
  expect(transicionPermitida('en_taller', 'entregado_sin_reparar')).toBe(true)
  expect(transicionPermitida('entregado', 'en_taller')).toBe(false)
  expect(transicionPermitida('entregado', 'entregado_sin_reparar')).toBe(false)
  expect(transicionPermitida('entregado_sin_reparar', 'entregado')).toBe(false)
  expect(transicionPermitida('en_taller', 'en_taller')).toBe(false)
})

test('una ficha está congelada cuando tiene congelada_en', () => {
  expect(estaCongelada({ congeladaEn: null } as Ficha)).toBe(false)
  expect(estaCongelada({ congeladaEn: new Date() } as Ficha)).toBe(true)
})
