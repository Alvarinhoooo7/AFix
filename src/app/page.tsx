import Link from 'next/link'
import { Campo } from '@/componentes/campo'
import { buscar, equiposEnTaller, ultimasEntregadas, type FilaInicio } from '@/datos/fichas'

export const metadata = { title: 'AFIX — Servicio técnico' }

function etiquetaEstado(estado: FilaInicio['estado']): string {
  if (estado === 'en_taller') return 'En taller'
  if (estado === 'entregado_sin_reparar') return 'Entregado sin reparar'
  return 'Entregado'
}

function ListaFichas({ filas, vacio }: { filas: FilaInicio[]; vacio: string }) {
  if (filas.length === 0) {
    return <p className="nota">{vacio}</p>
  }
  return (
    <div className="lista-fichas">
      {filas.map((fila) => {
        const numero = String(fila.numero).padStart(4, '0')
        const fecha = (fila.entregadoEn ?? fila.recibidoEn).toLocaleDateString('es-CL', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        const detalles = [
          fila.quienLoTrajo ? `Traído por ${fila.quienLoTrajo}` : null,
          fila.imei ? `IMEI ${fila.imei}` : null,
          fila.trabajos.length > 0 ? fila.trabajos.join(', ') : null,
        ]
          .filter(Boolean)
          .join(' — ')

        return (
          <Link key={fila.numero} href={`/fichas/${fila.numero}`} className="fila-inicio">
            <span className="fila-inicio-ficha">Ficha {numero}</span>
            <div className="fila-inicio-cuerpo">
              <div className="fila-inicio-modelo">{fila.modeloComercial}</div>
              {detalles ? <div className="fila-inicio-meta">{detalles}</div> : null}
            </div>
            <div className="fila-inicio-meta">
              {etiquetaEstado(fila.estado)} ({fecha})
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const consulta = q?.trim() ?? ''

  let enTaller: FilaInicio[] = []
  let entregadas: FilaInicio[] = []
  let resultados: FilaInicio[] = []
  let errorConexion = false

  try {
    ;[enTaller, entregadas, resultados] = await Promise.all([
      equiposEnTaller(),
      ultimasEntregadas(10),
      consulta ? buscar(consulta) : Promise.resolve([]),
    ])
  } catch {
    errorConexion = true
  }

  return (
    <main className="hoja">
      <header className="encabezado-ficha">
        <div>
          <h1 className="titulo">Pauta de taller — AFIX</h1>
          <p className="nota">Equipos en mesa de trabajo, historial y búsqueda.</p>
        </div>
        <div className="acciones">
          <Link className="boton" href="/ingreso">
            Nuevo ingreso
          </Link>
          <Link className="boton-secundario" href="/ajustes">
            Datos del taller
          </Link>
          <a className="boton-secundario" href="/api/respaldo">
            Descargar respaldo
          </a>
        </div>
      </header>
      <div className="doble-linea" />

      {errorConexion ? (
        <p className="aviso aviso-falla" role="alert">
          No se pudo conectar con la base de datos. Revisa que el servicio esté activo.
        </p>
      ) : null}

      <section className="seccion" style={{ marginTop: 0 }}>
        <form method="get" action="/" className="formulario">
          <div className="ancho-total">
            <Campo
              etiqueta="Buscar por número de ficha, IMEI, número de serie, modelo o quién lo trajo"
              nombre="q"
              valor={consulta}
              editable
            />
          </div>
          <div className="acciones ancho-total">
            <button className="boton" type="submit">
              Buscar
            </button>
            {consulta ? (
              <Link className="boton-secundario" href="/">
                Limpiar búsqueda
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      {consulta ? (
        <section className="seccion">
          <h2 className="subtitulo">Resultados para «{consulta}»</h2>
          <ListaFichas filas={resultados} vacio="No se encontraron fichas para esa búsqueda." />
        </section>
      ) : null}

      <section className="seccion">
        <h2 className="subtitulo">Equipos en taller ({enTaller.length})</h2>
        <ListaFichas filas={enTaller} vacio="No hay equipos en taller en este momento." />
      </section>

      <section className="seccion">
        <h2 className="subtitulo">Últimas fichas entregadas</h2>
        <ListaFichas filas={entregadas} vacio="Todavía no hay fichas entregadas registradas." />
      </section>
    </main>
  )
}
