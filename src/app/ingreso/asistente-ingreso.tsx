'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { AvisoEquipoConocido, type ItemHistorialEquipo } from '@/componentes/aviso-equipo-conocido'
import { Campo } from '@/componentes/campo'
import { Checklist } from '@/componentes/checklist'
import { emparejarEquipo, leerEquipo, TEXTO_ESTADO_AGENTE, useAgente, type EquipoConectado } from '@/componentes/usb/agente'
import { ResumenLectura } from '@/componentes/usb/resumen-lectura'
import { tonoEstado, type Checklist as ValorChecklist, type LineaCatalogo } from '@/dominio/checklist'
import { ACCESORIOS, type Accesorio } from '@/dominio/ficha'
import { textoAntecedentes, TIPOS_FALLA, type Lectura } from '@/dominio/lectura'
import { resolverModelo } from '@/dominio/modelos-iphone'
import { consultarHistorial, emitirIngreso, type PayloadIngreso } from './acciones'

type Modo = 'usb' | 'manual' | 'apagado' | null
type DatosEquipo = PayloadIngreso['equipo']

type Borrador = {
  paso: number
  modo: Modo
  lectura: Lectura | null
  equipo: DatosEquipo
  desdeUsb: DatosEquipo | null
  checklist: ValorChecklist
  cliente: PayloadIngreso['cliente']
  accesorios: Accesorio[]
  otroAccesorio: string
  codigoEntregado: boolean | null
  observacionIngreso: string
}

const CLAVE_BORRADOR = 'afix-borrador-ingreso'
const PASOS = ['Equipo', 'Inspección', 'Cliente', 'Revisar y emitir'] as const

const EQUIPO_VACIO: DatosEquipo = {
  modeloProducto: '',
  modeloComercial: '',
  capacidad: '',
  iosVersion: '',
  imei: '',
  numeroSerie: '',
  bateriaPct: '',
  bateriaCiclos: '',
}

function borradorVacio(): Borrador {
  return {
    paso: 0,
    modo: null,
    lectura: null,
    equipo: EQUIPO_VACIO,
    desdeUsb: null,
    checklist: {},
    cliente: { quienLoTrajo: '', telefono: '', pidioCliente: '' },
    accesorios: [],
    otroAccesorio: '',
    codigoEntregado: null,
    observacionIngreso: '',
  }
}

function equipoDesdeLectura(l: Lectura, tabla: Map<string, string>): DatosEquipo {
  const modelo = resolverModelo(l.identidad.productType, tabla)
  const texto = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
  return {
    modeloProducto: texto(l.identidad.productType),
    modeloComercial: modelo.requiereConfirmacion ? '' : modelo.modeloComercial,
    capacidad: texto(l.identidad.capacidad),
    iosVersion: l.sistema.ios ? `${l.sistema.ios}${l.sistema.build ? ` (${l.sistema.build})` : ''}` : '',
    imei: texto(l.identidad.imei),
    numeroSerie: texto(l.identidad.numeroSerie),
    bateriaPct: texto(l.bateria?.saludPct),
    bateriaCiclos: texto(l.bateria?.ciclos),
  }
}

/**
 * Nuevo ingreso en cuatro pasos (plan §7.2): Equipo → Inspección → Cliente → Revisar y
 * emitir. Se puede volver atrás y lo escrito queda en un borrador local hasta emitir.
 * La lectura USB nunca marca "Bien": solo propone "Falla" con evidencia (plan §5).
 */
export function AsistenteIngreso({
  tablaModelos,
  lineas,
  catalogoVersion,
  udidInicial,
}: {
  tablaModelos: Record<string, string>
  lineas: LineaCatalogo[]
  catalogoVersion: number
  udidInicial: string | null
}) {
  const tabla = useMemo(() => new Map(Object.entries(tablaModelos)), [tablaModelos])
  const [b, setB] = useState<Borrador>(borradorVacio)
  const [borradorRecuperado, setBorradorRecuperado] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState<string | null>(null)
  const [historial, setHistorial] = useState<ItemHistorialEquipo[]>([])
  const [emitiendo, iniciarEmision] = useTransition()
  const { estado: estadoAgente, equipos } = useAgente()
  const autoLeido = useRef(false)

  const actualizar = (cambios: Partial<Borrador>) => setB((actual) => ({ ...actual, ...cambios }))

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_BORRADOR)
      if (guardado) {
        setB({ ...borradorVacio(), ...(JSON.parse(guardado) as Borrador) })
        setBorradorRecuperado(true)
      }
    } catch {
      // Sin almacenamiento local (ventana privada): el asistente funciona igual, sin borrador.
    }
  }, [])

  useEffect(() => {
    if (b.modo === null && b.paso === 0) return
    try {
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b))
    } catch {
      // Ídem: el borrador es una comodidad, no un requisito.
    }
  }, [b])

  // Al enchufar un equipo conocido se avisa su historial, por cualquier identificador.
  const idsHistorial = JSON.stringify({ imei: b.equipo.imei, numeroSerie: b.equipo.numeroSerie, udid: b.lectura?.identidad.udid, ecid: b.lectura?.identidad.ecid })
  useEffect(() => {
    const ids = JSON.parse(idsHistorial)
    if (!ids.imei && !ids.numeroSerie && !ids.udid && !ids.ecid) {
      setHistorial([])
      return
    }
    let vigente = true
    consultarHistorial(ids).then((h) => vigente && setHistorial(h))
    return () => {
      vigente = false
    }
  }, [idsHistorial])

  async function leer(equipo: EquipoConectado) {
    setMensaje(null)
    setLeyendo(equipo.udid)
    const r = await leerEquipo(equipo.udid)
    setLeyendo(null)
    if (!r.ok) {
      setMensaje(r.mensaje)
      return
    }
    const desdeUsb = equipoDesdeLectura(r.datos, tabla)
    actualizar({ modo: 'usb', lectura: r.datos, equipo: desdeUsb, desdeUsb })
  }

  async function pedirConfianza(equipo: EquipoConectado) {
    setMensaje('En el iPhone: desbloquéalo y toca «Confiar». Tienes un minuto.')
    setLeyendo(equipo.udid)
    const r = await emparejarEquipo(equipo.udid)
    setLeyendo(null)
    if (!r.ok) {
      setMensaje(r.mensaje)
      return
    }
    setMensaje(null)
    await leer({ ...equipo, nivel: 'emparejado' })
  }

  // Si se llegó desde la tarjeta "Equipo conectado" del panel, se lee solo.
  useEffect(() => {
    if (autoLeido.current || !udidInicial || b.lectura) return
    const equipo = equipos.find((e) => e.udid === udidInicial)
    if (equipo?.nivel === 'emparejado') {
      autoLeido.current = true
      void leer(equipo)
    }
  }, [equipos, udidInicial])

  function marcarSinAcceso() {
    const checklist: ValorChecklist = { ...b.checklist }
    for (const linea of lineas.filter((l) => l.bloque === 'funcionamiento')) {
      checklist[linea.clave] = checklist[linea.clave]?.nota
        ? { estado: 'No probado', nota: checklist[linea.clave].nota }
        : { estado: 'No probado' }
    }
    actualizar({ checklist })
  }

  function empezarDeCero() {
    try {
      localStorage.removeItem(CLAVE_BORRADOR)
    } catch {}
    setB(borradorVacio())
    setBorradorRecuperado(false)
    setHistorial([])
    autoLeido.current = false
  }

  const sugerencias = useMemo(() => {
    const eventos = b.lectura?.estabilidad?.eventos ?? []
    const porLinea = new Map<string, string>()
    for (const e of eventos) {
      if (TIPOS_FALLA.includes(e.tipo) && e.lineaChecklist && !porLinea.has(e.lineaChecklist)) {
        porLinea.set(e.lineaChecklist, e.causaProbable ?? e.resumen)
      }
    }
    return [...porLinea]
      .map(([clave, motivo]) => ({ linea: lineas.find((l) => l.clave === clave), motivo }))
      .filter((s): s is { linea: LineaCatalogo; motivo: string } => Boolean(s.linea))
  }, [b.lectura, lineas])

  const editadoTrasUsb = b.desdeUsb !== null && JSON.stringify(b.desdeUsb) !== JSON.stringify(b.equipo)
  const sinProbar = lineas.filter((l) => l.bloque === 'funcionamiento' && (b.checklist[l.clave]?.estado ?? 'No probado') === 'No probado')

  function emitir() {
    setMensaje(null)
    const accesorios = b.otroAccesorio.trim()
      ? [...b.accesorios.filter((a) => a.nombre !== 'Otro'), { nombre: 'Otro', detalle: b.otroAccesorio.trim() }]
      : b.accesorios.filter((a) => a.nombre !== 'Otro')
    const payload: PayloadIngreso = {
      lectura: b.lectura,
      origenDatos: b.lectura ? (editadoTrasUsb ? 'mixto' : 'usb') : 'manual',
      equipo: b.equipo,
      checklist: b.checklist,
      catalogoVersion,
      cliente: b.cliente,
      accesorios,
      codigoEntregado: b.codigoEntregado,
      observacionIngreso: b.observacionIngreso,
    }
    iniciarEmision(async () => {
      try {
        localStorage.removeItem(CLAVE_BORRADOR)
      } catch {}
      const r = await emitirIngreso(payload)
      if (r && !r.ok) setMensaje(r.mensaje)
    })
  }

  const cambiarEquipo = (campo: keyof DatosEquipo) => (valor: string) => {
    const equipo = { ...b.equipo, [campo]: valor }
    if (campo === 'modeloProducto') {
      const r = resolverModelo(valor, tabla)
      if (!r.requiereConfirmacion) equipo.modeloComercial = r.modeloComercial
    }
    actualizar({ equipo })
  }

  const puedeSeguir = b.paso !== 0 || b.modo !== null

  return (
    <div>
      <ol className="pasos">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className={`paso ${i === b.paso ? 'paso-actual' : i < b.paso ? 'paso-hecho' : ''}`}>
            <button type="button" className="paso-boton" disabled={i > b.paso} onClick={() => actualizar({ paso: i })} aria-current={i === b.paso ? 'step' : undefined}>
              <span className="paso-numero">{i + 1}</span> {nombre}
            </button>
          </li>
        ))}
      </ol>

      {borradorRecuperado ? (
        <div className="franja-usb" role="status">
          <p className="franja-usb-texto">Se recuperó un ingreso a medio llenar.</p>
          <button type="button" className="boton-secundario" onClick={empezarDeCero}>
            Empezar de cero
          </button>
        </div>
      ) : null}

      <AvisoEquipoConocido historial={historial} />
      {mensaje ? (
        <p className="aviso aviso-falla" role="alert">
          {mensaje}
        </p>
      ) : null}

      <div className="dos-columnas">
        <div>
          {b.paso === 0 ? (
            <section aria-labelledby="titulo-equipo">
              <h2 className="subtitulo" id="titulo-equipo">
                Equipo
              </h2>
              <p className="nota nota-seccion">{TEXTO_ESTADO_AGENTE[estadoAgente]}</p>

              {equipos.map((eq) => {
                const nombre = resolverModelo(eq.productType ?? null, tabla).modeloComercial || 'Equipo Apple'
                const leido = b.lectura?.identidad.udid === eq.udid
                return (
                  <div key={eq.udid} className={leido ? 'tarjeta tarjeta-verificado tarjeta-conectado' : 'tarjeta tarjeta-conectado'}>
                    <div>
                      <strong>{nombre}</strong>
                      <div className="nota" style={{ margin: 0 }}>
                        {eq.ios ? `iOS ${eq.ios} · ` : ''}
                        {eq.nivel === 'emparejado'
                          ? 'Confía en este PC'
                          : eq.nivel === 'sin_confianza'
                            ? 'Todavía no confía en este PC'
                            : (eq.mensaje ?? 'No responde')}
                      </div>
                    </div>
                    <div className="acciones">
                      {eq.nivel === 'sin_confianza' ? (
                        <>
                          <button type="button" className="boton" disabled={leyendo !== null} onClick={() => pedirConfianza(eq)}>
                            Pedir «Confiar»
                          </button>
                          <button type="button" className="boton-secundario" disabled={leyendo !== null} onClick={() => leer(eq)}>
                            Leer sin confianza
                          </button>
                        </>
                      ) : (
                        <button type="button" className={leido ? 'boton-secundario' : 'boton'} disabled={leyendo !== null} onClick={() => leer(eq)}>
                          {leyendo === eq.udid ? 'Leyendo…' : leido ? 'Leer de nuevo' : 'Leer por USB'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              <div className="acciones" style={{ margin: '1rem 0 1.5rem' }}>
                <button
                  type="button"
                  className={b.modo === 'manual' ? 'boton' : 'boton-secundario'}
                  onClick={() => actualizar({ modo: 'manual', lectura: null, desdeUsb: null })}
                >
                  Cargar a mano
                </button>
                <button
                  type="button"
                  className={b.modo === 'apagado' ? 'boton' : 'boton-secundario'}
                  onClick={() => {
                    actualizar({ modo: 'apagado', lectura: null, desdeUsb: null })
                    marcarSinAcceso()
                  }}
                >
                  Equipo apagado o sin acceso
                </button>
              </div>

              {b.modo !== null ? (
                <div className="formulario">
                  <div>
                    <Campo etiqueta="Modelo comercial" nombre="modeloComercial" valor={b.equipo.modeloComercial} onChange={cambiarEquipo('modeloComercial')} placeholder="iPhone 12" editable />
                    {b.equipo.modeloProducto && resolverModelo(b.equipo.modeloProducto, tabla).requiereConfirmacion ? (
                      <p className="nota">Código no reconocido; escribe el nombre comercial a mano.</p>
                    ) : null}
                  </div>
                  <Campo etiqueta="Código interno (ProductType)" nombre="modeloProducto" valor={b.equipo.modeloProducto} onChange={cambiarEquipo('modeloProducto')} placeholder="iPhone13,2" editable />
                  <Campo etiqueta="Capacidad" nombre="capacidad" valor={b.equipo.capacidad} onChange={cambiarEquipo('capacidad')} placeholder="128 GB" editable />
                  <Campo etiqueta="Versión de iOS" nombre="iosVersion" valor={b.equipo.iosVersion} onChange={cambiarEquipo('iosVersion')} placeholder="17.5.1" editable />
                  <Campo etiqueta="IMEI" nombre="imei" valor={b.equipo.imei} onChange={cambiarEquipo('imei')} placeholder="15 dígitos" editable />
                  <Campo etiqueta="Número de serie" nombre="numeroSerie" valor={b.equipo.numeroSerie} onChange={cambiarEquipo('numeroSerie')} editable />
                  <Campo etiqueta="Salud de batería (%)" nombre="bateriaPct" tipo="number" valor={b.equipo.bateriaPct} onChange={cambiarEquipo('bateriaPct')} editable />
                  <Campo etiqueta="Ciclos de batería" nombre="bateriaCiclos" tipo="number" valor={b.equipo.bateriaCiclos} onChange={cambiarEquipo('bateriaCiclos')} editable />
                  <p className="nota ancho-total">
                    {b.lectura
                      ? 'Datos leídos por USB. Si corriges alguno, la ficha queda como datos mixtos.'
                      : 'Todos los campos son opcionales: un equipo apagado o sin IMEI visible se recibe igual.'}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {b.paso === 1 ? (
            <section aria-labelledby="titulo-inspeccion">
              <h2 className="subtitulo" id="titulo-inspeccion">
                Inspección
              </h2>
              <p className="nota nota-seccion">
                Estado físico y funcionamiento, probado a mano. Lo que no se pudo probar queda «No probado» y lo cubre la cláusula de revisión limitada.
              </p>
              {sugerencias.length > 0 ? (
                <div className="tarjeta tarjeta-alerta" style={{ marginBottom: '1rem' }}>
                  <h3 className="tarjeta-titulo">La lectura USB sugiere revisar</h3>
                  {sugerencias.map(({ linea, motivo }) => (
                    <div key={linea.clave} className="acciones" style={{ justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span>
                        <strong>{linea.etiqueta}</strong>: {motivo}
                      </span>
                      <button
                        type="button"
                        className="boton-secundario"
                        disabled={b.checklist[linea.clave]?.estado === 'Falla'}
                        onClick={() =>
                          actualizar({ checklist: { ...b.checklist, [linea.clave]: { estado: 'Falla', nota: `Registro del equipo: ${motivo}` } } })
                        }
                      >
                        {b.checklist[linea.clave]?.estado === 'Falla' ? 'Marcada como falla' : 'Marcar falla'}
                      </button>
                    </div>
                  ))}
                  <p className="nota">Es una sugerencia: confírmala probando el equipo.</p>
                </div>
              ) : null}
              <div className="acciones" style={{ marginBottom: '1rem' }}>
                <button type="button" className="boton-secundario" onClick={marcarSinAcceso}>
                  Equipo apagado o sin acceso: todo «No probado»
                </button>
              </div>
              <Checklist lineas={lineas} valor={b.checklist} onChange={(checklist) => actualizar({ checklist })} nombreCampo="checklistIngreso" />
            </section>
          ) : null}

          {b.paso === 2 ? (
            <section aria-labelledby="titulo-cliente" className="formulario">
              <h2 className="subtitulo ancho-total" id="titulo-cliente">
                Cliente
              </h2>
              <Campo etiqueta="Nombre" nombre="quienLoTrajo" valor={b.cliente.quienLoTrajo} onChange={(v) => actualizar({ cliente: { ...b.cliente, quienLoTrajo: v } })} editable />
              <Campo etiqueta="Teléfono" nombre="telefono" tipo="tel" valor={b.cliente.telefono} onChange={(v) => actualizar({ cliente: { ...b.cliente, telefono: v } })} placeholder="+56 9 1234 5678" editable />
              <div className="campo ancho-total">
                <label className="campo-etiqueta" htmlFor="campo-pidio">
                  Qué pide el cliente
                </label>
                <textarea id="campo-pidio" className="campo-valor campo-entrada campo-area" value={b.cliente.pidioCliente} onChange={(e) => actualizar({ cliente: { ...b.cliente, pidioCliente: e.target.value } })} />
              </div>
              <fieldset className="ancho-total" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="campo-etiqueta">Accesorios recibidos</legend>
                <div className="casillas">
                  {ACCESORIOS.map((nombre) => (
                    <label key={nombre} className="casilla-opcion">
                      <input
                        type="checkbox"
                        checked={b.accesorios.some((a) => a.nombre === nombre)}
                        onChange={(e) =>
                          actualizar({
                            accesorios: e.target.checked ? [...b.accesorios, { nombre }] : b.accesorios.filter((a) => a.nombre !== nombre),
                          })
                        }
                      />
                      {nombre}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <Campo etiqueta="Otro accesorio" nombre="otroAccesorio" valor={b.otroAccesorio} onChange={(v) => actualizar({ otroAccesorio: v })} editable />
                </div>
              </fieldset>
              <fieldset className="ancho-total" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="campo-etiqueta">¿Dejó el código de desbloqueo?</legend>
                <div className="casillas">
                  {[
                    { valor: true, texto: 'Sí, lo dejó' },
                    { valor: false, texto: 'No lo dejó' },
                  ].map((o) => (
                    <label key={String(o.valor)} className="casilla-opcion">
                      <input type="radio" name="codigoEntregado" checked={b.codigoEntregado === o.valor} onChange={() => actualizar({ codigoEntregado: o.valor })} />
                      {o.texto}
                    </label>
                  ))}
                </div>
                <p className="nota">El código nunca se guarda en el sistema: si lo deja, anótalo en papel o pídele que lo teclee cuando haga falta.</p>
              </fieldset>
              <div className="campo ancho-total">
                <label className="campo-etiqueta" htmlFor="campo-observacion">
                  Observación general del ingreso
                </label>
                <textarea id="campo-observacion" className="campo-valor campo-entrada campo-area" value={b.observacionIngreso} onChange={(e) => actualizar({ observacionIngreso: e.target.value })} />
              </div>
            </section>
          ) : null}

          {b.paso === 3 ? (
            <section aria-labelledby="titulo-revisar">
              <h2 className="subtitulo" id="titulo-revisar">
                Revisar y emitir
              </h2>
              <dl className="datos" style={{ marginBottom: '1.25rem' }}>
                <dt>Equipo</dt>
                <dd>{[b.equipo.modeloComercial || b.equipo.modeloProducto || 'Sin modelo', b.equipo.capacidad].filter(Boolean).join(', ')}</dd>
                <dt>IMEI / serie</dt>
                <dd className="codigo-serial">{[b.equipo.imei, b.equipo.numeroSerie].filter(Boolean).join(' / ') || 'Sin datos'}</dd>
                <dt>Origen de los datos</dt>
                <dd>{b.lectura ? (editadoTrasUsb ? 'USB, con correcciones a mano' : 'Leídos por USB') : b.modo === 'apagado' ? 'Equipo apagado o sin acceso' : 'A mano'}</dd>
                <dt>Cliente</dt>
                <dd>{[b.cliente.quienLoTrajo, b.cliente.telefono].filter(Boolean).join(', ') || 'Sin datos'}</dd>
                <dt>Pide</dt>
                <dd>{b.cliente.pidioCliente || 'Sin indicar'}</dd>
                <dt>Accesorios</dt>
                <dd>{[...b.accesorios.filter((a) => a.nombre !== 'Otro').map((a) => a.nombre), b.otroAccesorio.trim()].filter(Boolean).join(', ') || 'Ninguno'}</dd>
                <dt>Código</dt>
                <dd>{b.codigoEntregado === null ? 'Sin indicar' : b.codigoEntregado ? 'Lo dejó' : 'No lo dejó'}</dd>
                <dt>Inspección</dt>
                <dd>
                  {lineas.filter((l) => tonoEstado(b.checklist[l.clave]?.estado) === 'alerta').map((l) => `${l.etiqueta}: ${b.checklist[l.clave].estado}`).join(' · ') ||
                    'Sin fallas ni daños marcados'}
                </dd>
                <dt>No probado</dt>
                <dd>{sinProbar.length === 0 ? 'Todo probado' : sinProbar.map((l) => l.etiqueta).join(', ')}</dd>
              </dl>
              {b.lectura?.estabilidad ? <p className="aviso">{textoAntecedentes(b.lectura.estabilidad)}</p> : null}
              <p className="nota">
                Al emitir se guarda la ficha y se genera el comprobante de ingreso en PDF, con las cláusulas vigentes. Queda archivado tal como se emite y
                listo para enviar al cliente.
              </p>
              <div className="acciones" style={{ marginTop: '1rem' }}>
                <button type="button" className="boton" onClick={emitir} disabled={emitiendo}>
                  {emitiendo ? 'Guardando y generando el PDF…' : 'Emitir comprobante'}
                </button>
              </div>
            </section>
          ) : null}

          <div className="acciones seccion">
            {b.paso > 0 ? (
              <button type="button" className="boton-secundario" onClick={() => actualizar({ paso: b.paso - 1 })}>
                Atrás
              </button>
            ) : null}
            {b.paso < PASOS.length - 1 ? (
              <button type="button" className="boton" disabled={!puedeSeguir} onClick={() => actualizar({ paso: b.paso + 1 })}>
                Siguiente: {PASOS[b.paso + 1]}
              </button>
            ) : null}
            {!puedeSeguir ? <span className="nota">Lee el equipo por USB, cárgalo a mano o márcalo como apagado.</span> : null}
          </div>
        </div>

        <aside className="columna-lateral" aria-label="Resultado de la lectura USB">
          {b.lectura ? (
            <ResumenLectura lectura={b.lectura} compacto />
          ) : (
            <div className="tarjeta tarjeta-apagada">
              <h3 className="tarjeta-titulo">Sin lectura USB</h3>
              <p style={{ margin: 0 }}>
                {b.modo === 'apagado'
                  ? 'Equipo recibido sin acceso por USB: el funcionamiento queda «No probado».'
                  : 'Conecta el equipo y léelo para ver batería, Buscar mi iPhone y antecedentes de fallas.'}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
