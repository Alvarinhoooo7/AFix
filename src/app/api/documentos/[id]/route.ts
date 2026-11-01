import type { NextRequest } from 'next/server'
import { contenidoDocumento, nombreArchivo, obtenerDocumento } from '@/datos/documentos'

/**
 * El PDF archivado, tal como se emitió: se muestra dentro de la web o se descarga con
 * ?descargar=1. Si el archivo no coincide con la huella registrada, no se entrega.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const doc = await obtenerDocumento((await params).id)
  if (!doc) return Response.json({ mensaje: 'El documento no existe.' }, { status: 404 })
  try {
    const contenido = await contenidoDocumento(doc)
    const disposicion = request.nextUrl.searchParams.has('descargar') ? 'attachment' : 'inline'
    return new Response(Buffer.from(contenido), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposicion}; filename="${nombreArchivo(doc)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo leer el documento.'
    return Response.json({ mensaje }, { status: 502 })
  }
}
