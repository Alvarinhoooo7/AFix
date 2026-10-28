import { expect, test } from 'vitest'
import { decidirVinculacion, normalizarImei } from '@/dominio/equipo'

test('normalizarImei limpia separadores', () => {
  expect(normalizarImei(' 35 872109-447 3321 ')).toBe('358721094473321')
})

test('normalizarImei devuelve null si no son 15 dígitos', () => {
  expect(normalizarImei('12345')).toBeNull()
  expect(normalizarImei('no se ve')).toBeNull()
  expect(normalizarImei('')).toBeNull()
  expect(normalizarImei('3587210944733210')).toBeNull()
  expect(normalizarImei('35872109447332a')).toBeNull()
})

test('un IMEI nuevo se asigna al equipo actual', () => {
  expect(decidirVinculacion({ id: 'a' }, null)).toEqual({ tipo: 'asignar' })
})

test('un IMEI que ya existe sin ficha abierta propone fusionar', () => {
  const d = decidirVinculacion({ id: 'a' }, { id: 'b', tieneFichaAbierta: false })
  expect(d).toEqual({ tipo: 'fusionar', equipoDestinoId: 'b' })
})

test('un IMEI que ya existe con ficha abierta es conflicto, no fusión', () => {
  const d = decidirVinculacion({ id: 'a' }, { id: 'b', tieneFichaAbierta: true })
  expect(d.tipo).toBe('conflicto')
  expect(d).toMatchObject({ equipoDestinoId: 'b' })
})

test('si el IMEI ya pertenece al mismo equipo no hay nada que fusionar', () => {
  expect(decidirVinculacion({ id: 'a' }, { id: 'a', tieneFichaAbierta: true })).toEqual({ tipo: 'asignar' })
})
