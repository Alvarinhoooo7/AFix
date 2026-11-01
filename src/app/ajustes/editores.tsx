'use client'

import { useState } from 'react'
import { TEXTO_ESTADO_AGENTE, useAgente } from '@/componentes/usb/agente'
import type { LineaCatalogo } from '@/dominio/checklist'

type ClausulaEditable = { titulo: string; texto: string }

/** Las cláusulas se editan como una lista y se guardan como versión nueva. */
export function EditorClausulas({
  version,
  clausulas,
  accion,
}: {
  version: number
  clausulas: ClausulaEditable[]
  accion: (formData: FormData) => Promise<void>
}) {
  const [lista, setLista] = useState(clausulas)
  const cambiar = (i: number, campo: keyof ClausulaEditable, valor: string) =>
    setLista(lista.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)))

  return (
    <form action={accion}>
      <input type="hidden" name="clausulas" value={JSON.stringify(lista)} />
      <p className="nota nota-seccion">
        Versión vigente: {version}. Guardar crea la versión {version + 1}; los comprobantes ya emitidos conservan la que aceptó el cliente.
        Donde diga {'{meses}'} se imprime la garantía en meses.
      </p>
      {lista.map((c, i) => (
        <div key={i} className="tarjeta" style={{ marginBottom: '0.75rem' }}>
          <div className="campo">
            <label className="campo-etiqueta" htmlFor={`clausula-titulo-${i}`}>
              Título de la cláusula {i + 1}
            </label>
            <input id={`clausula-titulo-${i}`} className="campo-valor campo-entrada" value={c.titulo} onChange={(e) => cambiar(i, 'titulo', e.target.value)} />
          </div>
          <div className="campo" style={{ marginTop: '0.5rem' }}>
            <label className="campo-etiqueta" htmlFor={`clausula-texto-${i}`}>
              Texto
            </label>
            <textarea id={`clausula-texto-${i}`} className="campo-valor campo-entrada campo-area" value={c.texto} onChange={(e) => cambiar(i, 'texto', e.target.value)} />
          </div>
          <div className="acciones" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="boton-secundario" disabled={i === 0} onClick={() => setLista([...lista.slice(0, i - 1), c, lista[i - 1], ...lista.slice(i + 1)])}>
              Subir
            </button>
            <button type="button" className="boton-secundario" onClick={() => setLista(lista.filter((_, j) => j !== i))}>
              Quitar
            </button>
          </div>
        </div>
      ))}
      <div className="acciones">
        <button type="button" className="boton-secundario" onClick={() => setLista([...lista, { titulo: '', texto: '' }])}>
          Agregar cláusula
        </button>
        <button type="submit" className="boton">
          Guardar como versión {version + 1}
        </button>
      </div>
    </form>
  )
}

type LineaEditable = { clave?: string; etiqueta: string; bloque: LineaCatalogo['bloque']; estados: string }

/** El checklist se edita igual: línea por línea, y se guarda como versión nueva. */
export function EditorCatalogo({
  version,
  lineas,
  accion,
}: {
  version: number
  lineas: LineaCatalogo[]
  accion: (formData: FormData) => Promise<void>
}) {
  const [lista, setLista] = useState<LineaEditable[]>(
    lineas.map((l) => ({ clave: l.clave, etiqueta: l.etiqueta, bloque: l.bloque, estados: l.estados.join(', ') })),
  )
  const cambiar = (i: number, cambios: Partial<LineaEditable>) => setLista(lista.map((l, j) => (j === i ? { ...l, ...cambios } : l)))
  const paraGuardar = lista.map((l) => ({ ...l, estados: l.estados.split(',').map((e) => e.trim()) }))

  return (
    <form action={accion}>
      <input type="hidden" name="lineas" value={JSON.stringify(paraGuardar)} />
      <p className="nota nota-seccion">
        Versión vigente: {version}. Los estados van separados por coma; el último es el que queda marcado si no se toca. Guardar crea la versión{' '}
        {version + 1} para los ingresos nuevos.
      </p>
      <table className="tabla">
        <thead>
          <tr>
            <th>Línea</th>
            <th>Bloque</th>
            <th>Estados</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lista.map((l, i) => (
            <tr key={l.clave ?? `nueva-${i}`}>
              <td>
                <input className="campo-valor campo-entrada" aria-label="Etiqueta" value={l.etiqueta} onChange={(e) => cambiar(i, { etiqueta: e.target.value })} />
              </td>
              <td>
                <select className="campo-valor campo-entrada" aria-label="Bloque" value={l.bloque} onChange={(e) => cambiar(i, { bloque: e.target.value as LineaEditable['bloque'] })}>
                  <option value="funcionamiento">Funcionamiento</option>
                  <option value="condicion">Estado físico</option>
                </select>
              </td>
              <td>
                <input className="campo-valor campo-entrada" aria-label="Estados" value={l.estados} onChange={(e) => cambiar(i, { estados: e.target.value })} />
              </td>
              <td>
                <button type="button" className="boton-secundario" onClick={() => setLista(lista.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="acciones" style={{ marginTop: '0.75rem' }}>
        <button type="button" className="boton-secundario" onClick={() => setLista([...lista, { etiqueta: '', bloque: 'funcionamiento', estados: 'Bien, Falla, No probado' }])}>
          Agregar línea
        </button>
        <button type="submit" className="boton">
          Guardar como versión {version + 1}
        </button>
      </div>
    </form>
  )
}

export function EstadoAgente() {
  const { estado, equipos } = useAgente()
  return (
    <p className={estado === 'activo' ? 'aviso-verificado' : estado === 'conectando' ? 'nota' : 'texto-alerta'}>
      {TEXTO_ESTADO_AGENTE[estado]}
      {equipos.length > 0 ? ` Conectados: ${equipos.length}.` : ''}
    </p>
  )
}
