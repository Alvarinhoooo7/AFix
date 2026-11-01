import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { guardarAjustes, leerAjustes } from '@/datos/ajustes'
import { clausulasActivas, clausulasDeFicha, crearVersionClausulas, textoClausula } from '@/datos/clausulas'
import { historialPorIdentificadores } from '@/datos/equipos'
import {
  buscar,
  cambiarEstado,
  cerrarFicha,
  crearFicha,
  guardarLecturaSalida,
  guardarVigilancia,
  obtenerFicha,
  registrosDeFicha,
} from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { clausula, equipo, ficha, registroEquipo } from '@/db/esquema'
import { evento, ingresoMinimo, lecturaDePrueba } from '../ayudas'

const creadas: number[] = []
const equipos = new Set<string>()

async function nueva(...args: Parameters<typeof crearFicha>) {
  const f = await crearFicha(...args)
  creadas.push(f.numero)
  equipos.add(f.equipoId)
  return f
}

afterAll(async () => {
  const db = obtenerDb()
  for (const numero of creadas) await db.delete(registroEquipo).where(eq(registroEquipo.fichaNumero, numero))
  for (const numero of creadas) await db.delete(ficha).where(eq(ficha.numero, numero))
  for (const id of equipos) await db.delete(equipo).where(eq(equipo.id, id))
  await db.delete(clausula).where(eq(clausula.version, 2))
})

test('el ingreso con lectura USB guarda la lectura, la identidad y los registros', async () => {
  const lectura = lecturaDePrueba()
  const f = await nueva({
    ...ingresoMinimo({ imei: lectura.identidad.imei, numeroSerie: lectura.identidad.numeroSerie, origenDatos: 'usb' }),
    lectura,
    identidad: { udid: lectura.identidad.udid, ecid: lectura.identidad.ecid, numeroModelo: 'MQ593BE/A', region: 'BE/A' },
    accesorios: [{ nombre: 'Funda' }, { nombre: 'Otro', detalle: 'Pop socket' }],
    codigoEntregado: false,
    clausulasVersion: 1,
    garantiaMeses: 3,
  })
  expect(f.estado).toBe('recibido')
  expect(f.lecturaIngreso?.identidad.productType).toBe('iPhone14,8')
  expect(f.accesorios).toHaveLength(2)
  expect(f.build).toBe('24A446')
  expect(f.estadoActivacion).toBe('Activated')

  const [e] = await obtenerDb().select().from(equipo).where(eq(equipo.id, f.equipoId))
  expect(e.udid).toBe(lectura.identidad.udid)
  expect(e.numeroModelo).toBe('MQ593BE/A')

  const registros = await registrosDeFicha(f.numero)
  expect(registros).toHaveLength(5)
  expect(registros.every((r) => r.momento === 'ingreso')).toBe(true)
  expect(registros.filter((r) => r.tipo === 'reinicio_forzado')).toHaveLength(3)
})

test('un equipo sin IMEI se reconoce por número de serie, UDID o ECID', async () => {
  const primera = await nueva({ ...ingresoMinimo({ numeroSerie: 'IPADWIFI01' }), identidad: { ecid: '777' } })
  const porSerie = await nueva(ingresoMinimo({ numeroSerie: 'ipadwifi01' }))
  const porEcid = await nueva({ ...ingresoMinimo(), identidad: { ecid: '777' } })
  expect(porSerie.equipoId).toBe(primera.equipoId)
  expect(porEcid.equipoId).toBe(primera.equipoId)

  const historial = await historialPorIdentificadores({ ecid: '777' })
  expect(historial.map((h) => h.numero)).toEqual([porEcid.numero, porSerie.numero, primera.numero])
  expect(await historialPorIdentificadores({})).toEqual([])
})

test('el camino del taller anota cuándo pasó por cada estado', async () => {
  const f = await nueva(ingresoMinimo())
  const enReparacion = await cambiarEstado(f.numero, 'en_reparacion')
  expect(enReparacion.estado).toBe('en_reparacion')
  expect(enReparacion.enReparacionEn).not.toBeNull()
  const listo = await cambiarEstado(f.numero, 'listo')
  expect(listo.listoEn).not.toBeNull()
  await expect(cambiarEstado(f.numero, 'recibido')).rejects.toThrow(/no puede pasar/)
  const cerrada = await cerrarFicha(f.numero, 'entregado')
  expect(cerrada.estado).toBe('entregado')
  await expect(cambiarEstado(f.numero, 'en_reparacion')).rejects.toThrow(/congelada/)
})

test('la salida guarda batería y solo los registros nuevos', async () => {
  const f = await nueva({ ...ingresoMinimo(), lectura: lecturaDePrueba() })
  const salida = lecturaDePrueba({ bateria: { ...lecturaDePrueba().bateria!, saludPct: 100, ciclos: 0 } })
  salida.estabilidad!.eventos.push(evento('panic', '/panic-full-2026-11-03-101010.ips', '2026-11-03T10:10:10-03:00', 'panic(cpu 0)'))
  const g = await guardarLecturaSalida(f.numero, salida)
  expect(g.bateriaSalidaPct).toBe(100)
  expect(g.bateriaSalidaCiclos).toBe(0)
  const registros = await registrosDeFicha(f.numero)
  expect(registros.filter((r) => r.momento === 'salida').map((r) => r.tipo)).toEqual(['panic'])
  // Repetir la lectura no duplica.
  await guardarLecturaSalida(f.numero, salida)
  expect(await registrosDeFicha(f.numero)).toHaveLength(registros.length)
})

test('la vigilancia guarda su resultado y sus fallas', async () => {
  const f = await nueva(ingresoMinimo())
  const resultado = { minutos: 25, fallas: 1, desconexiones: 1, terminadaEn: '2026-11-03T13:00:00.000Z' }
  await guardarVigilancia(f.numero, resultado, [evento('stacks', '/stacks-2026-11-03-125000.ips', '2026-11-03T12:50:00-03:00', 'x')])
  expect((await obtenerFicha(f.numero))?.vigilanciaSalida).toEqual(resultado)
  expect((await registrosDeFicha(f.numero))[0].momento).toBe('vigilancia')
})

test('se busca por teléfono con o sin prefijo', async () => {
  const f = await nueva(ingresoMinimo({ telefono: '+56 9 8765 4321' }))
  expect((await buscar('987654321')).some((r) => r.numero === f.numero)).toBe(true)
  expect((await buscar('+56 9 8765 4321')).some((r) => r.numero === f.numero)).toBe(true)
})

test('las cláusulas v1 vienen sembradas y editar crea una versión nueva', async () => {
  const v1 = await clausulasActivas()
  expect(v1.version).toBe(1)
  expect(v1.clausulas).toHaveLength(9)
  expect(v1.clausulas[8].titulo).toBe('Antecedentes de fallas')
  expect(textoClausula(v1.clausulas[7].texto, 6)).toContain('garantía de 6 meses')

  const version = await crearVersionClausulas([{ titulo: 'Única', texto: 'Texto nuevo' }, { titulo: ' ', texto: 'sin título' }])
  expect(version).toBe(2)
  expect((await clausulasActivas()).clausulas).toEqual([{ orden: 1, titulo: 'Única', texto: 'Texto nuevo' }])
  // La versión vieja no se toca: una ficha que aceptó la 1 la sigue viendo.
  expect((await clausulasDeFicha(1))?.clausulas).toHaveLength(9)
  expect(await clausulasDeFicha(null)).toBeNull()
  await expect(crearVersionClausulas([])).rejects.toThrow()
})

test('los ajustes guardan los datos nuevos del taller y la garantía', async () => {
  const antes = await leerAjustes()
  expect(antes.garantiaMeses).toBe(3)
  await guardarAjustes({ ...antes, rut: ' 76.123.456-7 ', correo: 'taller@ejemplo.cl', garantiaMeses: 6 })
  const despues = await leerAjustes()
  expect(despues.rut).toBe('76.123.456-7')
  expect(despues.garantiaMeses).toBe(6)
  await guardarAjustes({ ...antes })
})
