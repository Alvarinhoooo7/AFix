'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECCIONES = [
  { href: '/', etiqueta: 'Panel' },
  { href: '/historial', etiqueta: 'Historial' },
  { href: '/ajustes', etiqueta: 'Datos del taller' },
] as const

function activa(ruta: string, href: string): boolean {
  if (href === '/') return ruta === '/'
  return ruta === href || ruta.startsWith(`${href}/`)
}

/**
 * La barra de arriba, igual en todas las pantallas: desde cualquier parte se vuelve al
 * panel, al historial o a los datos del taller, y "Nuevo ingreso" siempre está a mano.
 * No sale en el voucher impreso.
 */
export function Navegacion() {
  const ruta = usePathname()
  return (
    <nav className="navegacion no-imprimir" aria-label="Secciones">
      <div className="navegacion-interior">
        <Link href="/" className="navegacion-marca">
          AFIX
        </Link>
        <div className="navegacion-enlaces">
          {SECCIONES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={activa(ruta, s.href) ? 'navegacion-enlace navegacion-enlace-activo' : 'navegacion-enlace'}
              aria-current={activa(ruta, s.href) ? 'page' : undefined}
            >
              {s.etiqueta}
            </Link>
          ))}
        </div>
        <Link href="/ingreso" className="boton navegacion-ingreso" aria-current={ruta === '/ingreso' ? 'page' : undefined}>
          Nuevo ingreso
        </Link>
      </div>
    </nav>
  )
}
