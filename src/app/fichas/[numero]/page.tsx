import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CompartirDocumento } from '@/componentes/documentos/compartir'
import { ListaRegistros } from '@/componentes/usb/registros'
import { ResumenLectura } from '@/componentes/usb/resumen-lectura'
import { Timbre } from '@/componentes/timbre'
import { leerAjustes } from '@/datos/ajustes'
import { catalogoPorVersion } from '@/datos/catalogo'
import { documentosDeFicha, NOMBRE_DOCUMENTO, nombreArchivo, type Documento } from '@/datos/documentos'
import { obtenerEquipo } from '@/datos/equipos'
import { obtenerFicha, registrosDeFicha } from '@/datos/fichas'
import { tonoEstado, type LineaCatalogo } from '@/dominio/checklist'
import { ETIQUETA_ESTADO, estaAbierta, vencimientoGarantia } from '@/dominio/ficha'
import { enlaceWhatsapp, mensajeDocumento } from '@/dominio/whatsapp'
import { agregarNotaAccion, cambiarEstadoAccion, guardarReparacionAccion, marcarEnviadoAccion, reemitirAccion } from './acciones'
import { FormularioReparacion } from './formulario-reparacion'

const ZONA = 'America/Santiago'

function cuando(fecha: Date): string {
  return fecha.toLocaleString('es-CL', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function BotonEstado({ numero, hacia, texto, principal }: { numero: number; hacia: string; texto: string; principal?: boolean }) {
  return (
    <form action={cambiarEstadoAccion}>
      <input type="hidden" name="numero" value={numero} />
      <input type="hidden" name="hacia" value={hacia} />
      <button className={principal ? 'boton' : 'boton-secundario'} type="submit">
        {texto}
      </button>
    </form>
  )
}

export default async function PaginaFicha({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>
  searchParams: Promise<{ guardado?: string; falla?: string; emitido?: string; sinDocumento?: string }>
}) {
  const [{ numero: textoNumero }, consulta] = await Promise.all([params, searchParams])
  const numero = Number.parseInt(textoNumero, 10)
  if (Number.isNaN(numero)) notFound()
  const f = await obtenerFicha(numero)
  if (!f) notFound()

  const [equipo, catalogo, registros, documentos, taller] = await Promise.all([
    obtenerEquipo(f.equipoId),
    catalogoPorVersion(f.catalogoVersion ?? 1).catch(() => ({ version: 1, lineas: [] as LineaCatalogo[] })),
    registrosDeFicha(numero),
    documentosDeFicha(numero).catch(() => [] as Documento[]),
    leerAjustes(),
  ])
  const abierta = estaAbierta(f.estado)
  const accesorios = f.accesorios.map((a) => (a.nombre === 'Otro' ? a.detalle : a.nombre)).filter(Boolean)
  const lineasAlerta = catalogo.lineas.filter((l) => tonoEstado(f.checklistIngreso[l.clave]?.estado) === 'alerta')
  const ultimoDe = (tipo: 'ingreso' | 'salida') => documentos.filter((d) => d.tipo === tipo).at(-1)
  const recienEmitido = consulta.emitido === 'ingreso' || consulta.emitido === 'salida' ? ultimoDe(consulta.emitido) : undefined
  const garantiaHasta =
    f.estado === 'entregado' && f.entregadoEn ? vencimientoGarantia(f.entregadoEn, f.garantiaMeses ?? taller.garantiaMeses) : null

  const hitos = [
    { texto: 'Recibido', fecha: f.recibidoEn },
    { texto: 'En reparación', fecha: f.enReparacionEn },
    { texto: 'Listo para entregar', fecha: f.listoEn },
    { texto: f.estado === 'entregado_sin_reparar' ? 'Entregado sin reparar' : 'Entregado', fecha: f.entregadoEn },
  ]

  return (
    <main className="hoja hoja-ancha">
      <header className="encabezado-ficha">
        <div>
          <h1 className="titulo">{equipo?.modeloComercial ?? 'Equipo sin modelo'}</h1>
          <p className="nota">
            <span className={`marca-estado marca-estado-${f.estado}`}>{ETIQUETA_ESTADO[f.estado]}</span>
            {f.quienLoTrajo ? ` · ${f.quienLoTrajo}` : ''}
            {f.telefono ? ` · ${f.telefono}` : ''}
          </p>
        </div>
        <Timbre numero={f.numero} />
      </header>
      <div className="doble-linea" />

      {consulta.guardado ? <p className="aviso">Cambios guardados.</p> : null}
      {consulta.falla ? <p className="aviso aviso-falla">No se pudieron guardar los cambios. Una ficha entregada está congelada.</p> : null}
      {recienEmitido ? (
        <div className="tarjeta tarjeta-verificado" style={{ marginBottom: '1.5rem' }}>
          <h2 className="tarjeta-titulo">{NOMBRE_DOCUMENTO[recienEmitido.tipo]} emitido y archivado</h2>
          <CompartirDocumento
            id={recienEmitido.id}
            nombreArchivo={nombreArchivo(recienEmitido)}
            enlaceWhatsapp={enlaceWhatsapp(f.telefono, mensajeDocumento(recienEmitido.tipo, f.numero, taller.nombre, f.quienLoTrajo))}
            texto={mensajeDocumento(recienEmitido.tipo, f.numero, taller.nombre, f.quienLoTrajo)}
            enviadoEn={recienEmitido.enviadoEn?.toISOString() ?? null}
            marcarEnviado={marcarEnviadoAccion}
          />
        </div>
      ) : null}
      {consulta.sinDocumento === 'ingreso' || consulta.sinDocumento === 'salida' ? (
        <div className="tarjeta tarjeta-alerta" style={{ marginBottom: '1.5rem' }}>
          <h2 className="tarjeta-titulo">La ficha quedó guardada, pero el PDF no se pudo generar</h2>
          <p style={{ marginTop: 0 }}>Revisa que Storage esté configurado (ver README) y vuelve a intentarlo.</p>
          <form action={reemitirAccion}>
            <input type="hidden" name="numero" value={f.numero} />
            <input type="hidden" name="tipo" value={consulta.sinDocumento} />
            <button className="boton" type="submit">
              Volver a generar el {NOMBRE_DOCUMENTO[consulta.sinDocumento].toLowerCase()}
            </button>
          </form>
        </div>
      ) : null}

      {abierta ? (
        <div className="acciones" style={{ marginBottom: '1.5rem' }}>
          {f.estado === 'recibido' ? <BotonEstado numero={f.numero} hacia="en_reparacion" texto="Pasar a reparación" principal /> : null}
          {f.estado === 'en_reparacion' ? <BotonEstado numero={f.numero} hacia="listo" texto="Marcar listo para entregar" principal /> : null}
          {f.estado === 'listo' ? (
            <Link className="boton" href={`/fichas/${f.numero}/entrega`}>
              Entregar
            </Link>
          ) : null}
          {f.estado === 'listo' ? <BotonEstado numero={f.numero} hacia="en_reparacion" texto="Volver a reparación" /> : null}
          {f.estado === 'recibido' ? <BotonEstado numero={f.numero} hacia="listo" texto="Marcar listo sin pasar por reparación" /> : null}
          <Link className="boton-secundario" href={`/fichas/${f.numero}/entrega?sinReparar=1`}>
            Entregar sin reparar
          </Link>
        </div>
      ) : null}

      <div className="dos-columnas">
        <div>
          <section className="seccion" style={{ marginTop: 0 }}>
            <h2 className="subtitulo">Equipo y cliente</h2>
            <dl className="datos">
              <dt>Modelo</dt>
              <dd>{[equipo?.modeloComercial, equipo?.capacidad, equipo?.numeroModelo].filter(Boolean).join(' · ') || 'Sin datos'}</dd>
              <dt>IMEI</dt>
              <dd className="codigo-serial">{[equipo?.imei, equipo?.imei2].filter(Boolean).join(' / ') || 'Sin IMEI'}</dd>
              <dt>Serie</dt>
              <dd className="codigo-serial">{equipo?.numeroSerie ?? 'Sin serie'}</dd>
              <dt>iOS</dt>
              <dd>{f.iosVersion ?? 'Sin dato'}</dd>
              <dt>Batería al ingreso</dt>
              <dd>
                {f.bateriaPct != null ? `${f.bateriaPct} %` : 'Sin %'} / {f.bateriaCiclos != null ? `${f.bateriaCiclos} ciclos` : 'sin ciclos'}
              </dd>
              <dt>Qué pidió</dt>
              <dd>{f.pidioCliente || 'Sin indicar'}</dd>
              <dt>Accesorios</dt>
              <dd>{accesorios.length > 0 ? accesorios.join(', ') : 'Ninguno'}</dd>
              <dt>Código</dt>
              <dd>{f.codigoEntregado === null ? 'Sin indicar' : f.codigoEntregado ? 'Lo dejó (no se guarda)' : 'No lo dejó'}</dd>
              <dt>Datos</dt>
              <dd>{f.origenDatos === 'usb' ? 'Leídos por USB' : f.origenDatos === 'mixto' ? 'USB con correcciones' : 'A mano'}</dd>
            </dl>
          </section>

          <section className="seccion">
            <h2 className="subtitulo">Inspección al recibir</h2>
            {lineasAlerta.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {lineasAlerta.map((l) => (
                  <li key={l.clave}>
                    <span className="texto-alerta">
                      {l.etiqueta}: {f.checklistIngreso[l.clave].estado}
                    </span>
                    {f.checklistIngreso[l.clave].nota ? ` (${f.checklistIngreso[l.clave].nota})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nota" style={{ margin: 0 }}>
                Sin fallas ni daños marcados al recibir.
              </p>
            )}
            {f.observacionIngreso ? <p>Observación: {f.observacionIngreso}</p> : null}
          </section>

          <section className="seccion">
            <h2 className="subtitulo">Reparación</h2>
            {abierta ? (
              <FormularioReparacion numero={f.numero} trabajos={f.trabajosRealizados} piezas={f.piezasCambiadas} nota={f.notaReparacion} accion={guardarReparacionAccion} />
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  {f.trabajosRealizados.length > 0
                    ? f.trabajosRealizados
                        .map((t) => {
                          const p = f.piezasCambiadas.find((x) => x.trabajo === t)
                          return p ? `${t} (${p.pieza}, ${p.calidad})` : t
                        })
                        .join(' · ')
                    : 'Sin trabajos registrados.'}
                </p>
                {f.notaReparacion ? <p className="nota">Nota de taller: {f.notaReparacion}</p> : null}
              </>
            )}
          </section>

          <section className="seccion">
            <h2 className="subtitulo">Registros del equipo</h2>
            <ListaRegistros
              registros={registros.map((r) => ({
                clave: String(r.id),
                tipo: r.tipo,
                fecha: r.fechaEvento?.toISOString() ?? null,
                resumen: r.resumen,
                causaProbable: r.causaProbable,
                texto: r.texto,
                momento: r.momento,
                nuevo: r.momento !== 'ingreso',
              }))}
              vacio={f.lecturaIngreso ? 'El equipo no tenía registros de fallas.' : 'Sin lectura USB de los registros del equipo.'}
            />
          </section>

          {f.lecturaIngreso ? (
            <section className="seccion">
              <details>
                <summary className="subtitulo" style={{ cursor: 'pointer' }}>
                  Lectura USB completa del ingreso
                </summary>
                <ResumenLectura lectura={f.lecturaIngreso} />
              </details>
            </section>
          ) : null}

          {f.lecturaSalida ? (
            <section className="seccion">
              <details>
                <summary className="subtitulo" style={{ cursor: 'pointer' }}>
                  Lectura USB de la salida
                </summary>
                <ResumenLectura lectura={f.lecturaSalida} />
              </details>
            </section>
          ) : null}

          {!abierta ? (
            <section className="seccion">
              <h2 className="subtitulo">Notas posteriores al cierre</h2>
              {f.notasPosteriores.length > 0 ? (
                <ul style={{ paddingLeft: '1.25rem' }}>
                  {f.notasPosteriores.map((n) => (
                    <li key={n.id}>
                      <strong>{cuando(n.creadaEn)}:</strong> {n.texto}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="nota">Sin notas posteriores.</p>
              )}
              <form action={agregarNotaAccion}>
                <input type="hidden" name="numero" value={f.numero} />
                <div className="campo">
                  <label className="campo-etiqueta" htmlFor="campo-textoNota">
                    Agregar nota con fecha (no altera lo original)
                  </label>
                  <input id="campo-textoNota" className="campo-valor campo-entrada" name="textoNota" required />
                </div>
                <div className="acciones" style={{ marginTop: '0.75rem' }}>
                  <button className="boton" type="submit">
                    Guardar nota
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </div>

        <aside className="columna-lateral">
          <section className="tarjeta">
            <h2 className="tarjeta-titulo">Línea de tiempo</h2>
            <ol className="linea-tiempo">
              {hitos.map((h) => (
                <li key={h.texto} className={h.fecha ? 'hecho' : undefined}>
                  {h.texto}
                  <span className="linea-tiempo-fecha">{h.fecha ? cuando(h.fecha) : 'Pendiente'}</span>
                </li>
              ))}
            </ol>
            {garantiaHasta ? <p className="nota aviso-verificado">Garantía hasta el {garantiaHasta.toLocaleDateString('es-CL', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' })}.</p> : null}
          </section>

          <section className="tarjeta">
            <h2 className="tarjeta-titulo">Documentos</h2>
            {documentos.length === 0 ? <p className="nota" style={{ margin: 0 }}>Todavía no hay documentos emitidos.</p> : null}
            {documentos.map((d) => (
              <div key={d.id} style={{ marginBottom: '0.75rem' }}>
                <strong>{NOMBRE_DOCUMENTO[d.tipo]}</strong>
                <div className="nota" style={{ margin: 0 }}>
                  Emitido {cuando(d.emitidoEn)}
                  {d.enviadoEn ? ` · enviado ${cuando(d.enviadoEn)}` : ' · sin enviar'}
                </div>
                <div className="acciones" style={{ marginTop: '0.3rem' }}>
                  <Link className="enlace" href={`/fichas/${f.numero}/documentos/${d.id}`}>
                    Ver
                  </Link>
                  <a className="enlace" href={`/api/documentos/${d.id}?descargar=1`}>
                    Descargar
                  </a>
                </div>
              </div>
            ))}
            <div className="acciones">
              {(['ingreso', 'salida'] as const)
                .filter((tipo) => tipo === 'ingreso' || !abierta)
                .map((tipo) => (
                  <form key={tipo} action={reemitirAccion}>
                    <input type="hidden" name="numero" value={f.numero} />
                    <input type="hidden" name="tipo" value={tipo} />
                    <button className="boton-secundario" type="submit">
                      {ultimoDe(tipo) ? 'Emitir de nuevo' : 'Emitir'}: {NOMBRE_DOCUMENTO[tipo].toLowerCase()}
                    </button>
                  </form>
                ))}
            </div>
            <p className="nota">Un documento emitido no se reemplaza: emitir de nuevo agrega otro y queda el historial.</p>
          </section>

          {f.vigilanciaSalida ? (
            <section className={f.vigilanciaSalida.fallas > 0 ? 'tarjeta tarjeta-alerta' : 'tarjeta tarjeta-verificado'}>
              <h2 className="tarjeta-titulo">Vigilancia de salida</h2>
              <p style={{ margin: 0 }}>
                {f.vigilanciaSalida.fallas} fallas en {Math.round(f.vigilanciaSalida.minutos)} min
                {f.vigilanciaSalida.desconexiones ? `, ${f.vigilanciaSalida.desconexiones} desconexiones` : ''}.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  )
}
