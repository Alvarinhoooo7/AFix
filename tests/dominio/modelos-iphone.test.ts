import { describe, expect, test } from 'vitest'
import { resolverModelo } from '@/dominio/modelos-iphone'

const tabla = new Map([
  ['iPhone13,2', 'iPhone 12'],
  ['iPhone10,1', 'iPhone 8'],
])

describe('resolverModelo', () => {
  test('un ProductType conocido resuelve al nombre comercial', () => {
    expect(resolverModelo('iPhone13,2', tabla)).toEqual({ modeloComercial: 'iPhone 12', requiereConfirmacion: false })
  })

  test('un ProductType desconocido devuelve el código crudo y pide confirmación', () => {
    expect(resolverModelo('iPhone99,1', tabla)).toEqual({ modeloComercial: 'iPhone99,1', requiereConfirmacion: true })
  })

  test('sin ProductType pide confirmación y no inventa modelo', () => {
    expect(resolverModelo(null, tabla)).toEqual({ modeloComercial: '', requiereConfirmacion: true })
  })

  test('un ProductType vacío o solo espacios se trata como ausente', () => {
    expect(resolverModelo('', tabla)).toEqual({ modeloComercial: '', requiereConfirmacion: true })
    expect(resolverModelo('   ', tabla)).toEqual({ modeloComercial: '', requiereConfirmacion: true })
  })

  test('ignora espacios alrededor del código', () => {
    expect(resolverModelo(' iPhone13,2\n', tabla)).toEqual({ modeloComercial: 'iPhone 12', requiereConfirmacion: false })
  })

  test('con una tabla vacía nada falla: todo queda por confirmar', () => {
    expect(resolverModelo('iPhone13,2', new Map())).toEqual({ modeloComercial: 'iPhone13,2', requiereConfirmacion: true })
  })
})
