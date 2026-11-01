import { expect, test } from 'vitest'
import { enlaceWhatsapp, mensajeDocumento, telefonoWhatsapp } from '@/dominio/whatsapp'

test('normaliza celulares chilenos para wa.me', () => {
  expect(telefonoWhatsapp('+56 9 8765 4321')).toBe('56987654321')
  expect(telefonoWhatsapp('9 8765 4321')).toBe('56987654321')
  expect(telefonoWhatsapp('987654321')).toBe('56987654321')
  expect(telefonoWhatsapp('+54 9 11 2345 6789')).toBe('5491123456789')
})

test('un número que no es celular no arma enlace', () => {
  expect(telefonoWhatsapp('22 345 6789')).toBeNull()
  expect(telefonoWhatsapp('')).toBeNull()
  expect(telefonoWhatsapp(null)).toBeNull()
  expect(enlaceWhatsapp('123', 'hola')).toBeNull()
})

test('el enlace lleva el texto codificado', () => {
  expect(enlaceWhatsapp('987654321', 'Hola Ana, ficha 0052')).toBe('https://wa.me/56987654321?text=Hola%20Ana%2C%20ficha%200052')
})

test('el mensaje saluda por el nombre y nombra la ficha', () => {
  expect(mensajeDocumento('ingreso', 52, 'AFIX', 'Ana Pérez')).toBe(
    'Hola Ana, te enviamos el comprobante de ingreso de tu equipo (ficha 0052). Guárdalo para retirarlo. AFIX.',
  )
  expect(mensajeDocumento('salida', 7, null, null)).toMatch(/^Hola, te enviamos el informe de entrega .*ficha 0007/)
})
