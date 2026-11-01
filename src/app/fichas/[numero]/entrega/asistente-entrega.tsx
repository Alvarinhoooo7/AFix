'use client'

import { useMemo, useState, useTransition } from 'react'
import { Checklist } from '@/componentes/checklist'
import { leerEquipo, olvidarEquipo, TEXTO_ESTADO_AGENTE, useAgente, type EquipoConectado } from '@/componentes/usb/agente'
import { ListaRegistros } from '@/componentes/usb/registros'
import { Vigilancia } from '@/componentes/usb/vigilancia'
import { tonoEstado, type Checklist as ValorChecklist, type LineaCatalogo } from '@/dominio/checklist'
import type { EstadoCierre, ResultadoVigilancia } from '@/dominio/ficha'
import { compararPiezas, fallasDesde, NO_INFORMADO, type EventoEstabilidad, type Lectura } from '@/dominio/lectura'
import { entregarAccion, guardarLecturaSalidaAccion, guardarVigilanciaAccion } from '../acciones'

const PASOS = ['Lectura de salida', 'Checklist de salida', 'Revisar y emitir'] as const

type Props = {
  numero: number
  recibidoEn: string
  listoEn: string | null
  lineas: LineaCatalogo[]
  checklistIngreso: ValorChecklist
  checklistSalidaInicial: ValorChecklist
  observacionSalidaInicial: string
  lecturaIngreso: Lectura | null
  lecturaSalidaInicial: Lectura | null
  vigilanciaInicial: ResultadoVigilancia | null
  trabajos: string[]
  bateriaIngreso: { pct: number | null; ciclos: number | null }
  identidad: { imei: string | null; numeroSerie: string | null; udid: string | null }
  sinReparar: boolean
}

function mismoEquipo(l: Lectura, id: Props['identidad']): boolean | null {
  const pares: [string | null, string | null][] = [
    [l.identidad.udid, id.udid],
    [l.identidad.numeroSerie, id.numeroSerie],
    [l.identidad.imei, id.imei],
  ]
  const comparables = pares.filter(([a, b]) => a && b)
  if (comparables.length === 0) return null
  return comparables.some(([a, b]) => a!.toUpperCase() === b!.toUpperCase())
}

/**
 * Entrega en tres pasos (plan §7.4): lectura de salida con la tabla de diferencias,
 * checklist de salida con el ingreso a la vista y la vigilancia en vivo, y el informe.
 */
export function AsistenteEntrega(p: Props) {
  const [paso, setPaso] = useState(0)
  const [lectura, setLectura] = useState<Lectura | null>(p.lecturaSalidaInicial)
  const [checklist, setChecklist] = useState<ValorChecklist>(p.checklistSalidaInicial)
  const [observacion, setObservacion] = useState(p.observacionSalidaInicial)
  const [vigilancia, setVigilancia] = useState<ResultadoVigilancia | null>(p.vigilanciaInicial)
  const [estadoCierre, setEstadoCierre] = useState<EstadoCierre>(p.sinReparar ? 'entregado_sin_reparar' : 'entregado')
  const [olvidar, setOlvidar] = useState(true)
  const [leyendo, setLeyendo] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()
  const { estado: estadoAgente, equipos } = useAgente()

  const equipoActual = equipos.find((e) => lectura && e.udid === lectura.identidad.udid) ?? equipos[0]
  const udidVigilancia = lectura?.identidad.udid ?? (equipoActual?.nivel === 'emparejado' ? equipoActual.udid : null)

  async function leer(equipo: EquipoConectado) {
    setMensaje(null)
    setLeyendo(true)
    const r = await leerEquipo(equipo.udid)
    setLeyendo(false)
    if (!r.ok) {
      setMensaje(r.mensaje)
      return
    }
    const guardado = await guardarLecturaSalidaAccion(p.numero, r.datos)
    if (!guardado.ok) setMensaje(guardado.mensaje)
    setLectura(r.datos)
  }

  async function terminarVigilancia(resultado: ResultadoVigilancia, eventos: EventoEstabilidad[]) {
    setVigilancia(resultado)
    const r = await guardarVigilanciaAccion(p.numero, resultado, eventos)
    if (!r.ok) setMensaje(r.mensaje)
  }

  const diferencias = useMemo(
    () => (lectura ? compararPiezas(p.lecturaIngreso?.piezas ?? [], lectura.piezas, p.trabajos) : []),
    [lectura, p.lecturaIngreso, p.trabajos],
  )
  const nuevas = lectura ? fallasDesde(lectura.estabilidad, new Date(p.recibidoEn)) : []
  const otroEquipo = lectura ? mismoEquipo(lectura, p.identidad) === false : false
  const sospechosas = diferencias.filter((d) => d.estado === 'cambio' && !d.esperado)
  const sinProbar = p.lineas.filter((l) => l.bloque === 'funcionamiento' && tonoEstado(checklist[l.clave]?.estado) === 'sin_dato')
  const fallasSalida = p.lineas.filter((l) => tonoEstado(checklist[l.clave]?.estado) === 'alerta')

  function entregar() {
    setMensaje(null)
    iniciar(async () => {
      if (olvidar && lectura?.identidad.udid) await olvidarEquipo(lectura.identidad.udid)
      const r = await entregarAccion(p.numero, estadoCierre, checklist, observacion)
      if (r && !r.ok) setMensaje(r.mensaje)
    })
  }

  return (
    <div>
      <ol className="pasos">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className={`paso ${i === paso ? 'paso-actual' : i < paso ? 'paso-hecho' : ''}`}>
            <button type="button" className="paso-boton" disabled={i > paso} onClick={() => setPaso(i)} aria-current={i === paso ? 'step' : undefined}>
              <span className="paso-numero">{i + 1}</span> {nombre}
            </button>
          </li>
        ))}
      </ol>
      {mensaje ? (
        <p className="aviso aviso-falla" role="alert">
          {mensaje}
        </p>
      ) : null}

      {paso === 0 ? (
        <section>
          <p className="nota nota-seccion">{TEXTO_ESTADO_AGENTE[estadoAgente]}</p>
          <div className="acciones" style={{ marginBottom: '1rem' }}>
            {equipos.map((eq) => (
              <button key={eq.udid} type="button" className="boton" disabled={leyendo || eq.nivel !== 'emparejado'} onClick={() => leer(eq)}>
                {leyendo ? 'Leyendo…' : `Leer ${eq.nombre ?? 'equipo'} por USB`}
              </button>
            ))}
            {equipos.some((e) => e.nivel === 'sin_confianza') ? <span className="nota">Desbloquea el iPhone y toca «Confiar» para leerlo.</span> : null}
          </div>

          {lectura ? (
            <>
              {otroEquipo ? (
                <div className="tarjeta tarjeta-alerta" role="alert">
                  <strong>Este no parece el mismo equipo del ingreso:</strong> la serie, el IMEI y el UDID no coinciden con la ficha.
                </div>
              ) : null}
              <table className="tabla" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th />
                    <th>Al ingreso</th>
                    <th>Ahora</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Batería</td>
                    <td className="tabla-numero">
                      {p.bateriaIngreso.pct ?? '—'} % / {p.bateriaIngreso.ciclos ?? '—'} ciclos
                    </td>
                    <td className="tabla-numero">
                      {lectura.bateria?.saludPct ?? '—'} % / {lectura.bateria?.ciclos ?? '—'} ciclos
                    </td>
                  </tr>
                  <tr>
                    <td>iOS</td>
                    <td>{p.lecturaIngreso?.sistema.ios ?? '—'}</td>
                    <td>{lectura.sistema.ios ?? '—'}</td>
                  </tr>
                  {diferencias.map((d) => (
                    <tr key={d.clave} className={d.estado === 'cambio' && !d.esperado ? 'fila-alerta' : undefined}>
                      <td>{d.nombre}</td>
                      <td className="codigo-serial">{d.ingreso ?? NO_INFORMADO}</td>
                      <td className="codigo-serial">
                        {d.salida ?? NO_INFORMADO}
                        {d.estado === 'cambio' ? (
                          <span className="nota-linea">{d.esperado ? 'Cambiada en esta reparación' : 'Cambió y no se declaró como trabajada'}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sospechosas.length > 0 ? (
                <p className="aviso aviso-falla">
                  Atención: cambió la serie de {sospechosas.map((s) => s.nombre.toLowerCase()).join(', ')} sin que figure como trabajo realizado.
                </p>
              ) : null}
              <h3 className="subtitulo" style={{ marginTop: '1.5rem' }}>
                Fallas registradas después del ingreso
              </h3>
              <ListaRegistros
                registros={nuevas.map((e) => ({ clave: e.nombre, ...e, nuevo: !p.listoEn || (e.fecha !== null && new Date(e.fecha) > new Date(p.listoEn)) }))}
                vacio="Ninguna: el equipo no registró pánicos, bloqueos ni reinicios desde que entró."
              />
            </>
          ) : (
            <p className="nota">Lee el equipo para comparar piezas, batería y registros con el ingreso. Si no enciende, sigue sin lectura.</p>
          )}
        </section>
      ) : null}

      {paso === 1 ? (
        <div className="dos-columnas">
          <section>
            <p className="nota nota-seccion">Cada línea se prueba y se marca otra vez: el ingreso queda a la vista, pero no se copia.</p>
            <Checklist lineas={p.lineas} valor={checklist} onChange={setChecklist} nombreCampo="checklistSalida" referencia={p.checklistIngreso} />
            <div className="campo" style={{ marginTop: '1rem' }}>
              <label className="campo-etiqueta" htmlFor="campo-observacionSalida">
                Observación de salida
              </label>
              <textarea id="campo-observacionSalida" className="campo-valor campo-entrada campo-area" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
            </div>
          </section>
          <aside className="columna-lateral">
            {udidVigilancia ? (
              <Vigilancia udid={udidVigilancia} alTerminar={terminarVigilancia} />
            ) : (
              <div className="tarjeta tarjeta-apagada">
                <h3 className="tarjeta-titulo">Vigilancia en vivo</h3>
                <p style={{ margin: 0 }}>Conecta y lee el equipo para vigilarlo mientras lo pruebas.</p>
              </div>
            )}
            {vigilancia ? (
              <p className={vigilancia.fallas > 0 ? 'nota texto-alerta' : 'nota aviso-verificado'}>
                Última vigilancia: {vigilancia.fallas} fallas en {vigilancia.minutos.toFixed(1)} min.
              </p>
            ) : null}
          </aside>
        </div>
      ) : null}

      {paso === 2 ? (
        <section>
          <dl className="datos" style={{ marginBottom: '1.25rem' }}>
            <dt>Lectura de salida</dt>
            <dd>{lectura ? `Sí, ${nuevas.length} fallas nuevas desde el ingreso` : 'Sin lectura USB'}</dd>
            <dt>Piezas</dt>
            <dd className={sospechosas.length > 0 ? 'texto-alerta' : undefined}>
              {diferencias.filter((d) => d.estado === 'cambio').map((d) => d.nombre).join(', ') || 'Sin cambios de serie'}
            </dd>
            <dt>Vigilancia</dt>
            <dd>{vigilancia ? `${vigilancia.fallas} fallas en ${vigilancia.minutos.toFixed(1)} min` : 'No se hizo'}</dd>
            <dt>Checklist de salida</dt>
            <dd className={fallasSalida.length > 0 ? 'texto-alerta' : undefined}>
              {fallasSalida.map((l) => `${l.etiqueta}: ${checklist[l.clave].estado}`).join(' · ') || 'Sin fallas marcadas'}
            </dd>
            <dt>No probado</dt>
            <dd>{sinProbar.length === 0 ? 'Todo probado' : sinProbar.map((l) => l.etiqueta).join(', ')}</dd>
          </dl>
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 1rem' }}>
            <legend className="campo-etiqueta">Cómo se entrega</legend>
            <div className="casillas">
              <label className="casilla-opcion">
                <input type="radio" name="estadoCierre" checked={estadoCierre === 'entregado'} onChange={() => setEstadoCierre('entregado')} />
                Reparado
              </label>
              <label className="casilla-opcion">
                <input type="radio" name="estadoCierre" checked={estadoCierre === 'entregado_sin_reparar'} onChange={() => setEstadoCierre('entregado_sin_reparar')} />
                Sin reparar
              </label>
            </div>
          </fieldset>
          {lectura?.identidad.udid ? (
            <label className="casilla-opcion" style={{ marginBottom: '1rem' }}>
              <input type="checkbox" checked={olvidar} onChange={(e) => setOlvidar(e.target.checked)} />
              Borrar la confianza de este PC con el iPhone al entregar
            </label>
          ) : null}
          <p className="nota">Al emitir, la ficha queda congelada y se genera el informe de entrega en PDF, archivado y listo para enviar.</p>
          <div className="acciones" style={{ marginTop: '1rem' }}>
            <button type="button" className="boton" onClick={entregar} disabled={enviando}>
              {enviando ? 'Cerrando y generando el PDF…' : 'Entregar y emitir informe'}
            </button>
          </div>
        </section>
      ) : null}

      <div className="acciones seccion">
        {paso > 0 ? (
          <button type="button" className="boton-secundario" onClick={() => setPaso(paso - 1)}>
            Atrás
          </button>
        ) : null}
        {paso < PASOS.length - 1 ? (
          <button type="button" className="boton" onClick={() => setPaso(paso + 1)}>
            {paso === 0 && !lectura ? 'Seguir sin lectura USB' : `Siguiente: ${PASOS[paso + 1]}`}
          </button>
        ) : null}
      </div>
    </div>
  )
}
