'use client'

export function BotonImprimir() {
  return (
    <button className="boton" type="button" onClick={() => window.print()}>
      Imprimir o guardar como PDF
    </button>
  )
}
