import { expect, test } from 'vitest'
import {
  avisosDeContexto,
  compararPiezas,
  fallasDesde,
  gravedad,
  motivoRegistro,
  resumenRegistros,
  textoAntecedentes,
  textoBuscarMiIphone,
  type Estabilidad,
} from '@/dominio/lectura'
import { evento, lecturaDePrueba } from '../ayudas'

test('el texto de antecedentes agrupa por tipo y por día, como en el plan', () => {
  const texto = textoAntecedentes(lecturaDePrueba().estabilidad!)
  expect(texto).toBe(
    'Antecedentes leídos por USB el 01-11-2026 19:12 (registros disponibles desde el 05-10-2026): ' +
      '0 pánicos del kernel, ' +
      '3 reinicios forzados (05-10-2026, 18:31, 23:23 y 23:58), ' +
      '1 bloqueo de sistema (30-10-2026, 06:52, BTAudioPlugin start condition timed out).',
  )
})

test('sin fallas nunca dice "sin fallas" a secas: dice desde cuándo hay registros', () => {
  const base = lecturaDePrueba().estabilidad!
  const limpio: Estabilidad = { ...base, eventos: base.eventos.filter((e) => e.tipo === 'jetsam') }
  expect(textoAntecedentes(limpio)).toMatch(/sin fallas de estabilidad registradas en el equipo desde el 05-10-2026\.$/)
})

test('los avisos de contexto explican un "se pega" sin falla de placa', () => {
  expect(avisosDeContexto(lecturaDePrueba())).toEqual([
    'Batería 78 % con 1176 ciclos: iOS puede estar limitando el rendimiento.',
  ])
  const lleno = lecturaDePrueba({
    almacenamiento: { totalBytes: 128e9, libreBytes: 3e9, pctLibre: 2.3 },
    reloj: { horaEquipo: null, desfaseSegundos: -1200, zona: null },
  })
  expect(avisosDeContexto(lleno)).toContain('Almacenamiento casi lleno (2.3 % libre): el sistema se pone lento.')
  expect(avisosDeContexto(lleno).at(-1)).toMatch(/20 min atrasado/)
})

test('Buscar mi iPhone muestra la cuenta enmascarada', () => {
  const b = lecturaDePrueba().seguridad.buscarMiIphone
  expect(textoBuscarMiIphone(b)).toBe('Activo (cuenta a•••••@ejemplo.com)')
  expect(textoBuscarMiIphone({ ...b, estado: null })).toBe('No informado por el equipo')
})

test('comparar piezas distingue el cambio esperado del sospechoso', () => {
  const ingreso = lecturaDePrueba().piezas
  const salida = ingreso.map((p) =>
    p.clave === 'bateria' ? { ...p, serie: 'NUEVA' } : p.clave === 'pantalla' ? { ...p, serie: 'OTRA' } : p,
  )
  const diferencias = compararPiezas(ingreso, salida, ['Batería'])
  const bateria = diferencias.find((d) => d.clave === 'bateria')!
  const pantalla = diferencias.find((d) => d.clave === 'pantalla')!
  expect(bateria).toMatchObject({ estado: 'cambio', esperado: true })
  expect(pantalla).toMatchObject({ estado: 'cambio', esperado: false })
  expect(diferencias.find((d) => d.clave === 'placa')!.estado).toBe('igual')
})

test('una pieza sin serie en un lado no se marca como cambio', () => {
  const [d] = compararPiezas([{ clave: 'bateria', nombre: 'Batería', serie: null }], [{ clave: 'bateria', nombre: 'Batería', serie: 'X' }], [])
  expect(d.estado).toBe('sin_dato')
})

test('el motivo de cada registro se dice en palabras del taller', () => {
  expect(motivoRegistro({ tipo: 'jetsam', resumen: 'Falta de memoria; proceso más grande: TikTok' })).toBe(
    'iOS cerró apps por falta de memoria; la que más memoria usaba era TikTok',
  )
  expect(motivoRegistro({ tipo: 'jetsam', resumen: 'Falta de memoria; proceso más grande: no informado' })).toBe(
    'iOS cerró apps por falta de memoria',
  )
  expect(motivoRegistro({ tipo: 'stacks', resumen: 'BTAudioPlugin start condition timed out' })).toBe(
    'El sistema dejó de responder (audio Bluetooth): BTAudioPlugin start condition timed out',
  )
  expect(motivoRegistro({ tipo: 'reinicio_forzado', resumen: 'Reinicio forzado con los botones' })).toMatch(/quedó pegado/)
  expect(motivoRegistro({ tipo: 'panic', resumen: 'panic(cpu 0): Missing sensor(s): mic1' })).toBe('panic(cpu 0): Missing sensor(s): mic1')
})

test('la gravedad separa lo que es del equipo de lo que es de las apps', () => {
  expect(gravedad('panic')).toBe('Alta')
  expect(gravedad('reinicio_forzado')).toBe('Alta')
  expect(gravedad('stacks')).toBe('Media')
  expect(gravedad('jetsam')).toBe('Baja')
})

test('el resumen de registros cuenta fallas y faltas de memoria por separado', () => {
  const eventos = lecturaDePrueba().estabilidad!.eventos
  expect(resumenRegistros(eventos)).toBe(
    '4 fallas (3 reinicios forzados, 1 bloqueo de sistema) y 1 cierre por falta de memoria',
  )
  expect(resumenRegistros(eventos.filter((e) => e.tipo === 'jetsam'))).toBe('0 fallas y 1 cierre por falta de memoria')
  expect(resumenRegistros([])).toBe('0 fallas')
})

test('fallas desde una fecha ignoran la falta de memoria', () => {
  const e = lecturaDePrueba().estabilidad!
  e.eventos.push(evento('panic', '/panic-full-2026-11-03-101010.ips', '2026-11-03T10:10:10-03:00'))
  const nuevas = fallasDesde(e, new Date('2026-11-01T00:00:00-03:00'))
  expect(nuevas.map((n) => n.tipo)).toEqual(['panic'])
  expect(fallasDesde(null, new Date())).toEqual([])
})
