'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/componentes/logo'

const SECCIONES = [
  { href: '/', etiqueta: 'Panel' },
  { href: '/historial', etiqueta: 'Historial' },
  { href: '/ajustes', etiqueta: 'Ajustes' },
] as const

function activa(ruta: string, href: string): boolean {
  if (href === '/') return ruta === '/'
  return ruta === href || ruta.startsWith(`${href}/`)
}

/**
 * La barra negra de arriba, igual en todas las pantallas (plan §7): logo, secciones, el
 * buscador siempre a mano con Ctrl+K y "Nuevo ingreso". No sale en los documentos.
 */
export function Navegacion() {
  const ruta = usePathname()
  const router = useRouter()
  const [buscando, setBuscando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscando(true)
      } else if (e.key === 'Escape') {
        setBuscando(false)
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  useEffect(() => {
    if (buscando) entrada.current?.focus()
  }, [buscando])

  if (ruta.startsWith('/imprimir')) return null

  return (
    <>
      <nav className="navegacion no-imprimir" aria-label="Secciones">
        <div className="navegacion-interior">
          <Link href="/" className="navegacion-marca">
            <Logo titulo="" />
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
          <button type="button" className="navegacion-atajo" onClick={() => setBuscando(true)}>
            Buscar <kbd>Ctrl+K</kbd>
          </button>
          <Link href="/ingreso" className="boton navegacion-ingreso" aria-current={ruta === '/ingreso' ? 'page' : undefined}>
            Nuevo ingreso
          </Link>
        </div>
      </nav>
      {buscando ? (
        <div className="buscador-rapido no-imprimir" role="dialog" aria-modal="true" aria-label="Buscar una ficha" onClick={() => setBuscando(false)}>
          <form
            role="search"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              const texto = entrada.current?.value.trim() ?? ''
              setBuscando(false)
              router.push(texto ? `/historial?q=${encodeURIComponent(texto)}` : '/historial')
            }}
          >
            <label className="campo-etiqueta" htmlFor="buscador-rapido">
              Número de ficha, IMEI, serie, modelo, cliente o teléfono
            </label>
            <input ref={entrada} id="buscador-rapido" className="campo-valor campo-entrada" name="q" autoComplete="off" />
            <p className="nota">Enter para buscar, Esc para cerrar.</p>
          </form>
        </div>
      ) : null}
    </>
  )
}
