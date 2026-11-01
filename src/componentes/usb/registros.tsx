import { fechaHora, nombreTipo, TIPOS_FALLA, type TipoRegistro } from '@/dominio/lectura'

export type RegistroVisible = {
  clave: string
  tipo: TipoRegistro
  fecha: string | null
  resumen: string
  causaProbable: string | null
  texto: string
  momento?: 'ingreso' | 'salida' | 'vigilancia'
  nuevo?: boolean
}

const ETIQUETA_MOMENTO = { ingreso: 'Al ingreso', salida: 'En la salida', vigilancia: 'Durante la vigilancia' } as const

/**
 * Los registros del iPhone, cada uno con su texto original tal cual (plan §3.7): se abren
 * como texto en la web, con la traducción al lado. Nada se descarga.
 */
export function ListaRegistros({ registros, vacio }: { registros: RegistroVisible[]; vacio: string }) {
  if (registros.length === 0) return <p className="nota">{vacio}</p>
  return (
    <div>
      {registros.map((r) => {
        const falla = TIPOS_FALLA.includes(r.tipo)
        return (
          <details key={r.clave} className="registro">
            <summary>
              <span className="registro-fecha">{r.fecha ? fechaHora(r.fecha) : 'Sin fecha'}</span>
              <span className={falla ? 'texto-alerta' : 'texto-secundario'}>{nombreTipo(r.tipo)}</span>
              <span>{r.resumen}</span>
              {r.momento ? <span className="etiqueta">{ETIQUETA_MOMENTO[r.momento]}</span> : null}
              {r.nuevo ? <span className="etiqueta texto-alerta">Nuevo</span> : null}
            </summary>
            {r.causaProbable ? <p className="registro-causa">Causa probable: {r.causaProbable}</p> : null}
            <pre className="registro-texto">{r.texto}</pre>
          </details>
        )
      })}
    </div>
  )
}
