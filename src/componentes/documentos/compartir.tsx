'use client'

import { useState } from 'react'

/**
 * Enviar un documento al cliente (plan §6.1): "Compartir" abre la hoja de compartir de
 * Windows con el PDF adjunto (WhatsApp Desktop, correo). Siempre a la vista también
 * "Descargar PDF" y "Abrir chat de WhatsApp" con el texto listo.
 */
export function CompartirDocumento({
  id,
  nombreArchivo,
  enlaceWhatsapp,
  texto,
  enviadoEn,
  marcarEnviado,
}: {
  id: string
  nombreArchivo: string
  enlaceWhatsapp: string | null
  texto: string
  enviadoEn: string | null
  marcarEnviado: (id: string) => Promise<void>
}) {
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(enviadoEn)

  async function anotarEnvio() {
    await marcarEnviado(id)
    setEnviado(new Date().toISOString())
  }

  async function compartir() {
    setAviso(null)
    try {
      const respuesta = await fetch(`/api/documentos/${id}`)
      if (!respuesta.ok) throw new Error((await respuesta.json()).mensaje)
      const archivo = new File([await respuesta.blob()], nombreArchivo, { type: 'application/pdf' })
      if (!navigator.canShare?.({ files: [archivo] })) {
        setAviso('Este navegador no comparte archivos: usa «Descargar PDF» y adjúntalo en WhatsApp.')
        return
      }
      await navigator.share({ files: [archivo], title: nombreArchivo, text: texto })
      await anotarEnvio()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setAviso(error instanceof Error ? error.message : 'No se pudo compartir el documento.')
    }
  }

  return (
    <div>
      <div className="acciones">
        <button type="button" className="boton" onClick={compartir}>
          Compartir
        </button>
        <a className="boton-secundario" href={`/api/documentos/${id}?descargar=1`}>
          Descargar PDF
        </a>
        {enlaceWhatsapp ? (
          <a className="boton-secundario" href={enlaceWhatsapp} target="_blank" rel="noreferrer" onClick={() => void anotarEnvio()}>
            Abrir chat de WhatsApp
          </a>
        ) : (
          <span className="nota">Sin celular válido para WhatsApp.</span>
        )}
      </div>
      {enviado ? (
        <p className="nota aviso-verificado">
          Enviado el {new Date(enviado).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}.
        </p>
      ) : null}
      {aviso ? <p className="nota texto-alerta">{aviso}</p> : null}
    </div>
  )
}
