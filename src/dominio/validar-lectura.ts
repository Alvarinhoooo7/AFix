import type { Lectura } from '@/dominio/lectura'

/**
 * La lectura viaja del navegador al servidor dentro del ingreso. Se revisa la forma antes
 * de guardarla: lo que no parezca una lectura del agente se descarta (el ingreso sigue
 * siendo válido sin ella).
 */
export function esLectura(valor: unknown): valor is Lectura {
  if (!valor || typeof valor !== 'object') return false
  const l = valor as Record<string, unknown>
  return (
    l.version === 1 &&
    typeof l.leidoEn === 'string' &&
    ['emparejado', 'sin_confianza', 'recuperacion'].includes(String(l.nivel)) &&
    typeof l.identidad === 'object' &&
    l.identidad !== null &&
    typeof l.sistema === 'object' &&
    typeof l.seguridad === 'object' &&
    Array.isArray(l.piezas) &&
    Array.isArray(l.avisos) &&
    (l.estabilidad === null || (typeof l.estabilidad === 'object' && Array.isArray((l.estabilidad as { eventos?: unknown }).eventos)))
  )
}
