'use client'

import { useActionState, useState, useTransition } from 'react'
import { AvisoEquipoConocido, type ItemHistorialEquipo } from '@/componentes/aviso-equipo-conocido'
import { Campo } from '@/componentes/campo'
import { Checklist } from '@/componentes/checklist'
import type { Checklist as ValorChecklist, LineaCatalogo } from '@/dominio/checklist'
import { normalizarImei } from '@/dominio/equipo'
import type { DatosIngreso } from '@/dominio/ficha'
import { resolverModelo } from '@/dominio/modelos-iphone'

export type EstadoAccionIngreso = {
  mensaje: string | null
  datos: DatosIngreso
}

type PropsFormularioIngreso = {
  accionGuardar: (previo: EstadoAccionIngreso, formData: FormData) => Promise<EstadoAccionIngreso>
  accionConsultarImei?: (imei: string) => Promise<ItemHistorialEquipo[]>
  estadoInicial: EstadoAccionIngreso
  tablaModelos: Record<string, string>
  lineasCatalogo: LineaCatalogo[]
  catalogoVersion: number
  historialInicial?: ItemHistorialEquipo[]
}

export function FormularioIngreso({
  accionGuardar,
  accionConsultarImei,
  estadoInicial,
  tablaModelos,
  lineasCatalogo,
  catalogoVersion,
  historialInicial = [],
}: PropsFormularioIngreso) {
  const [estado, despachar, guardando] = useActionState(accionGuardar, estadoInicial)
  const d = estado.datos

  const [imei, setImei] = useState(d.imei ?? '')
  const [historialImei, setHistorialImei] = useState<ItemHistorialEquipo[]>(historialInicial)
  const [, iniciarTransicion] = useTransition()
  const [modeloProducto, setModeloProducto] = useState(d.modeloProducto ?? '')
  const [modeloComercial, setModeloComercial] = useState(d.modeloComercial)
  const [capacidad, setCapacidad] = useState(d.capacidad ?? '')
  const [iosVersion, setIosVersion] = useState(d.iosVersion ?? '')
  const [numeroSerie, setNumeroSerie] = useState(d.numeroSerie ?? '')
  const [bateriaPct, setBateriaPct] = useState(d.bateriaPct !== null && d.bateriaPct !== undefined ? String(d.bateriaPct) : '')
  const [bateriaCiclos, setBateriaCiclos] = useState(d.bateriaCiclos !== null && d.bateriaCiclos !== undefined ? String(d.bateriaCiclos) : '')
  const [observacionIngreso, setObservacionIngreso] = useState(d.observacionIngreso ?? '')
  const [checklist, setChecklist] = useState<ValorChecklist>(d.checklistIngreso)
  const [avisoUsb, setAvisoUsb] = useState(
    'Carga manual activa. Si conectas el equipo por USB, puedes autocompletar sus datos y verificar periféricos.',
  )
  const [escaneandoUsb, setEscaneandoUsb] = useState(false)
  const [perifericosUsb, setPerifericosUsb] = useState<Array<{ nombre: string; serial: string; estado: string }> | null>(null)
  const [plataformaUsb, setPlataformaUsb] = useState<string | null>(null)

  const mapaModelos = new Map(Object.entries(tablaModelos))
  const resolucion = resolverModelo(modeloProducto || null, mapaModelos)

  function cambiarImei(nuevoImei: string) {
    setImei(nuevoImei)
    const normalizado = normalizarImei(nuevoImei)
    if (!normalizado) {
      setHistorialImei([])
      return
    }
    if (accionConsultarImei) {
      iniciarTransicion(async () => {
        const encontrado = await accionConsultarImei(normalizado)
        setHistorialImei(encontrado)
      })
    }
  }

  function cambiarProductType(codigo: string) {
    setModeloProducto(codigo)
    const r = resolverModelo(codigo, mapaModelos)
    if (!r.requiereConfirmacion && r.modeloComercial) {
      setModeloComercial(r.modeloComercial)
    }
  }

  async function escanearUsb() {
    setEscaneandoUsb(true)
    setAvisoUsb('Leyendo hardware del dispositivo conectado por USB...')
    try {
      const res = await fetch('/api/usb/escanear')
      const data = await res.json()
      if (!data.exito) {
        setAvisoUsb(`No se detectó dispositivo por USB (${data.mensaje}). Continúa cargando a mano.`)
        return
      }

      setPlataformaUsb(data.plataforma)
      setPerifericosUsb(data.perifericos ?? null)

      const eq = data.equipo || {}
      if (eq.modeloComercial) setModeloComercial(eq.modeloComercial)
      if (eq.modeloProducto) setModeloProducto(eq.modeloProducto)
      if (eq.capacidad) setCapacidad(eq.capacidad)
      if (eq.iosVersion) setIosVersion(eq.iosVersion)
      if (eq.numeroSerie) setNumeroSerie(eq.numeroSerie)
      if (eq.bateriaPct !== undefined && eq.bateriaPct !== null) setBateriaPct(String(eq.bateriaPct))
      if (eq.bateriaCiclos !== undefined && eq.bateriaCiclos !== null) setBateriaCiclos(String(eq.bateriaCiclos))
      if (eq.imei) {
        cambiarImei(eq.imei)
      }

      // Prellenar checklist con componentes verificados
      if (data.prellenadoChecklist) {
        setChecklist((prev) => {
          const nuevo = { ...prev }
          for (const [clave, val] of Object.entries(data.prellenadoChecklist as Record<string, { estado: string; nota?: string }>)) {
            const linea = lineasCatalogo.find((l) => l.clave === clave)
            if (linea && linea.estados.includes(val.estado)) {
              nuevo[clave] = val
            }
          }
          return nuevo
        })
      }

      const plat = data.plataforma === 'ios' ? 'iPhone' : 'Android'
      setAvisoUsb(`Equipo ${plat} (${eq.modeloComercial || eq.modeloProducto}) leído exitosamente. Datos y checklist precargados.`)
    } catch {
      setAvisoUsb('El lector USB local no respondió. Continúa cargando a mano.')
    } finally {
      setEscaneandoUsb(false)
    }
  }

  function adjuntarReporteAObservaciones() {
    if (!perifericosUsb || perifericosUsb.length === 0) return
    const lineasReporte = perifericosUsb
      .map((p) => `- ${p.nombre}: ${p.serial} (${p.estado})`)
      .join('\n')
    const cabecera = `[Diagnóstico de hardware USB - ${plataformaUsb === 'ios' ? 'iPhone' : 'Android'}]`
    const bloque = `${cabecera}\n${lineasReporte}`
    setObservacionIngreso((prev) => (prev ? `${prev}\n\n${bloque}` : bloque))
  }

  function marcarFuncionamientoNoProbado() {
    const actualizado: ValorChecklist = { ...checklist }
    for (const linea of lineasCatalogo) {
      if (linea.bloque === 'funcionamiento') {
        const notaExistente = actualizado[linea.clave]?.nota
        actualizado[linea.clave] = notaExistente
          ? { estado: 'No probado', nota: notaExistente }
          : { estado: 'No probado' }
      }
    }
    setChecklist(actualizado)
  }

  return (
    <>
      <AvisoEquipoConocido historial={historialImei} />

      <div className="franja-usb" role="region" aria-label="Modo de carga de datos">
        <p className="franja-usb-texto">{avisoUsb}</p>
        <div className="acciones">
          <button
            className="boton"
            type="button"
            onClick={escanearUsb}
            disabled={escaneandoUsb}
          >
            {escaneandoUsb ? 'Leyendo USB...' : 'Escanear por USB'}
          </button>
          {perifericosUsb ? (
            <button
              className="boton-secundario"
              type="button"
              onClick={() => {
                setPerifericosUsb(null)
                setAvisoUsb('Carga manual activa.')
              }}
            >
              Ocultar periféricos
            </button>
          ) : (
            <button
              className="boton-secundario"
              type="button"
              onClick={() =>
                setAvisoUsb(
                  'Carga manual activa. Puedes dejar en blanco los datos que el equipo apagado no permita ver.',
                )
              }
            >
              Cargar a mano
            </button>
          )}
        </div>
      </div>

      {perifericosUsb && perifericosUsb.length > 0 ? (
        <section className="panel-perifericos seccion" aria-label="Verificación de componentes USB">
          <div className="panel-perifericos-cabecera">
            <h3 className="panel-perifericos-titulo">
              Hardware y periféricos verificados ({plataformaUsb === 'ios' ? 'iPhone' : 'Android'})
            </h3>
            <button
              type="button"
              className="boton-secundario"
              onClick={adjuntarReporteAObservaciones}
            >
              Adjuntar a observaciones
            </button>
          </div>
          <table className="tabla-perifericos">
            <thead>
              <tr>
                <th>Componente</th>
                <th>Número de serie / Identificador</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {perifericosUsb.map((p, idx) => (
                <tr key={idx}>
                  <td><strong>{p.nombre}</strong></td>
                  <td><code className="codigo-serial">{p.serial}</code></td>
                  <td>{p.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {estado.mensaje ? (
        <p className="aviso aviso-falla" role="alert">
          {estado.mensaje}
        </p>
      ) : null}

      <form action={despachar}>
        <input type="hidden" name="catalogoVersion" value={catalogoVersion} />

        <section className="seccion">
          <h2 className="subtitulo">Datos del equipo</h2>
          <div className="formulario">
            <div>
              <Campo
                etiqueta="Modelo comercial"
                nombre="modeloComercial"
                valor={modeloComercial}
                onChange={setModeloComercial}
                placeholder="iPhone 12"
                editable
              />
              {modeloProducto.trim() !== '' && resolucion.requiereConfirmacion ? (
                <p className="nota">Código no reconocido en la tabla; confirma o escribe el nombre comercial a mano.</p>
              ) : null}
            </div>
            <Campo
              etiqueta="Código interno (ProductType)"
              nombre="modeloProducto"
              valor={modeloProducto}
              onChange={cambiarProductType}
              placeholder="iPhone13,2"
              editable
            />
            <Campo
              etiqueta="Capacidad"
              nombre="capacidad"
              valor={capacidad}
              onChange={setCapacidad}
              placeholder="128 GB"
              editable
            />
            <Campo
              etiqueta={plataformaUsb === 'android' ? 'Versión de Android' : 'Versión de iOS'}
              nombre="iosVersion"
              valor={iosVersion}
              onChange={setIosVersion}
              placeholder="17.5.1"
              editable
            />
            <Campo
              etiqueta="IMEI"
              nombre="imei"
              valor={imei}
              onChange={cambiarImei}
              placeholder="15 dígitos"
              editable
            />
            <Campo
              etiqueta="Número de serie"
              nombre="numeroSerie"
              valor={numeroSerie}
              onChange={setNumeroSerie}
              editable
            />
            <Campo
              etiqueta="Salud de batería (%)"
              nombre="bateriaPct"
              tipo="number"
              valor={bateriaPct}
              onChange={setBateriaPct}
              editable
            />
            <Campo
              etiqueta="Ciclos de batería"
              nombre="bateriaCiclos"
              tipo="number"
              valor={bateriaCiclos}
              onChange={setBateriaCiclos}
              editable
            />
          </div>
        </section>

        <section className="seccion">
          <div className="acciones" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 className="subtitulo" style={{ margin: 0, borderBottom: 0 }}>
              Checklist de ingreso
            </h2>
            {lineasCatalogo.length > 0 ? (
              <button type="button" className="boton-secundario" onClick={marcarFuncionamientoNoProbado}>
                Equipo apagado: marcar todo como no probado
              </button>
            ) : null}
          </div>
          <Checklist
            lineas={lineasCatalogo}
            valor={checklist}
            onChange={setChecklist}
            nombreCampo="checklistIngreso"
          />
        </section>

        <section className="seccion">
          <h2 className="subtitulo">Motivo y recepción</h2>
          <div className="formulario">
            <div className="ancho-total">
              <Campo
                etiqueta="Qué pidió el cliente"
                nombre="pidioCliente"
                valor={d.pidioCliente}
                placeholder="Cambio de batería"
                editable
              />
            </div>
            <Campo
              etiqueta="Quién lo trajo"
              nombre="quienLoTrajo"
              valor={d.quienLoTrajo}
              editable
            />
            <Campo
              etiqueta="Teléfono de contacto"
              nombre="telefono"
              tipo="tel"
              valor={d.telefono}
              editable
            />
            <div className="campo ancho-total">
              <label className="campo-etiqueta" htmlFor="campo-observacionIngreso">
                Observación general del ingreso
              </label>
              <textarea
                className="campo-valor campo-entrada campo-area"
                id="campo-observacionIngreso"
                name="observacionIngreso"
                value={observacionIngreso}
                onChange={(e) => setObservacionIngreso(e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="acciones seccion">
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? 'Guardando ingreso...' : 'Guardar ingreso'}
          </button>
        </div>
      </form>
    </>
  )
}
