import Link from 'next/link'

export type ItemHistorialEquipo = {
  numero: number
  trabajos: string[]
  entregadoEn: Date | string
}

function formatearFecha(fecha: Date | string): string {
  const instancia = typeof fecha === 'string' ? new Date(fecha) : fecha
  return instancia.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Franja informativa cuando el IMEI ingresado ya registra pasos previos por el taller.
 * Es un aviso, no un desvío: informa y ofrece abrir la ficha anterior sin bloquear el ingreso nuevo.
 */
export function AvisoEquipoConocido({ historial }: { historial: ItemHistorialEquipo[] }) {
  if (historial.length === 0) return null
  const ultima = historial[0]
  const numeroFormateado = String(ultima.numero).padStart(4, '0')
  const resumenTrabajos =
    ultima.trabajos.length > 0 ? ultima.trabajos.join(', ') : 'Sin trabajos registrados'

  return (
    <aside className="franja-equipo-conocido" aria-label="Equipo con historial en el taller">
      <div className="franja-equipo-conocido-cuerpo">
        <p className="franja-equipo-conocido-titulo">Ya pasó por el taller.</p>
        <p className="franja-equipo-conocido-detalle">
          Ficha {numeroFormateado}, {resumenTrabajos.toLowerCase()}, {formatearFecha(ultima.entregadoEn)}.
          {historial.length > 1 ? ` Registra ${historial.length} ingresos en total.` : ''}
        </p>
      </div>
      <Link className="boton-secundario" href={`/fichas/${ultima.numero}`}>
        Abrir ficha {numeroFormateado}
      </Link>
    </aside>
  )
}
