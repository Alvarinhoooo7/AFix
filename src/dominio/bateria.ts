export type LecturaBateria = {
  pct: number | null
  ciclos: number | null
}

export type ComparacionBateria = {
  pctDelta: number | null
  ciclosDelta: number | null
  comparable: boolean
}

/**
 * Compara la batería medida al ingreso contra la de salida.
 * Si falta algún lado completo, comparable es false para no inventar números en el voucher.
 */
export function compararBateria(ingreso: LecturaBateria, salida: LecturaBateria): ComparacionBateria {
  const pctDelta = ingreso.pct !== null && salida.pct !== null ? salida.pct - ingreso.pct : null
  const ciclosDelta = ingreso.ciclos !== null && salida.ciclos !== null ? salida.ciclos - ingreso.ciclos : null
  const comparable = pctDelta !== null || ciclosDelta !== null
  return { pctDelta, ciclosDelta, comparable }
}
