export type DecisionVinculacion =
  | { tipo: 'asignar' }
  | { tipo: 'fusionar'; equipoDestinoId: string }
  | { tipo: 'conflicto'; equipoDestinoId: string; motivo: string }

/** Deja solo los 15 dígitos del IMEI; devuelve null si lo escrito no es un IMEI. */
export function normalizarImei(bruto: string): string | null {
  const limpio = bruto.replace(/[\s-]/g, '')
  return /^\d{15}$/.test(limpio) ? limpio : null
}

/**
 * Decide qué hacer cuando aparece un IMEI para un equipo que ya existía sin él.
 * Nunca fusiona sola si el destino tiene una ficha abierta: mezclaría dos historias
 * reales, así que devuelve conflicto y la decisión sube a la interfaz.
 */
export function decidirVinculacion(
  equipoActual: { id: string },
  equipoConEseImei: { id: string; tieneFichaAbierta: boolean } | null,
): DecisionVinculacion {
  if (!equipoConEseImei || equipoConEseImei.id === equipoActual.id) return { tipo: 'asignar' }
  if (equipoConEseImei.tieneFichaAbierta) {
    return {
      tipo: 'conflicto',
      equipoDestinoId: equipoConEseImei.id,
      motivo: 'Ese IMEI ya pertenece a otro equipo que tiene una ficha abierta en el taller.',
    }
  }
  return { tipo: 'fusionar', equipoDestinoId: equipoConEseImei.id }
}
