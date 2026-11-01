import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CompartirDocumento } from '@/componentes/documentos/compartir'
import { leerAjustes } from '@/datos/ajustes'
import { NOMBRE_DOCUMENTO, nombreArchivo, obtenerDocumento } from '@/datos/documentos'
import { obtenerFicha } from '@/datos/fichas'
import { enlaceWhatsapp, mensajeDocumento } from '@/dominio/whatsapp'
import { marcarEnviadoAccion } from '../../acciones'

export const metadata = { title: 'Documento — AFIX' }

/** El PDF archivado, visto dentro de la web tal como se emitió. */
export default async function VerDocumento({ params }: { params: Promise<{ numero: string; id: string }> }) {
  const { numero, id } = await params
  const [doc, ficha, taller] = await Promise.all([obtenerDocumento(id), obtenerFicha(Number.parseInt(numero, 10)), leerAjustes()])
  if (!doc || !ficha || doc.fichaNumero !== ficha.numero) notFound()
  const texto = mensajeDocumento(doc.tipo, ficha.numero, taller.nombre, ficha.quienLoTrajo)

  return (
    <main className="hoja hoja-ancha">
      <header className="encabezado">
        <h1 className="titulo">{NOMBRE_DOCUMENTO[doc.tipo]}</h1>
        <p className="nota">
          Ficha {String(ficha.numero).padStart(4, '0')} · emitido el{' '}
          {doc.emitidoEn.toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'long', timeStyle: 'short' })} · huella{' '}
          <span className="codigo-serial">{doc.sha256.slice(0, 16)}…</span>
        </p>
      </header>
      <div className="doble-linea" />
      <div style={{ marginBottom: '1rem' }}>
        <CompartirDocumento
          id={doc.id}
          nombreArchivo={nombreArchivo(doc)}
          enlaceWhatsapp={enlaceWhatsapp(ficha.telefono, texto)}
          texto={texto}
          enviadoEn={doc.enviadoEn?.toISOString() ?? null}
          marcarEnviado={marcarEnviadoAccion}
        />
      </div>
      <iframe className="visor-documento" src={`/api/documentos/${doc.id}`} title={NOMBRE_DOCUMENTO[doc.tipo]} />
      <p className="nota">
        <Link className="enlace" href={`/fichas/${ficha.numero}`}>
          Volver a la ficha
        </Link>
      </p>
    </main>
  )
}
