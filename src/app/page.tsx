import Link from 'next/link'
import { Campo } from '@/componentes/campo'
import { ListaFichas } from '@/componentes/lista-fichas'
import { contarEntregadasDesde, equiposEnTaller, ultimasEntregadas, type FilaInicio } from '@/datos/fichas'

export const metadata = { title: 'Panel — AFIX' }

/**
 * El panel responde lo de todos los días, en este orden: qué está pendiente en la mesa,
 * cómo va el mes y qué se entregó hace poco. Buscar lleva al historial, que es donde
 * vive la lista completa.
 */
export default async function Panel() {
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

  let enTaller: FilaInicio[] = []
  let entregadas: FilaInicio[] = []
  let entregadasMes = 0
  let errorConexion = false

  try {
    ;[enTaller, entregadas, entregadasMes] = await Promise.all([
      equiposEnTaller(),
      ultimasEntregadas(5),
      contarEntregadasDesde(inicioMes),
    ])
  } catch {
    errorConexion = true
  }

  const nombreMes = ahora.toLocaleDateString('es-CL', { month: 'long' })
  const hoy = ahora.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <main className="hoja">
      <header className="encabezado">
        <h1 className="titulo">Panel del taller</h1>
        <p className="nota">{hoy.charAt(0).toUpperCase() + hoy.slice(1)}</p>
      </header>
      <div className="doble-linea" />

      {errorConexion ? (
        <p className="aviso aviso-falla" role="alert">
          No se pudo conectar con la base de datos. Revisa que el servicio esté activo.
        </p>
      ) : null}

      <section className="resumen" aria-label="Resumen">
        <a className="resumen-casilla" href="#pendientes">
          <span className="resumen-numero">{enTaller.length}</span>
          <span className="resumen-rotulo">Pendientes en taller</span>
        </a>
        <Link className="resumen-casilla" href="/historial?estado=entregadas">
          <span className="resumen-numero">{entregadasMes}</span>
          <span className="resumen-rotulo">Entregados en {nombreMes}</span>
        </Link>
        <Link className="resumen-casilla resumen-casilla-accion" href="/ingreso">
          <span className="resumen-numero">+</span>
          <span className="resumen-rotulo">Recibir un equipo</span>
        </Link>
      </section>

      <form method="get" action="/historial" className="barra-busqueda" role="search">
        <div className="barra-busqueda-campo">
          <Campo
            etiqueta="Buscar una ficha"
            nombre="q"
            placeholder="Número de ficha, IMEI, número de serie, modelo o quién lo trajo"
            editable
          />
        </div>
        <button className="boton-secundario" type="submit">
          Buscar
        </button>
      </form>

      <section className="seccion" id="pendientes">
        <h2 className="subtitulo">Pendientes en taller ({enTaller.length})</h2>
        <p className="nota nota-seccion">Equipos recibidos que todavía no se entregan. Abre la ficha para repararlo y cerrarlo.</p>
        <ListaFichas
          filas={enTaller}
          modo="pendientes"
          vacio="No hay equipos pendientes. Cuando recibas uno, regístralo con Nuevo ingreso."
        />
      </section>

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
