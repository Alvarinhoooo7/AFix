/**
 * El logo AFix redibujado en SVG a partir de LOGO.jpg (plan §6.1): la A de piernas
 * abiertas con el arco que la cruza abajo. Toma el color del texto (currentColor), así
 * sirve blanco sobre la barra negra y negro sobre el papel de los documentos.
 */
export const TRAZO_LOGO =
  'M47 14 L55 14 L84 84 L77 84 L51 27 L32 84 L19 84 Z M29 86 Q50 60 86 89 L84 91 Q52 74 34 88 Z'

export function Logo({ titulo = 'AFix', className }: { titulo?: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label={titulo} fill="currentColor">
      <path d={TRAZO_LOGO} />
    </svg>
  )
}
