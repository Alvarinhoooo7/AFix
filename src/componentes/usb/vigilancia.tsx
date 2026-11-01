'use client'

import { useEffect, useRef, useState } from 'react'
import { fechaHora, nombreTipo, type EventoEstabilidad } from '@/dominio/lectura'
import type { ResultadoVigilancia } from '@/dominio/ficha'

type Estado = 'detenida' | 'vigilando' | 'desconectado' | 'error'

/**
 * Vigilancia en vivo durante las pruebas físicas de salida (plan §3.7): cualquier pánico,
 * bloqueo o reinicio nuevo aparece en rojo en el momento. Si el iPhone se desconecta (un
 * pánico lo reinicia), se espera a que vuelva y se revisa qué dejó.
 */
export function Vigilancia({
  udid,
  alTerminar,
}: {
  udid: string
  alTerminar: (resultado: ResultadoVigilancia, eventos: EventoEstabilidad[]) => void
}) {
  const [estado, setEstado] = useState<Estado>('detenida')
  const [minutos, setMinutos] = useState(0)
  const [fallas, setFallas] = useState<EventoEstabilidad[]>([])
  const [mensaje, setMensaje] = useState<string | null>(null)
  const fuente = useRef<EventSource | null>(null)
  const desconexiones = useRef(0)
  const registro = useRef({ minutos: 0, fallas: [] as EventoEstabilidad[] })

  useEffect(() => () => fuente.current?.close(), [])

  function empezar() {
    setFallas([])
    setMinutos(0)
    setMensaje(null)
    desconexiones.current = 0
    registro.current = { minutos: 0, fallas: [] }
    const es = new EventSource(`/api/agente/equipos/${encodeURIComponent(udid)}/vigilancia`)
    fuente.current = es
    setEstado('vigilando')
    es.addEventListener('latido', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { minutos: number }
      registro.current.minutos = d.minutos
      setMinutos(d.minutos)
    })
    es.addEventListener('falla', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { minutos: number; evento: EventoEstabilidad }
      registro.current.fallas = [...registro.current.fallas, d.evento]
      setFallas(registro.current.fallas)
    })
    es.addEventListener('desconectado', (e) => {
      desconexiones.current += 1
      setEstado('desconectado')
      setMensaje((JSON.parse((e as MessageEvent).data) as { mensaje: string }).mensaje)
    })
    es.addEventListener('reconectado', () => {
      setEstado('vigilando')
      setMensaje('El iPhone volvió. Se revisan los registros que haya dejado.')
    })
    es.addEventListener('problema', (e) => {
      setMensaje((JSON.parse((e as MessageEvent).data) as { mensaje: string }).mensaje)
      setEstado('error')
      es.close()
    })
    // Un corte con el agente no se reintenta solo: reconectar empezaría otra línea base y
    // se perderían las fallas del medio. Se avisa y se vuelve a empezar a mano.
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED || fuente.current !== es) return
      es.close()
      setEstado('error')
      setMensaje('Se cortó la conexión con el agente USB. Lo registrado hasta aquí se guarda al terminar.')
    }
  }

  function terminar() {
    fuente.current?.close()
    fuente.current = null
    setEstado('detenida')
    alTerminar(
      {
        minutos: registro.current.minutos,
        fallas: registro.current.fallas.length,
        desconexiones: desconexiones.current,
        terminadaEn: new Date().toISOString(),
      },
      registro.current.fallas,
    )
  }

  const activa = estado === 'vigilando' || estado === 'desconectado'
  const conDatos = estado === 'error' && registro.current.minutos > 0

  return (
    <div className={fallas.length > 0 ? 'tarjeta tarjeta-alerta' : activa ? 'tarjeta tarjeta-verificado' : 'tarjeta'}>
      <h3 className="tarjeta-titulo">Vigilancia en vivo</h3>
      <div className="vigilancia">
        <span className="vigilancia-contador">
          {activa ? <span className="punto-vivo" aria-hidden="true" /> : null}
          {minutos.toFixed(1)} min
        </span>
        <span className={fallas.length > 0 ? 'texto-alerta' : 'texto-verificado'} aria-live="polite">
          {fallas.length === 0 ? '0 fallas' : `${fallas.length} ${fallas.length === 1 ? 'falla' : 'fallas'}`}
        </span>
        {activa || conDatos ? (
          <button type="button" className="boton" onClick={terminar}>
            Terminar vigilancia
          </button>
        ) : (
          <button type="button" className="boton-secundario" onClick={empezar}>
            Empezar vigilancia
          </button>
        )}
      </div>
      {mensaje ? <p className={estado === 'desconectado' || estado === 'error' ? 'texto-alerta' : 'nota'}>{mensaje}</p> : null}
      {fallas.length > 0 ? (
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
          {fallas.map((f) => (
            <li key={f.nombre} className="texto-alerta">
              {f.fecha ? fechaHora(f.fecha) : ''} {nombreTipo(f.tipo)}: {f.causaProbable ?? f.resumen}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="nota">Déjala corriendo mientras pruebas cámara, llamadas, carga y juegos. 20 a 30 minutos es una buena prueba.</p>
    </div>
  )
}
