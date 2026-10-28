import { expect, test } from 'vitest'
import { cargarTablaModelos } from '@/datos/modelos'
import { resolverModelo } from '@/dominio/modelos-iphone'

test('la tabla sembrada resuelve iPhone13,2 a iPhone 12', async () => {
  const tabla = await cargarTablaModelos()
  expect(resolverModelo('iPhone13,2', tabla)).toEqual({ modeloComercial: 'iPhone 12', requiereConfirmacion: false })
})

test('la semilla cubre de iPhone 8 en adelante', async () => {
  const tabla = await cargarTablaModelos()
  expect(tabla.get('iPhone10,1')).toBe('iPhone 8')
  expect(tabla.get('iPhone14,2')).toBe('iPhone 13 Pro')
  expect(tabla.get('iPhone16,2')).toBe('iPhone 15 Pro Max')
})

test('un modelo posterior a la semilla no falla: queda por confirmar', async () => {
  const tabla = await cargarTablaModelos()
  expect(resolverModelo('iPhone99,1', tabla)).toEqual({ modeloComercial: 'iPhone99,1', requiereConfirmacion: true })
})

test('ningún nombre comercial queda vacío', async () => {
  const tabla = await cargarTablaModelos()
  expect(tabla.size).toBeGreaterThan(0)
  for (const [codigo, nombre] of tabla) {
    expect(codigo).toMatch(/^iPhone\d+,\d+$/)
    expect(nombre.trim()).not.toBe('')
  }
})
