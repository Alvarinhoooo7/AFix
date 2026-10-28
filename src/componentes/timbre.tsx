/** El número de ficha como timbre de goma: borde grueso rojo, levemente rotado. */
export function Timbre({ numero }: { numero: number }) {
  return (
    <span className="timbre">
      <span className="timbre-rotulo">Ficha</span>
      <span className="timbre-numero">{String(numero).padStart(4, '0')}</span>
    </span>
  )
}
