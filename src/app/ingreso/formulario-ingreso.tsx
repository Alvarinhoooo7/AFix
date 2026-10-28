'use client'

import { useActionState, useState } from 'react'
import { Campo } from '@/componentes/campo'
import type { DatosIngreso } from '@/dominio/ficha'
import { resolverModelo } from '@/dominio/modelos-iphone'

export type EstadoAccionIngreso = {
  mensaje: string | null
  datos: DatosIngreso
}

type PropsFormularioIngreso = {
  accionGuardar: (previo: EstadoAccionIngreso, formData: FormData) => Promise<EstadoAccionIngreso>
  estadoInicial: EstadoAccionIngreso
  tablaModelos: Record<string, string>
}

export function FormularioIngreso({ accionGuardar, estadoInicial, tablaModelos }: PropsFormularioIngreso) {
  const [estado, despachar, guardando] = useActionState(accionGuardar, estadoInicial)
  const d = estado.datos

  const [modeloProducto, setModeloProducto] = useState(d.modeloProducto ?? '')
  const [modeloComercial, setModeloComercial] = useState(d.modeloComercial)
  const [avisoUsb, setAvisoUsb] = useState(
    'Carga manual activa. Si no hay lectura por USB, puedes ingresar el equipo igual con los datos que tengas.',
  )

  const mapaModelos = new Map(Object.entries(tablaModelos))
  const resolucion = resolverModelo(modeloProducto || null, mapaModelos)

  function cambiarProductType(codigo: string) {
    setModeloProducto(codigo)
    const r = resolverModelo(codigo, mapaModelos)
    if (!r.requiereConfirmacion && r.modeloComercial) {
      setModeloComercial(r.modeloComercial)
    }
  }

  return (
    <>
      <div className="franja-usb" role="region" aria-label="Modo de carga de datos">
        <p className="franja-usb-texto">{avisoUsb}</p>
        <div className="acciones">
          <button
            className="boton-secundario"
            type="button"
            onClick={() =>
              setAvisoUsb('El servicio de lectura por USB no está disponible en este momento. Continúa cargando a mano.')
            }
          >
            Reintentar
          </button>
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
        </div>
      </div>

      {estado.mensaje ? (
        <p className="aviso aviso-falla" role="alert">
          {estado.mensaje}
        </p>
      ) : null}

      <form action={despachar}>
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
              valor={d.capacidad}
              placeholder="128 GB"
              editable
            />
            <Campo
              etiqueta="Versión de iOS"
              nombre="iosVersion"
              valor={d.iosVersion}
              placeholder="17.5.1"
              editable
            />
            <Campo
              etiqueta="IMEI"
              nombre="imei"
              valor={d.imei}
              placeholder="15 dígitos"
              editable
            />
            <Campo
              etiqueta="Número de serie"
              nombre="numeroSerie"
              valor={d.numeroSerie}
              editable
            />
            <Campo
              etiqueta="Salud de batería (%)"
              nombre="bateriaPct"
              tipo="number"
              valor={d.bateriaPct}
              editable
            />
            <Campo
              etiqueta="Ciclos de batería"
              nombre="bateriaCiclos"
              tipo="number"
              valor={d.bateriaCiclos}
              editable
            />
          </div>
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
                defaultValue={d.observacionIngreso}
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
