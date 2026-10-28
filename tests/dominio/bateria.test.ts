import { expect, test } from 'vitest'
import { compararBateria } from '@/dominio/bateria'

test('compara porcentaje y ciclos', () => {
  const c = compararBateria({ pct: 79, ciclos: 743 }, { pct: 100, ciclos: 0 })
  expect(c).toEqual({ pctDelta: 21, ciclosDelta: -743, comparable: true })
})

test('sin datos de un lado no es comparable', () => {
  expect(compararBateria({ pct: null, ciclos: null }, { pct: 100, ciclos: 0 })).toEqual({
    pctDelta: null,
    ciclosDelta: null,
    comparable: false,
  })
  expect(compararBateria({ pct: 79, ciclos: 743 }, { pct: null, ciclos: null })).toEqual({
    pctDelta: null,
    ciclosDelta: null,
    comparable: false,
  })
})

test('si solo hay porcentaje en ambos lados, compara el porcentaje y deja ciclos en null', () => {
  expect(compararBateria({ pct: 81, ciclos: null }, { pct: 100, ciclos: null })).toEqual({
    pctDelta: 19,
    ciclosDelta: null,
    comparable: true,
  })
})
