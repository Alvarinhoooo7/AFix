'use client'

import { useState } from 'react'
import { limpiarChecklist, type Checklist as ValorChecklist, type LineaCatalogo } from '@/dominio/checklist'

const ESTADOS_ALERTA = new Set([
  'Falla',
  'Con señales',
  'Activado',
  'Rayado',
  'Trizado',
  'Golpes',
  'Doblado',
])

function claseCasilla(estado: string, activo: boolean): string {
  if (!activo) return 'casilla'
  if (ESTADOS_ALERTA.has(estado)) return 'casilla casilla-alerta'
  if (estado === 'No probado') return 'casilla casilla-neutra'
  return 'casilla casilla-activa'
}

type PropsChecklist = {
  lineas: LineaCatalogo[]
  valor: ValorChecklist
  onChange?: (nuevo: ValorChecklist) => void
  nombreCampo?: string
  deshabilitado?: boolean
}

export function Checklist({
  lineas,
  valor,
  onChange,
  nombreCampo = 'checklist',
  deshabilitado = false,
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
                  <span className="checklist-etiqueta">{linea.etiqueta}</span>
                  <button
                    type="button"
                    className={tieneNotaEscrita ? 'boton-nota boton-nota-activa' : 'boton-nota'}
                    onClick={() => alternarNota(linea.clave)}
                    aria-label={`Nota en ${linea.etiqueta}`}
                    aria-expanded={mostrarNota}
                    disabled={deshabilitado && !tieneNotaEscrita}
                  >
                    ✎
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
      {renderizarBloque('Condición y antecedentes', condicion)}
    </div>
  )
}
