/**
 * La lectura USB tal como la entrega el agente (agente/afix_usb/lectura.py) y lo que la app
 * interpreta de ella. Puro a propósito: el texto de antecedentes, los avisos de contexto y
 * la comparación ingreso/salida se prueban sin equipo.
 *
 * Regla del plan §2: un `null` es "No informado por el equipo". Nunca se rellena.
 */

export type TipoRegistro = 'panic' | 'reinicio_forzado' | 'stacks' | 'reset_counter' | 'jetsam'
export type NivelLectura = 'emparejado' | 'sin_confianza' | 'recuperacion'

export type EventoEstabilidad = {
  tipo: TipoRegistro
  nombre: string
  fecha: string | null
  bugType: string | null
  resumen: string
  causaProbable: string | null
  lineaChecklist: string | null
  sensores: string[]
  texto: string
  sha256: string | null
}

export type ConteoRegistros = Record<TipoRegistro, number>

export type Estabilidad = {
  leidoEn: string
  registrosDesde: string | null
  archivosRevisados: number
  conteos: ConteoRegistros
  ultimos7Dias: ConteoRegistros
  eventos: EventoEstabilidad[]
}

export type EstadoBuscarMiIphone = 'activo' | 'inactivo' | 'no_concluyente' | null

export type Pieza = { clave: string; nombre: string; serie: string | null }

export type Lectura = {
  version: number
  leidoEn: string
  nivel: NivelLectura
  identidad: {
    productType: string | null
    claseEquipo: string | null
    numeroModelo: string | null
    region: string | null
    imei: string | null
    imei2: string | null
    numeroSerie: string | null
    ecid: string | null
    udid: string | null
    nombreEquipo: string | null
    colorCodigo: string | null
    colorCarcasa: string | null
    capacidad: string | null
  }
  sistema: { ios: string | null; build: string | null; baseband: string | null }
  seguridad: {
    activacion: string | null
    codigoConfigurado: boolean | null
    buscarMiIphone: {
      estado: EstadoBuscarMiIphone
      asociado: boolean | null
      bloqueoActivacion: boolean | null
      cuentaEnmascarada: string | null
    }
  }
  bateria: {
    saludPct: number | null
    ciclos: number | null
    capacidadDisenoMah: number | null
    capacidadActualMah: number | null
    cargaPct: number | null
    cargando: boolean | null
    voltajeMv: number | null
    serie: string | null
  } | null
  carga: {
    conectado: boolean | null
    descripcion: string | null
    watts: number | null
    voltajeMv: number | null
    corrienteMa: number | null
    inalambrico: boolean | null
  } | null
  almacenamiento: { totalBytes: number | null; libreBytes: number | null; pctLibre: number | null } | null
  red: {
    operador: string | null
    sim: string | null
    bandeja: string | null
    macWifi: string | null
    macBluetooth: string | null
  }
  piezas: Pieza[]
  reloj: { horaEquipo: string | null; desfaseSegundos: number | null; zona: string | null }
  estabilidad: Estabilidad | null
  avisos: string[]
}

export const NO_INFORMADO = 'No informado por el equipo'

/** Los que cuentan como falla de estabilidad. La falta de memoria es de apps, no del equipo. */
export const TIPOS_FALLA: readonly TipoRegistro[] = ['panic', 'reinicio_forzado', 'stacks', 'reset_counter']

const NOMBRE_TIPO: Record<TipoRegistro, [singular: string, plural: string]> = {
  panic: ['pánico del kernel', 'pánicos del kernel'],
  reinicio_forzado: ['reinicio forzado', 'reinicios forzados'],
  stacks: ['bloqueo de sistema', 'bloqueos de sistema'],
  reset_counter: ['registro de reinicios', 'registros de reinicios'],
  jetsam: ['cierre por falta de memoria', 'cierres por falta de memoria'],
}

export function nombreTipo(tipo: TipoRegistro, cantidad = 1): string {
  return NOMBRE_TIPO[tipo][cantidad === 1 ? 0 : 1]
}

export type Gravedad = 'Alta' | 'Media' | 'Baja'

/** Alta: el equipo se colgó. Media: algo del sistema dejó de responder. Baja: apps, no hardware. */
const GRAVEDAD: Record<TipoRegistro, Gravedad> = {
  panic: 'Alta',
  reinicio_forzado: 'Alta',
  stacks: 'Media',
  reset_counter: 'Media',
  jetsam: 'Baja',
}

export function gravedad(tipo: TipoRegistro): Gravedad {
  return GRAVEDAD[tipo]
}

// Qué parte del sistema nombra el motivo de un bloqueo, en palabras del taller.
const PARTES_DEL_SISTEMA: [RegExp, string][] = [
  [/bluetooth|btaudio/i, 'audio Bluetooth'],
  [/backboardd|springboard/i, 'pantalla de inicio'],
  [/camera|cámara/i, 'cámara'],
  [/wifi|wi-fi/i, 'Wi-Fi'],
  [/audio|mediaserverd/i, 'audio'],
  [/baseband|commcenter/i, 'red celular'],
  [/touch|hid/i, 'táctil'],
]

type RegistroBreve = { tipo: TipoRegistro; resumen: string }

/**
 * El motivo de un registro dicho para el cliente: "iOS cerró apps por falta de memoria; la
 * que más memoria usaba era TikTok". Sale de lo que ya está guardado, así sirve también
 * para registros viejos.
 */
export function motivoRegistro(r: RegistroBreve): string {
  if (r.tipo === 'reinicio_forzado') return 'El equipo quedó pegado y se forzó el reinicio con los botones'
  if (r.tipo === 'jetsam') {
    const app = r.resumen.match(/proceso más grande:\s*(.+)$/i)?.[1]?.trim()
    return app && app !== 'no informado'
      ? `iOS cerró apps por falta de memoria; la que más memoria usaba era ${app}`
      : 'iOS cerró apps por falta de memoria'
  }
  if (r.tipo === 'stacks') {
    const parte = PARTES_DEL_SISTEMA.find(([patron]) => patron.test(r.resumen))?.[1]
    return `El sistema dejó de responder${parte ? ` (${parte})` : ''}: ${r.resumen}`
  }
  return r.resumen
}

/** "5 fallas (3 reinicios forzados, 2 bloqueos de sistema) y 7 cierres por falta de memoria". */
export function resumenRegistros(registros: RegistroBreve[]): string {
  const cuenta = (tipo: TipoRegistro) => registros.filter((r) => r.tipo === tipo).length
  const fallas = TIPOS_FALLA.filter((t) => cuenta(t) > 0).map((t) => `${cuenta(t)} ${nombreTipo(t, cuenta(t))}`)
  const totalFallas = TIPOS_FALLA.reduce((suma, t) => suma + cuenta(t), 0)
  const memoria = cuenta('jetsam')
  const partes: string[] = []
  partes.push(totalFallas === 0 ? '0 fallas' : `${totalFallas} ${totalFallas === 1 ? 'falla' : 'fallas'} (${fallas.join(', ')})`)
  if (memoria > 0) partes.push(`${memoria} ${nombreTipo('jetsam', memoria)}`)
  return partes.join(' y ')
}

// Todas las fechas se muestran en la hora de Chile, que es donde está el taller.
const ZONA = 'America/Santiago'

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fechaHora(iso: string): string {
  return `${fechaCorta(iso)} ${horaCorta(iso)}`
}

/** "3 reinicios forzados (05-10-2026, 18:31, 23:23 y 23:58)": fechas agrupadas por día. */
function detalleFechas(eventos: EventoEstabilidad[]): string {
  const porDia = new Map<string, string[]>()
  for (const e of [...eventos].filter((e) => e.fecha).sort((a, b) => a.fecha!.localeCompare(b.fecha!))) {
    const dia = fechaCorta(e.fecha!)
    porDia.set(dia, [...(porDia.get(dia) ?? []), horaCorta(e.fecha!)])
  }
  const partes = [...porDia].map(([dia, horas]) => {
    const lista = horas.length > 1 ? `${horas.slice(0, -1).join(', ')} y ${horas.at(-1)}` : horas[0]
    return `${dia}, ${lista}`
  })
  return partes.join('; ')
}

/**
 * El texto automático de antecedentes para el comprobante (plan §3.7). Nunca dice "sin
 * fallas" a secas: iOS borra los registros antiguos, así que dice desde cuándo hay.
 */
export function textoAntecedentes(e: Estabilidad): string {
  const desde = e.registrosDesde ? ` (registros disponibles desde el ${fechaCorta(e.registrosDesde)})` : ''
  const encabezado = `Antecedentes leídos por USB el ${fechaHora(e.leidoEn)}${desde}`
  const fallas = e.eventos.filter((ev) => TIPOS_FALLA.includes(ev.tipo))
  if (fallas.length === 0) {
    const desdeCuando = e.registrosDesde ? ` desde el ${fechaCorta(e.registrosDesde)}` : ''
    return `${encabezado}: sin fallas de estabilidad registradas en el equipo${desdeCuando}.`
  }
  const partes = TIPOS_FALLA.map((tipo) => {
    const delTipo = fallas.filter((ev) => ev.tipo === tipo)
    if (delTipo.length === 0) return tipo === 'panic' ? `0 ${nombreTipo('panic', 0)}` : null
    const motivo = tipo === 'stacks' && delTipo.length === 1 ? `, ${delTipo[0].resumen}` : ''
    return `${delTipo.length} ${nombreTipo(tipo, delTipo.length)} (${detalleFechas(delTipo)}${motivo})`
  }).filter(Boolean)
  return `${encabezado}: ${partes.join(', ')}.`
}

/**
 * Lo que explica un "se pega" sin falla de placa (plan §3.7), más el reloj del iPhone, del
 * que salen todas las fechas de los registros.
 */
export function avisosDeContexto(l: Lectura): string[] {
  const avisos: string[] = []
  const salud = l.bateria?.saludPct
  if (salud != null && salud < 80) {
    const ciclos = l.bateria?.ciclos != null ? ` con ${l.bateria.ciclos} ciclos` : ''
    avisos.push(`Batería ${salud} %${ciclos}: iOS puede estar limitando el rendimiento.`)
  }
  const libre = l.almacenamiento?.pctLibre
  if (libre != null && libre < 5) avisos.push(`Almacenamiento casi lleno (${libre} % libre): el sistema se pone lento.`)
  const desfase = l.reloj.desfaseSegundos
  if (desfase != null && Math.abs(desfase) > 300) {
    const minutos = Math.round(Math.abs(desfase) / 60)
    avisos.push(
      `El reloj del iPhone está ${minutos} min ${desfase > 0 ? 'adelantado' : 'atrasado'}: las fechas de los registros salen de ese reloj.`,
    )
  }
  return avisos
}

export function textoBuscarMiIphone(b: Lectura['seguridad']['buscarMiIphone']): string {
  const cuenta = b.cuentaEnmascarada ? ` (cuenta ${b.cuentaEnmascarada})` : ''
  if (b.estado === 'activo') return `Activo${cuenta}`
  if (b.estado === 'inactivo') return 'Inactivo'
  if (b.estado === 'no_concluyente') return `No concluyente${cuenta}: revisar en Ajustes del iPhone`
  return NO_INFORMADO
}

export type DiferenciaPieza = {
  clave: string
  nombre: string
  ingreso: string | null
  salida: string | null
  /** cambio: las dos series existen y son distintas. */
  estado: 'igual' | 'cambio' | 'sin_dato'
  /** El cambio está en una pieza que se declaró como trabajada. */
  esperado: boolean
}

/** Mapea cada pieza leída por USB al trabajo de la ficha que la justifica si cambia. */
export const TRABAJO_DE_PIEZA: Record<string, string> = {
  bateria: 'Batería',
  pantalla: 'Pantalla',
  camara_principal: 'Cámara trasera',
  camara_ultra: 'Cámara trasera',
  camara_tele: 'Cámara trasera',
  camara_frontal: 'Cámara frontal',
  faceid_ir: 'Cámara frontal',
  faceid_proyector: 'Cámara frontal',
  placa: 'Placa',
}

/**
 * Compara las series de piezas del ingreso contra la salida (plan §3.4, punto 2): un
 * cambio en una pieza que no se trabajó es alerta roja; en una que sí, es la prueba.
 */
export function compararPiezas(ingreso: Pieza[], salida: Pieza[], trabajos: string[]): DiferenciaPieza[] {
  const deSalida = new Map(salida.map((p) => [p.clave, p]))
  const claves = [...new Set([...ingreso.map((p) => p.clave), ...salida.map((p) => p.clave)])]
  return claves.map((clave) => {
    const a = ingreso.find((p) => p.clave === clave)
    const b = deSalida.get(clave)
    const serieA = a?.serie ?? null
    const serieB = b?.serie ?? null
    const estado = serieA === null || serieB === null ? 'sin_dato' : serieA === serieB ? 'igual' : 'cambio'
    return {
      clave,
      nombre: a?.nombre ?? b?.nombre ?? clave,
      ingreso: serieA,
      salida: serieB,
      estado,
      esperado: trabajos.includes(TRABAJO_DE_PIEZA[clave] ?? ''),
    }
  })
}

/** Fallas registradas después de una fecha: en la salida, "nuevas desde el ingreso". */
export function fallasDesde(e: Estabilidad | null, desde: Date): EventoEstabilidad[] {
  if (!e) return []
  return e.eventos.filter((ev) => TIPOS_FALLA.includes(ev.tipo) && ev.fecha !== null && new Date(ev.fecha) > desde)
}
