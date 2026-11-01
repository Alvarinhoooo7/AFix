import { expect, test } from 'vitest'
import type { Ficha } from '@/datos/equipos'
import { estaCongelada, transicionPermitida, vencimientoGarantia } from '@/dominio/ficha'

test('el camino del taller: recibido, en reparación, listo', () => {
  expect(transicionPermitida('recibido', 'en_reparacion')).toBe(true)
  expect(transicionPermitida('en_reparacion', 'listo')).toBe(true)
  expect(transicionPermitida('recibido', 'listo')).toBe(true)
  // Si falla la prueba de salida, vuelve a reparación.
  expect(transicionPermitida('listo', 'en_reparacion')).toBe(true)
  expect(transicionPermitida('listo', 'recibido')).toBe(false)
})

test('se cierra desde cualquier estado abierto', () => {
  for (const abierto of ['recibido', 'en_reparacion', 'listo'] as const) {
    expect(transicionPermitida(abierto, 'entregado')).toBe(true)
    expect(transicionPermitida(abierto, 'entregado_sin_reparar')).toBe(true)
  }
})

test('una ficha cerrada no vuelve a abrirse ni cambia de cierre', () => {
  expect(transicionPermitida('entregado', 'recibido')).toBe(false)
  expect(transicionPermitida('entregado', 'entregado_sin_reparar')).toBe(false)
  expect(transicionPermitida('entregado_sin_reparar', 'entregado')).toBe(false)
  expect(transicionPermitida('recibido', 'recibido')).toBe(false)
})

test('una ficha está congelada cuando tiene congelada_en', () => {
  expect(estaCongelada({ congeladaEn: null } as Ficha)).toBe(false)
  expect(estaCongelada({ congeladaEn: new Date() } as Ficha)).toBe(true)
})

test('la garantía vence en meses calendario desde la entrega', () => {
  expect(vencimientoGarantia(new Date(2026, 10, 1), 3)).toEqual(new Date(2027, 1, 1))
  // 30 de noviembre + 3 meses: febrero no tiene 30, queda en el último día.
  expect(vencimientoGarantia(new Date(2026, 10, 30), 3)).toEqual(new Date(2027, 1, 28))
  expect(vencimientoGarantia(new Date(2026, 10, 1), 0)).toEqual(new Date(2026, 10, 1))
})
