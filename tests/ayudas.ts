import type { DrizzleDb } from '@/db/cliente'
import type { DatosIngreso } from '@/dominio/ficha'
import type { EventoEstabilidad, Lectura } from '@/dominio/lectura'

/**
 * Una lectura como la del iPhone 14 Plus de pruebas (1 de noviembre de 2026), con
 * identificadores ficticios: 3 reinicios forzados, 1 bloqueo y batería al 78 %.
 */
export function lecturaDePrueba(cambios: Partial<Lectura> = {}): Lectura {
  const eventos: EventoEstabilidad[] = [
    evento('stacks', '/Retired/stacks-2026-10-30-065249.ips', '2026-10-30T06:52:49-03:00', 'BTAudioPlugin start condition timed out'),
    evento('reinicio_forzado', '/ForceResetTailspins/tailspin-trace_reset_2026-10-05-235825.tailspin', '2026-10-05T23:58:25-03:00'),
    evento('reinicio_forzado', '/ForceResetTailspins/tailspin-trace_reset_2026-10-05-232339.tailspin', '2026-10-05T23:23:39-03:00'),
    evento('reinicio_forzado', '/ForceResetTailspins/tailspin-trace_reset_2026-10-05-183111.tailspin', '2026-10-05T18:31:11-03:00'),
    evento('jetsam', '/JetsamEvent-2026-11-01-111639.ips', '2026-11-01T11:16:39-03:00', 'Falta de memoria; proceso más grande: AppDePrueba'),
  ]
  return {
    version: 1,
    leidoEn: '2026-11-01T22:12:00+00:00',
    nivel: 'emparejado',
    identidad: {
      productType: 'iPhone14,8',
      claseEquipo: 'iPhone',
      numeroModelo: 'MQ593BE/A',
      region: 'BE/A',
      imei: '356000000000001',
      imei2: '356000000000002',
      numeroSerie: 'FICTICIO0001',
      ecid: '1',
      udid: '00000000-0000000000000001',
      nombreEquipo: 'iPhone de pruebas',
      colorCodigo: '1',
      colorCarcasa: null,
      capacidad: '512 GB',
    },
    sistema: { ios: '27.0.1', build: '24A446', baseband: '3.00.01' },
    seguridad: {
      activacion: 'Activated',
      codigoConfigurado: false,
      buscarMiIphone: { estado: 'activo', asociado: true, bloqueoActivacion: true, cuentaEnmascarada: 'a•••••@ejemplo.com' },
    },
    bateria: {
      saludPct: 78,
      ciclos: 1176,
      capacidadDisenoMah: 4325,
      capacidadActualMah: 3393,
      cargaPct: 42,
      cargando: true,
      voltajeMv: 4009,
      serie: 'FICTBAT0001',
    },
    carga: { conectado: true, descripcion: 'pd charger', watts: 15, voltajeMv: 5000, corrienteMa: 3000, inalambrico: false },
    almacenamiento: { totalBytes: 512_000_000_000, libreBytes: 347_677_700_096, pctLibre: 67.9 },
    red: { operador: 'Claro', sim: 'Sin SIM', bandeja: 'Bandeja puesta', macWifi: '00:00:00:00:00:01', macBluetooth: '00:00:00:00:00:02' },
    piezas: [
      { clave: 'placa', nombre: 'Placa (MLB)', serie: 'MLBFICTICIO0001' },
      { clave: 'bateria', nombre: 'Batería', serie: 'FICTBAT0001' },
      { clave: 'pantalla', nombre: 'Pantalla', serie: 'FICTPAN0001' },
      { clave: 'camara_principal', nombre: 'Cámara trasera principal', serie: 'FICTCAM0001' },
      { clave: 'camara_frontal', nombre: 'Cámara frontal', serie: 'FICTCAM0002' },
    ],
    reloj: { horaEquipo: '2026-11-01T22:12:03+00:00', desfaseSegundos: 3, zona: 'America/Santiago' },
    estabilidad: {
      leidoEn: '2026-11-01T22:12:00+00:00',
      registrosDesde: '2026-10-05T18:31:11-03:00',
      archivosRevisados: 353,
      conteos: { panic: 0, reinicio_forzado: 3, stacks: 1, reset_counter: 0, jetsam: 1 },
      ultimos7Dias: { panic: 0, reinicio_forzado: 0, stacks: 1, reset_counter: 0, jetsam: 1 },
      eventos,
    },
    avisos: [],
    ...cambios,
  }
}

export function evento(
  tipo: EventoEstabilidad['tipo'],
  nombre: string,
  fecha: string | null,
  resumen = 'Reinicio forzado con los botones',
): EventoEstabilidad {
  return {
    tipo,
    nombre,
    fecha,
    bugType: null,
    resumen,
    causaProbable: null,
    lineaChecklist: null,
    sensores: [],
    texto: `texto original de ${nombre}`,
    sha256: tipo === 'reinicio_forzado' ? null : 'a'.repeat(64),
  }
}

/**
 * El equipo apagado: sin IMEI, sin modelo, sin datos del USB y con el checklist sin
 * probar. Es un ingreso completamente válido, no uno incompleto.
 */
export function ingresoVacio(): DatosIngreso {
  return {
    imei: null,
    numeroSerie: null,
    modeloProducto: null,
    modeloComercial: '',
    capacidad: null,
    iosVersion: null,
    bateriaPct: null,
    bateriaCiclos: null,
    pidioCliente: '',
    quienLoTrajo: null,
    telefono: null,
    observacionIngreso: '',
    checklistIngreso: {},
    catalogoVersion: 1,
    origenDatos: 'manual',
  }
}

export function ingresoMinimo(overrides: Partial<DatosIngreso> = {}): DatosIngreso {
  return { ...ingresoVacio(), ...overrides }
}

/** Una base que rechaza toda consulta, sin importar cómo se encadene. */
export function baseCaida(): DrizzleDb {
  const error = new Error('La base de datos no responde.')
  const caida: unknown = new Proxy(function () {}, {
    get: (_destino, propiedad) =>
      propiedad === 'then' ? (_resolver: unknown, rechazar: (e: Error) => void) => rechazar(error) : caida,
    apply: () => caida,
  })
  return caida as DrizzleDb
}
