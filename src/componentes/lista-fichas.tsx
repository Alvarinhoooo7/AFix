import Link from 'next/link'
import type { FilaInicio } from '@/datos/fichas'
import { ETIQUETA_ESTADO } from '@/dominio/ficha'

const DIA_MS = 24 * 60 * 60 * 1000

export function etiquetaEstado(estado: FilaInicio['estado']): string {
  return ETIQUETA_ESTADO[estado]
}

function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Cuánto lleva el equipo en la mesa, en palabras: lo que se pregunta al ver la lista de pendientes. */
function antiguedad(recibidoEn: Date, ahora: Date): string {
  const dias = Math.floor((ahora.getTime() - recibidoEn.getTime()) / DIA_MS)
  if (dias <= 0) return 'Llegó hoy'
  if (dias === 1) return 'Lleva 1 día'
  return `Lleva ${dias} días`
}

/**
 * Renglones de talonario. En `pendientes` la columna derecha dice cuánto lleva el equipo
 * en taller; en `historial`, el estado y la fecha en que se cerró o se recibió.
 */
export function ListaFichas({
  filas,
  vacio,
  modo,
}: {
  filas: FilaInicio[]
  vacio: string
  modo: 'pendientes' | 'historial'
}) {
  if (filas.length === 0) {
    return <p className="nota">{vacio}</p>
  }
  const ahora = new Date()
  return (
    <div className="lista-fichas">
      {filas.map((fila) => {
        const numero = String(fila.numero).padStart(4, '0')
        const detalles = [
          fila.quienLoTrajo ? `Traído por ${fila.quienLoTrajo}` : null,
          fila.imei ? `IMEI ${fila.imei}` : null,
          fila.trabajos.length > 0 ? fila.trabajos.join(', ') : null,
        ]
          .filter(Boolean)
          .join(' — ')

        return (
          <Link key={fila.numero} href={`/fichas/${fila.numero}`} className="fila-inicio">
            <span className="fila-inicio-ficha">Ficha {numero}</span>
            <div className="fila-inicio-cuerpo">
              <div className="fila-inicio-modelo">{fila.modeloComercial}</div>
              {detalles ? <div className="fila-inicio-meta">{detalles}</div> : null}
            </div>
            {modo === 'pendientes' ? (
              <div className="fila-inicio-estado">
                <span className={`marca-estado marca-estado-${fila.estado}`}>{etiquetaEstado(fila.estado)}</span>
                <span>{antiguedad(fila.recibidoEn, ahora)}</span>
                <span className="fila-inicio-meta">Recibido el {fechaCorta(fila.recibidoEn)}</span>
              </div>
            ) : (
              <div className="fila-inicio-estado">
                <span className={`marca-estado marca-estado-${fila.estado}`}>{etiquetaEstado(fila.estado)}</span>
                <span className="fila-inicio-meta">{fechaCorta(fila.entregadoEn ?? fila.recibidoEn)}</span>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
