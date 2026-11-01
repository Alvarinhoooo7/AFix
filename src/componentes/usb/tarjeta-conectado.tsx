'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ItemHistorialEquipo } from '@/componentes/aviso-equipo-conocido'
import { ESTADOS_ABIERTOS, ETIQUETA_ESTADO } from '@/dominio/ficha'
import { resolverModelo } from '@/dominio/modelos-iphone'
import { consultarHistorial } from '@/app/ingreso/acciones'
import { TEXTO_ESTADO_AGENTE, useAgente, type EquipoConectado } from './agente'

function TarjetaEquipo({ equipo, tabla }: { equipo: EquipoConectado; tabla: Map<string, string> }) {
  const [historial, setHistorial] = useState<ItemHistorialEquipo[] | null>(null)
  useEffect(() => {
    let vigente = true
    consultarHistorial({ imei: equipo.imei, numeroSerie: equipo.numeroSerie, udid: equipo.udid, ecid: equipo.ecid }).then(
      (h) => vigente && setHistorial(h),
    )
    return () => {
      vigente = false
    }
  }, [equipo.imei, equipo.numeroSerie, equipo.udid, equipo.ecid])

  const nombre = resolverModelo(equipo.productType ?? null, tabla).modeloComercial || 'Equipo Apple'
  const abierta = historial?.find((h) => h.estado && ESTADOS_ABIERTOS.includes(h.estado))
  const ultima = historial?.[0]

  return (
    <section className="tarjeta tarjeta-conectado" aria-label="Equipo conectado">
      <div>
        <span className="punto-vivo" aria-hidden="true" />
        <strong>{nombre}</strong>
        {equipo.ios ? <span className="texto-secundario"> · iOS {equipo.ios}</span> : null}
        <div className="nota" style={{ margin: 0 }}>
          {equipo.nivel === 'emparejado' ? 'Confía en este PC: lectura completa.' : 'Sin confianza: desbloquéalo y toca «Confiar» para leerlo completo.'}{' '}
          {historial === null
            ? ''
            : abierta
              ? `Tiene la ficha ${String(abierta.numero).padStart(4, '0')} abierta (${ETIQUETA_ESTADO[abierta.estado!].toLowerCase()}).`
              : ultima
                ? `Ya pasó por el taller: ficha ${String(ultima.numero).padStart(4, '0')}.`
                : 'Primera vez en el taller.'}
        </div>
      </div>
      <div className="acciones">
        {abierta ? (
          <Link className="boton" href={`/fichas/${abierta.numero}/entrega`}>
            Leer para entrega
          </Link>
        ) : (
          <Link className="boton" href={`/ingreso?udid=${encodeURIComponent(equipo.udid)}`}>
            Nuevo ingreso con este equipo
          </Link>
        )}
        {abierta ? (
          <Link className="boton-secundario" href={`/fichas/${abierta.numero}`}>
            Abrir ficha
          </Link>
        ) : ultima ? (
          <Link className="boton-secundario" href={`/fichas/${ultima.numero}`}>
            Ver ficha anterior
          </Link>
        ) : null}
      </div>
    </section>
  )
}

/** La tarjeta del panel que aparece sola al enchufar un iPhone (plan §7.1). */
export function EquiposConectados({ tablaModelos }: { tablaModelos: Record<string, string> }) {
  const tabla = useMemo(() => new Map(Object.entries(tablaModelos)), [tablaModelos])
  const { estado, equipos } = useAgente()
  if (equipos.length === 0) {
    return <p className={estado === 'sin_agente' || estado === 'sin_servicio_apple' ? 'nota texto-alerta' : 'nota'}>{TEXTO_ESTADO_AGENTE[estado]}</p>
  }
  return (
    <div>
      {equipos.map((e) => (
        <TarjetaEquipo key={e.udid} equipo={e} tabla={tabla} />
      ))}
    </div>
  )
}
