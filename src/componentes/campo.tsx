/**
 * Un campo de la pauta: etiqueta chica en Archivo Narrow sobre una línea inferior de 1px,
 * valor en Archivo semibold con tinta de lápiz pasta. Nunca una caja con borde completo.
 *
 * Sin `editable` es solo lectura, y un valor nulo deja la línea en blanco, como en el papel.
 */
type PropsCampo = {
  etiqueta: string
  valor?: string | number | null
  editable?: boolean
  nombre?: string
  placeholder?: string
  tipo?: 'text' | 'number' | 'tel'
  onChange?: (valor: string) => void
}

function claveCampo(etiqueta: string, nombre?: string): string {
  if (nombre) return nombre
  return etiqueta
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function Campo(props: PropsCampo) {
  const textoValor = props.valor == null ? '' : String(props.valor)
  if (!props.editable) {
    return (
      <div className="campo">
        <span className="campo-etiqueta">{props.etiqueta}</span>
        <span className="campo-valor">{textoValor}</span>
      </div>
    )
  }
  const nombre = claveCampo(props.etiqueta, props.nombre)
  const id = `campo-${nombre}`
  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={id}>
        {props.etiqueta}
      </label>
      <input
        className="campo-valor campo-entrada"
        id={id}
        name={nombre}
        type={props.tipo ?? 'text'}
        placeholder={props.placeholder}
        {...(props.onChange
          ? { value: textoValor, onChange: (e) => props.onChange?.(e.target.value) }
          : { defaultValue: textoValor })}
      />
    </div>
  )
}
