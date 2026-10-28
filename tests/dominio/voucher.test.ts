import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { guardarAjustes, leerAjustes } from '@/datos/ajustes'
import { actualizarFicha, cerrarFicha, crearFicha, datosVoucher } from '@/datos/fichas'
import { obtenerDb } from '@/db/cliente'
import { equipo, ficha } from '@/db/esquema'
import { ingresoMinimo } from '../ayudas'

const db = obtenerDb()
const creadas: number[] = []
const equiposCreados = new Set<string>()
let numeroReparada = 0
let numeroSinReparar = 0

beforeAll(async () => {
  const reparada = await crearFicha(
    ingresoMinimo({
      modeloComercial: 'iPhone 12',
      capacidad: '128 GB',
      iosVersion: '17.5.1',
      bateriaPct: 79,
      bateriaCiclos: 743,
      pidioCliente: 'Cambiar batería',
      observacionIngreso: 'Face ID ya venía sin funcionar',
      checklistIngreso: {
        pantalla_tactil: { estado: 'Bien' },
        face_id: { estado: 'Falla', nota: 'Ya venía así' },
      },
    }),
  )
  creadas.push(reparada.numero)
  equiposCreados.add(reparada.equipoId)
  await actualizarFicha(reparada.numero, {
    trabajosRealizados: ['Batería'],
    notaReparacion: 'Nota interna del técnico que no debe salir en el voucher',
    bateriaSalidaPct: 100,
    bateriaSalidaCiclos: 0,
    checklistSalida: {
      pantalla_tactil: { estado: 'Bien' },
      face_id: { estado: 'Falla' },
    },
    observacionSalida: 'Se entrega funcionando con batería nueva',
  })
  await cerrarFicha(reparada.numero, 'entregado')
  numeroReparada = reparada.numero

  const sinReparar = await crearFicha(
    ingresoMinimo({
      modeloComercial: 'iPhone 11',
      bateriaPct: 82,
      bateriaCiclos: 610,
      pidioCliente: 'Revisar placa',
      observacionIngreso: 'Equipo no enciende',
    }),
  )
  creadas.push(sinReparar.numero)
  equiposCreados.add(sinReparar.equipoId)
  await cerrarFicha(sinReparar.numero, 'entregado_sin_reparar')
  numeroSinReparar = sinReparar.numero
})

afterAll(async () => {
  for (const n of creadas) {
    await db.delete(ficha).where(eq(ficha.numero, n))
  }
  for (const id of equiposCreados) {
    await db.delete(equipo).where(eq(equipo.id, id))
  }
  await (db.$client as { end: () => Promise<void> }).end()
})

test('el voucher trae los dos checklists con las líneas de su versión', async () => {
  const v = await datosVoucher(numeroReparada)
  expect(v.lineas).toHaveLength(17)
  expect(v.checklistIngreso).toBeDefined()
  expect(v.checklistSalida).toBeDefined()
  expect(v.bateria.comparable).toBe(true)
  expect(v.bateria.pctDelta).toBe(21)
  expect(v.bateria.ciclosDelta).toBe(-743)
})

test('el voucher no expone la nota de reparación ni lo que pidió el cliente ni garantía', async () => {
  const v = await datosVoucher(numeroReparada)
  expect(v).not.toHaveProperty('notaReparacion')
  expect(v).not.toHaveProperty('pidioCliente')
  expect(v).not.toHaveProperty('garantia')
})

test('el voucher funciona sin logo cargado', async () => {
  const semilla = await leerAjustes()
  try {
    await guardarAjustes({ nombre: 'AFIX', telefono: null, direccion: null, rutaLogo: null })
    const v = await datosVoucher(numeroReparada)
    expect(v.taller.nombre).toBe('AFIX')
    expect(v.taller.rutaLogo).toBeNull()
  } finally {
    await guardarAjustes(semilla)
  }
})

test('una ficha entregada sin reparar no muestra comparación de batería inventada', async () => {
  const v = await datosVoucher(numeroSinReparar)
  expect(v.bateria.comparable).toBe(false)
})
