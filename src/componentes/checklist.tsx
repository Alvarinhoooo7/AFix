'use client'

import { useState } from 'react'
import { limpiarChecklist, tonoEstado, type Checklist as ValorChecklist, type LineaCatalogo } from '@/dominio/checklist'

function claseCasilla(estado: string, activo: boolean): string {
  if (!activo) return 'casilla'
  const tono = tonoEstado(estado)
  if (tono === 'alerta') return 'casilla casilla-alerta'
  if (tono === 'sin_dato') return 'casilla casilla-neutra'
  return 'casilla casilla-activa'
}

type PropsChecklist = {
  lineas: LineaCatalogo[]
  valor: ValorChecklist
  onChange?: (nuevo: ValorChecklist) => void
  nombreCampo?: string
  deshabilitado?: boolean
  /** En la salida: lo que se marcó al ingreso, a la vista al lado de cada línea (no se copia). */
  referencia?: ValorChecklist
}

export function Checklist({
  lineas,
  valor,
  onChange,
  nombreCampo = 'checklist',
  deshabilitado = false,
  referencia,
}: PropsChecklist) {
  const [notasAbiertas, setNotasAbiertas] = useState<Record<string, boolean>>({})

  const funcionamiento = lineas.filter((l) => l.bloque === 'funcionamiento')
  const condicion = lineas.filter((l) => l.bloque === 'condicion')

  function elegirEstado(clave: string, estado: string) {
    if (deshabilitado || !onChange) return
    const actual = valor[clave]
    onChange({
      ...valor,
      [clave]: actual?.nota !== undefined ? { estado, nota: actual.nota } : { estado },
    })
  }

  function cambiarNota(clave: string, nota: string, estadoPorDefecto: string) {
    if (deshabilitado || !onChange) return
    const estadoActual = valor[clave]?.estado ?? estadoPorDefecto
    onChange({
      ...valor,
      [clave]: { estado: estadoActual, nota },
    })
  }

  function alternarNota(clave: string) {
    setNotasAbiertas((prev) => ({ ...prev, [clave]: !prev[clave] }))
  }

  function renderizarBloque(titulo: string, filas: LineaCatalogo[]) {
    if (filas.length === 0) return null
    return (
      <div className="checklist-bloque">
        <h3 className="checklist-bloque-titulo">{titulo}</h3>
        <div className="checklist-tabla">
          {filas.map((linea) => {
            const item = valor[linea.clave]
            const tieneNotaEscrita = Boolean(item?.nota && item.nota.trim() !== '')
            const mostrarNota = Boolean(notasAbiertas[linea.clave] || tieneNotaEscrita)
            const estadoPorDefecto = linea.estados[linea.estados.length - 1] ?? 'No probado'

            return (
              <div key={linea.clave} className="checklist-fila">
                <div className="checklist-fila-principal">
                  <span className="checklist-etiqueta">
                    {linea.etiqueta}
                    {referencia ? (
                      <span className={tonoEstado(referencia[linea.clave]?.estado) === 'alerta' ? 'nota-linea texto-alerta' : 'nota-linea'}>
                        Al ingreso: {referencia[linea.clave]?.estado ?? 'No probado'}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={tieneNotaEscrita ? 'boton-nota boton-nota-activa' : 'boton-nota'}
                    onClick={() => alternarNota(linea.clave)}
                    aria-label={`Nota en ${linea.etiqueta}`}
                    aria-expanded={mostrarNota}
                    disabled={deshabilitado && !tieneNotaEscrita}
                  >
                    nota
                  </button>
                  <div className="checklist-estados" role="group" aria-label={linea.etiqueta}>
                    {linea.estados.map((estado) => {
                      const activo = item?.estado === estado
                      return (
                        <button
                          key={estado}
                          type="button"
                          className={claseCasilla(estado, activo)}
                          aria-pressed={activo}
                          disabled={deshabilitado}
                          onClick={() => elegirEstado(linea.clave, estado)}
                        >
                          {estado}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {mostrarNota ? (
                  <div className="checklist-nota-contenedor">
                    <label className="campo-etiqueta" htmlFor={`nota-${nombreCampo}-${linea.clave}`}>
                      Nota sobre {linea.etiqueta.toLowerCase()}
                    </label>
                    <input
                      id={`nota-${nombreCampo}-${linea.clave}`}
                      type="text"
                      className="campo-valor campo-entrada checklist-nota-entrada"
                      value={item?.nota ?? ''}
                      disabled={deshabilitado}
                      placeholder="Detalle observado en esta línea"
                      onChange={(e) => cambiarNota(linea.clave, e.target.value, estadoPorDefecto)}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="checklist">
      <input type="hidden" name={nombreCampo} value={JSON.stringify(limpiarChecklist(valor))} />
      {renderizarBloque('Funcionamiento', funcionamiento)}
      {renderizarBloque('Estado físico', condicion)}
    </div>
  )
}
