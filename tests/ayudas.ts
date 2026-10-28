import type { DrizzleDb } from '@/db/cliente'
import type { DatosIngreso } from '@/dominio/ficha'

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
