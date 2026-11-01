'use client'

import { useEffect, useState } from 'react'
import type { Lectura } from '@/dominio/lectura'

/** Lo mínimo de un equipo conectado, sin emparejar: sale de lockdown (plan §3.3). */
export type EquipoConectado = {
  udid: string
  nivel: 'emparejado' | 'sin_confianza' | 'sin_respuesta'
  productType?: string | null
  nombre?: string | null
  ios?: string | null
  numeroSerie?: string | null
  imei?: string | null
  ecid?: string | null
  mensaje?: string
}

export type EstadoAgente = 'conectando' | 'activo' | 'sin_agente' | 'sin_servicio_apple'

type Respuesta<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

async function pedir<T>(ruta: string, metodo: 'GET' | 'POST' | 'DELETE' = 'GET'): Promise<Respuesta<T>> {
  try {
    const r = await fetch(`/api/agente/${ruta}`, { method: metodo, cache: 'no-store' })
    const cuerpo = await r.json()
    if (!r.ok || cuerpo?.ok === false) return { ok: false, mensaje: cuerpo?.mensaje ?? `El agente respondió ${r.status}.` }
    return { ok: true, datos: cuerpo as T }
  } catch {
    return { ok: false, mensaje: 'El agente USB no respondió. Revisa que esté abierto («npm run taller»).' }
  }
}

export const leerEquipo = (udid: string) => pedir<Lectura>(`equipos/${encodeURIComponent(udid)}/lectura`)
export const emparejarEquipo = (udid: string) => pedir<{ ok: true }>(`equipos/${encodeURIComponent(udid)}/emparejar`, 'POST')
export const olvidarEquipo = (udid: string) =>
  pedir<{ ok: true; estabaEmparejado: boolean }>(`equipos/${encodeURIComponent(udid)}/emparejamiento`, 'DELETE')

/**
 * Escucha al agente: qué equipos hay enchufados y cuándo el cliente toca "Confiar". Si el
 * agente no está, la app sigue en modo manual y lo dice en una línea (plan §3.1).
 */
export function useAgente(): { estado: EstadoAgente; equipos: EquipoConectado[] } {
  const [estado, setEstado] = useState<EstadoAgente>('conectando')
  const [equipos, setEquipos] = useState<EquipoConectado[]>([])

  useEffect(() => {
    let fuente: EventSource | null = null
    let reintento: ReturnType<typeof setTimeout> | undefined
    let cerrado = false

    function abrir() {
      fuente = new EventSource('/api/agente/eventos')
      fuente.addEventListener('estado', (e) => {
        const datos = JSON.parse((e as MessageEvent).data) as { servicioApple: boolean; equipos: EquipoConectado[] }
        setEstado(datos.servicioApple ? 'activo' : 'sin_servicio_apple')
        setEquipos(datos.equipos)
      })
      const actualizar = (e: Event) => {
        const equipo = JSON.parse((e as MessageEvent).data) as EquipoConectado
        setEstado('activo')
        setEquipos((lista) => [...lista.filter((x) => x.udid !== equipo.udid), equipo])
      }
      fuente.addEventListener('conectado', actualizar)
      fuente.addEventListener('emparejado', actualizar)
      fuente.addEventListener('cambio', actualizar)
      fuente.addEventListener('desconectado', (e) => {
        const { udid } = JSON.parse((e as MessageEvent).data) as { udid: string }
        setEquipos((lista) => lista.filter((x) => x.udid !== udid))
      })
      fuente.onerror = () => {
        fuente?.close()
        setEstado('sin_agente')
        setEquipos([])
        if (!cerrado) reintento = setTimeout(abrir, 5000)
      }
    }

    abrir()
    return () => {
      cerrado = true
      clearTimeout(reintento)
      fuente?.close()
    }
  }, [])

  return { estado, equipos }
}

export const TEXTO_ESTADO_AGENTE: Record<EstadoAgente, string> = {
  conectando: 'Buscando el agente USB…',
  activo: 'Agente USB activo. Conecta un iPhone o iPad con un cable de datos.',
  sin_agente: 'Agente USB apagado: la app funciona en modo manual. Para leer por USB, abre AFix con «npm run taller».',
  sin_servicio_apple: 'Falta el servicio de Apple (Apple Mobile Device Service). Instala iTunes o Dispositivos Apple.',
}
