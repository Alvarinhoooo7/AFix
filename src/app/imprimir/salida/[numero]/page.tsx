import { notFound } from 'next/navigation'
import { CampoDoc, CamposEquipo, EncabezadoDocumento, fechaLarga, fechaYHora, TablaChecklist, TablaRegistros } from '@/componentes/documentos/partes'
import { datosDocumento } from '@/datos/documento-ficha'
import { TIPOS_FALLA } from '@/dominio/lectura'
import '@/estilos/documento.css'

export const metadata = { title: 'Informe de entrega — AFIX' }

function bateriaTexto(pct: number | null, ciclos: number | null): string {
  if (pct === null && ciclos === null) return '—'
  return `${pct ?? '—'} % / ${ciclos ?? '—'} ciclos`
}

/** Informe de entrega (plan §6.3). Sin la nota de taller: esa es del técnico. */
export default async function InformeEntrega({ params }: { params: Promise<{ numero: string }> }) {
  const numero = Number.parseInt((await params).numero, 10)
  if (Number.isNaN(numero)) notFound()
  const d = await datosDocumento(numero)
  if (!d) notFound()
  const { ficha: f, taller, lineas } = d
  const sinReparar = f.estado === 'entregado_sin_reparar'
  const fallas = d.registros.filter((r) => TIPOS_FALLA.includes(r.tipo))
  const alIngreso = fallas.filter((r) => r.momento === 'ingreso')
  const despues = fallas.filter((r) => r.momento !== 'ingreso')
  const piezasCambiadas = d.piezas.filter((p) => p.estado === 'cambio')
  const iosAntes = f.lecturaIngreso?.sistema.ios ?? null
  const iosDespues = f.lecturaSalida?.sistema.ios ?? null
  const vigilancia = f.vigilanciaSalida

  return (
    <main className="documento">
      <EncabezadoDocumento taller={taller} numero={f.numero} />
      <h1 className="documento-titulo">{sinReparar ? 'Informe de entrega sin reparación' : 'Informe de entrega'}</h1>
      <p className="documento-fecha">
        Recibido el {fechaLarga(f.recibidoEn)} · Entregado el {f.entregadoEn ? fechaYHora(f.entregadoEn) : 'pendiente'}
      </p>

      <section className="documento-seccion">
        <h2>Equipo y cliente</h2>
        <CamposEquipo datos={d.datosEquipo} />
        <div className="documento-campos" style={{ marginTop: '0.6rem' }}>
          <CampoDoc etiqueta="Cliente">{f.quienLoTrajo ?? ''}</CampoDoc>
          <CampoDoc etiqueta="Teléfono">{f.telefono ?? ''}</CampoDoc>
        </div>
      </section>

      <section className="documento-seccion">
        <h2>Trabajo realizado</h2>
        {sinReparar ? (
          <p style={{ margin: 0 }}>El equipo se entrega sin reparar.</p>
        ) : f.trabajosRealizados.length > 0 ? (
          <table className="documento-tabla">
            <thead>
              <tr>
                <th>Trabajo</th>
                <th>Pieza</th>
                <th>Calidad</th>
              </tr>
            </thead>
            <tbody>
              {f.trabajosRealizados.map((t) => {
                const pieza = f.piezasCambiadas.find((p) => p.trabajo === t)
                return (
                  <tr key={t}>
                    <td>{t}</td>
                    <td>{pieza?.pieza ?? '—'}</td>
                    <td>{pieza ? (pieza.calidad === 'original' ? 'Original' : 'Compatible') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ margin: 0 }}>Sin trabajos registrados.</p>
        )}
      </section>

      <section className="documento-seccion">
        <h2>Antes y después</h2>
        <table className="documento-tabla">
          <thead>
            <tr>
              <th />
              <th>Al ingreso</th>
              <th>A la entrega</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Batería</td>
              <td>{bateriaTexto(f.bateriaPct, f.bateriaCiclos)}</td>
              <td>{sinReparar ? '—' : bateriaTexto(f.bateriaSalidaPct, f.bateriaSalidaCiclos)}</td>
            </tr>
            <tr>
              <td>iOS</td>
              <td>{iosAntes ?? f.iosVersion ?? '—'}</td>
              <td>{iosDespues ?? '—'}</td>
            </tr>
            {piezasCambiadas.map((p) => (
              <tr key={p.clave}>
                <td>{p.nombre}</td>
                <td className="codigo-serial">{p.ingreso}</td>
                <td className="codigo-serial">
                  {p.salida}
                  {!p.esperado ? <span className="documento-nota-linea estado-alerta">Pieza no declarada como trabajada</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {f.lecturaSalida === null ? <p className="documento-nota-linea">Sin lectura USB de salida.</p> : null}
      </section>

      <section className="documento-seccion-larga">
        <h2>Estabilidad antes y después</h2>
        <p style={{ margin: '0 0 0.4rem' }}>
          <strong>Al ingreso:</strong>{' '}
          {f.lecturaIngreso?.estabilidad ? `${alIngreso.length} fallas registradas en el equipo.` : 'sin lectura de registros.'}{' '}
          <strong>Después del ingreso:</strong> {despues.length === 0 ? '0 fallas nuevas.' : `${despues.length} fallas nuevas (detalle abajo).`}
          {vigilancia ? (
            <>
              {' '}
              <strong>Pruebas de salida:</strong> {vigilancia.fallas} fallas durante {Math.round(vigilancia.minutos)} min de vigilancia en vivo
              {vigilancia.desconexiones > 0 ? `, ${vigilancia.desconexiones} desconexiones` : ''}.
            </>
          ) : null}
        </p>
        {despues.length > 0 ? <TablaRegistros registros={despues} /> : null}
      </section>

      <section className="documento-seccion-larga">
        <h2>Revisión al ingreso y a la entrega</h2>
        <div className="documento-columnas">
          <TablaChecklist lineas={lineas} bloque="condicion" ingreso={f.checklistIngreso} salida={f.checklistSalida} />
          <TablaChecklist lineas={lineas} bloque="funcionamiento" ingreso={f.checklistIngreso} salida={f.checklistSalida} />
        </div>
      </section>

      {f.observacionIngreso || f.observacionSalida ? (
        <section className="documento-seccion">
          <h2>Observaciones</h2>
          {f.observacionIngreso ? (
            <p style={{ margin: '0 0 0.3rem' }}>
              <strong>Al ingreso:</strong> {f.observacionIngreso}
            </p>
          ) : null}
          {f.observacionSalida ? (
            <p style={{ margin: 0 }}>
              <strong>A la entrega:</strong> {f.observacionSalida}
            </p>
          ) : null}
        </section>
      ) : null}

      {!sinReparar ? (
        <section className="documento-seccion">
          <h2>Garantía</h2>
          <p style={{ margin: 0 }}>
            {d.garantiaMeses > 0 ? (
              <>
                {d.garantiaMeses} meses desde la entrega sobre la pieza reemplazada y la mano de obra, conforme a la Ley 19.496.{' '}
                {d.garantiaHasta ? <strong>Garantía hasta el {fechaLarga(d.garantiaHasta)}.</strong> : null} No cubre golpes, humedad, mal uso ni
                intervención de terceros.
              </>
            ) : (
              'Este trabajo no tiene garantía.'
            )}
          </p>
        </section>
      ) : null}

      <div className="documento-firmas">
        <div className="documento-firma">Recibo conforme (cliente)</div>
        <div className="documento-firma">Entrega por {taller.nombre ?? 'AFIX'}</div>
      </div>
      <p className="documento-pie">Ficha {String(f.numero).padStart(4, '0')}.</p>
    </main>
  )
}
