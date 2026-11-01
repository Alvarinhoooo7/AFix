import Link from 'next/link'
import { connection } from 'next/server'
import { ListaFichas } from '@/componentes/lista-fichas'
import { EquiposConectados } from '@/componentes/usb/tarjeta-conectado'
import { contarEntregadasDesde, equiposEnTaller, ultimasEntregadas, type FilaInicio } from '@/datos/fichas'
import { cargarTablaModelos } from '@/datos/modelos'
import type { EstadoFicha } from '@/dominio/ficha'

export const metadata = { title: 'Panel — AFIX' }

const COLUMNAS: { estado: EstadoFicha; titulo: string; vacio: string }[] = [
  { estado: 'recibido', titulo: 'Recibidos', vacio: 'Nada esperando revisión.' },
  { estado: 'en_reparacion', titulo: 'En reparación', vacio: 'Nada en la mesa.' },
  { estado: 'listo', titulo: 'Listos para entregar', vacio: 'Nada listo todavía.' },
]

/**
 * El panel responde lo de todos los días (plan §7.1): qué equipo está enchufado, qué hay
 * en cada etapa del taller y qué se entregó hace poco.
 */
export default async function Panel() {
  await connection()
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

  let abiertas: FilaInicio[] = []
  let entregadas: FilaInicio[] = []
  let entregadasMes = 0
  let tabla = new Map<string, string>()
  let errorConexion = false
  try {
    ;[abiertas, entregadas, entregadasMes, tabla] = await Promise.all([
      equiposEnTaller(),
      ultimasEntregadas(5),
      contarEntregadasDesde(inicioMes),
      cargarTablaModelos(),
    ])
  } catch {
    errorConexion = true
  }
  const nombreMes = ahora.toLocaleDateString('es-CL', { month: 'long' })

  return (
    <main className="hoja hoja-ancha">
      <header className="encabezado">
        <h1 className="titulo">Panel del taller</h1>
        <p className="nota">
          {abiertas.length} en el taller · {entregadasMes} entregados en {nombreMes}
        </p>
      </header>
      <div className="doble-linea" />

      {errorConexion ? (
        <p className="aviso aviso-falla" role="alert">
          No se pudo conectar con la base de datos. Revisa que el servicio esté activo.
        </p>
      ) : null}

      <section className="seccion" style={{ marginTop: 0 }} aria-label="Equipo conectado">
        <EquiposConectados tablaModelos={Object.fromEntries(tabla)} />
      </section>

      <div className="columnas-taller">
        {COLUMNAS.map((c) => {
          const filas = abiertas.filter((f) => f.estado === c.estado)
          return (
            <section key={c.estado} className="seccion">
              <h2 className="subtitulo">
                {c.titulo} ({filas.length})
              </h2>
              <ListaFichas filas={filas} modo="pendientes" vacio={c.vacio} />
            </section>
          )
        })}
      </div>

      <section className="seccion">
        <div className="subtitulo subtitulo-con-enlace">
          <h2 className="subtitulo-texto">Entregados recientemente</h2>
          <Link className="enlace" href="/historial">
            Ver todo el historial
          </Link>
        </div>
        <ListaFichas filas={entregadas} modo="historial" vacio="Todavía no hay fichas entregadas." />
      </section>
    </main>
  )
}
