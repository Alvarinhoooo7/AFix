import type { ReactNode } from 'react'

export const metadata = { title: 'AFIX' }

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
