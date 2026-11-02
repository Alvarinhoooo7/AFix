import { notFound } from 'next/navigation'
import {
  CampoDoc,
  CamposEquipo,
  Clausulas,
  EncabezadoDocumento,
  fechaYHora,
  TablaChecklist,
  TablaRegistros,
} from '@/componentes/documentos/partes'
import { datosDocumento } from '@/datos/documento-ficha'
import { tonoEstado } from '@/dominio/checklist'
import { avisosDeContexto, NO_INFORMADO, textoAntecedentes, textoBuscarMiIphone } from '@/dominio/lectura'
import '@/estilos/documento.css'

export const metadata = { title: 'Comprobante de ingreso — AFIX' }

/** Comprobante de ingreso (plan §6.2). Edge lo imprime a PDF tal como se ve. */
export default async function ComprobanteIngreso({ params }: { params: Promise<{ numero: string }> }) {
  const numero = Number.parseInt((await params).numero, 10)
  if (Number.isNaN(numero)) notFound()
  const d = await datosDocumento(numero)
  if (!d) notFound()
  const { ficha: f, taller, lineas } = d
  const l = f.lecturaIngreso
  const sinProbar = lineas.filter((x) => x.bloque === 'funcionamiento' && tonoEstado(f.checklistIngreso[x.clave]?.estado) === 'sin_dato')
  // Todos los registros, también las faltas de memoria: entre más respaldo, mejor.
  const registrosIngreso = d.registros.filter((r) => r.momento === 'ingreso')
  const accesorios = f.accesorios.map((a) => (a.nombre === 'Otro' ? a.detalle : a.nombre)).filter(Boolean)

  return (
    <main className="documento">
      <EncabezadoDocumento taller={taller} numero={f.numero} />
      <h1 className="documento-titulo">Comprobante de ingreso</h1>
      <p className="documento-fecha">Recibido el {fechaYHora(f.recibidoEn)}</p>

      <section className="documento-seccion">
        <h2>Cliente</h2>
        <div className="documento-campos">
          <CampoDoc etiqueta="Nombre">{f.quienLoTrajo ?? ''}</CampoDoc>
          <CampoDoc etiqueta="Teléfono">{f.telefono ?? ''}</CampoDoc>
          <CampoDoc etiqueta="Dejó el código">{f.codigoEntregado === null ? '' : f.codigoEntregado ? 'Sí' : 'No'}</CampoDoc>
          <CampoDoc etiqueta="Qué pide el cliente" ancho>
            {f.pidioCliente}
          </CampoDoc>
        </div>
      </section>

      <section className="documento-seccion">
        <h2>Equipo</h2>
        <CamposEquipo datos={d.datosEquipo} />
      </section>

      <section className="documento-seccion">
        <h2>Lectura por USB</h2>
        {l ? (
          <div className="documento-campos">
            <CampoDoc etiqueta="Buscar mi iPhone">
              <span className={l.seguridad.buscarMiIphone.estado === 'activo' ? 'estado-alerta' : undefined}>
                {textoBuscarMiIphone(l.seguridad.buscarMiIphone)}
              </span>
            </CampoDoc>
            <CampoDoc etiqueta="Activación">{l.seguridad.activacion ?? NO_INFORMADO}</CampoDoc>
            <CampoDoc etiqueta="Batería">
              {l.bateria?.saludPct != null ? `${l.bateria.saludPct} %` : NO_INFORMADO}
              {l.bateria?.ciclos != null ? `, ${l.bateria.ciclos} ciclos` : ''}
            </CampoDoc>
            {avisosDeContexto(l).length > 0 ? (
              <CampoDoc etiqueta="Para tener en cuenta" ancho>
                {avisosDeContexto(l).join(' ')}
              </CampoDoc>
            ) : null}
          </div>
        ) : (
          <p style={{ margin: 0 }}>Equipo recibido sin acceso por USB.</p>
        )}
      </section>

      {l?.estabilidad ? (
        <section className="documento-seccion-larga">
          <h2>Antecedentes de estabilidad</h2>
          <p style={{ margin: '0 0 0.5rem' }}>{textoAntecedentes(l.estabilidad)}</p>
          {registrosIngreso.length > 0 ? <TablaRegistros registros={registrosIngreso} /> : null}
        </section>
      ) : null}

      <section className="documento-seccion-larga">
        <h2>Inspección al recibir</h2>
        <div className="documento-columnas">
          <TablaChecklist lineas={lineas} bloque="condicion" ingreso={f.checklistIngreso} />
          <TablaChecklist lineas={lineas} bloque="funcionamiento" ingreso={f.checklistIngreso} />
        </div>
        {sinProbar.length > 0 ? (
          <p style={{ margin: '0.5rem 0 0' }}>
            <strong>No probado al recibir:</strong> {sinProbar.map((x) => x.etiqueta).join(', ')}.
          </p>
        ) : null}
        {f.observacionIngreso ? (
          <p style={{ margin: '0.5rem 0 0' }}>
            <strong>Observación:</strong> {f.observacionIngreso}
          </p>
        ) : null}
      </section>

      <section className="documento-seccion">
        <h2>Accesorios recibidos</h2>
        <p style={{ margin: 0 }}>{accesorios.length > 0 ? accesorios.join(', ') : 'Ninguno'}.</p>
      </section>

      <Clausulas clausulas={d.clausulas} />

      <div className="documento-firmas">
        <div className="documento-firma">Firma del cliente</div>
        <div className="documento-firma">Recibe por {taller.nombre ?? 'AFIX'}</div>
      </div>
      <p className="documento-pie">
        Ficha {String(f.numero).padStart(4, '0')}. Conserve este comprobante para retirar el equipo.
      </p>
    </main>
  )
}
