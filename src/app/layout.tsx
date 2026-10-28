import { Archivo, Archivo_Narrow } from 'next/font/google'
import type { ReactNode } from 'react'
import '@/estilos/tokens.css'

// Una sola familia en dos anchos (diseño §10): Archivo para valores y texto corrido,
// Archivo Narrow para etiquetas de campo y el timbre. tokens.css las lee desde estas
// variables, así que el nombre de cada una no se cambia sin cambiarlo también allá.
const archivo = Archivo({ subsets: ['latin'], display: 'swap', variable: '--fuente-archivo' })
const archivoEstrecha = Archivo_Narrow({
  subsets: ['latin'],
  display: 'swap',
  variable: '--fuente-archivo-estrecha',
})

export const metadata = { title: 'AFIX' }

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${archivoEstrecha.variable}`}>
      <body>{children}</body>
    </html>
  )
}
