import type { NextRequest } from 'next/server'

/**
 * La app habla con el agente USB solo a través de este proxy (plan §3.1): una sola
 * dirección para el navegador y los flujos SSE (eventos, vigilancia) pasan tal cual.
 * Si el navegador corta, se corta también la conexión con el agente.
 */
const AGENTE = process.env.AGENTE_URL ?? 'http://127.0.0.1:8765'

const SIN_AGENTE = {
  ok: false,
  sinAgente: true,
  mensaje: 'El agente USB no está corriendo. Ábrelo con «npm run taller» o sigue en modo manual.',
}

async function reenviar(request: NextRequest, { params }: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await params
  const destino = `${AGENTE}/${ruta.map(encodeURIComponent).join('/')}`
  try {
    const respuesta = await fetch(destino, {
      method: request.method,
      signal: request.signal,
      cache: 'no-store',
    })
    const tipo = respuesta.headers.get('content-type') ?? 'application/json'
    return new Response(respuesta.body, {
      status: respuesta.status,
      headers: { 'Content-Type': tipo, 'Cache-Control': 'no-cache, no-transform' },
    })
  } catch {
    return Response.json(SIN_AGENTE, { status: 503 })
  }
}

export const GET = reenviar
export const POST = reenviar
export const DELETE = reenviar
