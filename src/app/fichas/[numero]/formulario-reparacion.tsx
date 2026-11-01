'use client'

import { useState } from 'react'
import { TRABAJOS, type PiezaCambiada } from '@/dominio/ficha'

/**
 * Trabajos realizados y, por cada uno, la pieza que se puso y su calidad (plan §4): sirve
 * para la garantía y para explicar el aviso "pieza desconocida" de iOS.
 */
export function FormularioReparacion({
  numero,
  trabajos,
  piezas,
  nota,
  accion,
}: {
  numero: number
  trabajos: string[]
  piezas: PiezaCambiada[]
  nota: string
  accion: (formData: FormData) => Promise<void>
}) {
  const otroInicial = trabajos.filter((t) => !TRABAJOS.includes(t)).join(', ')
  const [elegidos, setElegidos] = useState<string[]>(trabajos.filter((t) => TRABAJOS.includes(t)))
  const [otro, setOtro] = useState(otroInicial)
  const conPieza = otro.trim() ? [...elegidos, otro.trim()] : elegidos

  return (
    <form action={accion}>
      <input type="hidden" name="numero" value={numero} />
      <div className="casillas" role="group" aria-label="Trabajos realizados" style={{ marginBottom: '1rem' }}>
        {TRABAJOS.map((t) => (
          <label key={t} className="casilla-opcion">
            <input
              type="checkbox"
              name="trabajo"
              value={t}
              checked={elegidos.includes(t)}
              onChange={(e) => setElegidos(e.target.checked ? [...elegidos, t] : elegidos.filter((x) => x !== t))}
            />
            {t}
          </label>
        ))}
      </div>
      <div className="campo" style={{ marginBottom: '1rem' }}>
        <label className="campo-etiqueta" htmlFor="campo-otroTrabajo">
          Otro trabajo realizado
        </label>
        <input id="campo-otroTrabajo" className="campo-valor campo-entrada" name="otroTrabajo" value={otro} onChange={(e) => setOtro(e.target.value)} />
      </div>

      {conPieza.length > 0 ? (
        <table className="tabla" style={{ marginBottom: '1rem' }}>
          <thead>
            <tr>
              <th>Trabajo</th>
              <th>Pieza puesta</th>
              <th>Calidad</th>
            </tr>
          </thead>
          <tbody>
            {conPieza.map((t) => {
              const actual = piezas.find((p) => p.trabajo === t)
              return (
                <tr key={t}>
                  <td>{t}</td>
                  <td>
                    <input
                      className="campo-valor campo-entrada"
                      name={`pieza:${t}`}
                      defaultValue={actual?.pieza ?? ''}
                      placeholder="Ej.: batería 4325 mAh"
                      aria-label={`Pieza puesta en ${t}`}
                    />
                  </td>
                  <td>
                    <select className="campo-valor campo-entrada" name={`calidad:${t}`} defaultValue={actual?.calidad ?? 'original'} aria-label={`Calidad de la pieza en ${t}`}>
                      <option value="original">Original</option>
                      <option value="compatible">Compatible</option>
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}

      <div className="campo">
        <label className="campo-etiqueta" htmlFor="campo-notaReparacion">
          Nota de taller (solo para ti: no sale en ningún documento)
        </label>
        <textarea id="campo-notaReparacion" className="campo-valor campo-entrada campo-area" name="notaReparacion" defaultValue={nota} />
      </div>
      <div className="acciones" style={{ marginTop: '1rem' }}>
        <button className="boton" type="submit">
          Guardar reparación
        </button>
      </div>
    </form>
  )
}
