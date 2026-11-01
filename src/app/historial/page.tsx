import Link from 'next/link'
import { Campo } from '@/componentes/campo'
import { ListaFichas } from '@/componentes/lista-fichas'
import { buscar, listarFichas, type FilaInicio } from '@/datos/fichas'
import type { EstadoFicha } from '@/dominio/ficha'

export const metadata = { title: 'Historial — AFIX' }

const LIMITE = 200

const FILTROS = [
  { clave: 'todas', etiqueta: 'Todas', estados: null },
  { clave: 'en_taller', etiqueta: 'En taller', estados: ['en_taller'] },
  { clave: 'entregadas', etiqueta: 'Entregadas', estados: ['entregado', 'entregado_sin_reparar'] },
  { clave: 'sin_reparar', etiqueta: 'Sin reparar', estados: ['entregado_sin_reparar'] },
] as const satisfies readonly { clave: string; etiqueta: string; estados: readonly EstadoFicha[] | null }[]

type Filtro = (typeof FILTROS)[number]

function hrefFiltro(filtro: Filtro, consulta: string): string {
  const params = new URLSearchParams()
  if (consulta) params.set('q', consulta)
  if (filtro.clave !== 'todas') params.set('estado', filtro.clave)
  const texto = params.toString()
  return texto ? `/historial?${texto}` : '/historial'
}

async function cargar(filtro: Filtro, consulta: string): Promise<FilaInicio[]> {
  const estados: readonly EstadoFicha[] | null = filtro.estados
  if (!consulta) return listarFichas(estados, LIMITE)
  const filas = await buscar(consulta)
  return estados ? filas.filter((f) => estados.includes(f.estado)) : filas
}

export default async function Historial({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  const { q, estado } = await searchParams
  const consulta = q?.trim() ?? ''
  const filtro = FILTROS.find((f) => f.clave === estado) ?? FILTROS[0]

  let filas: FilaInicio[] = []
  let errorConexion = false
  try {
    filas = await cargar(filtro, consulta)
  } catch {
    errorConexion = true
  }

  return (
    <main className="hoja">
      <header className="encabezado">
        <h1 className="titulo">Historial</h1>
        <p className="nota">Todas las fichas del taller, de la más nueva a la más antigua.</p>
      </header>
      <div className="doble-linea" />

      {errorConexion ? (
        <p className="aviso aviso-falla" role="alert">
          No se pudo conectar con la base de datos. Revisa que el servicio esté activo.
        </p>
      ) : null}

      <form method="get" action="/historial" className="barra-busqueda" role="search">
        {filtro.clave !== 'todas' ? <input type="hidden" name="estado" value={filtro.clave} /> : null}
        <div className="barra-busqueda-campo">
          <Campo
            etiqueta="Buscar"
            nombre="q"
            valor={consulta}
            placeholder="Número de ficha, IMEI, número de serie, modelo o quién lo trajo"
            editable
          />
        </div>
        <button className="boton-secundario" type="submit">
          Buscar
        </button>
        {consulta ? (
          <Link className="boton-secundario" href={hrefFiltro(filtro, '')}>
            Limpiar búsqueda
          </Link>
        ) : null}
      </form>

      <nav className="filtros" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <Link
            key={f.clave}
            href={hrefFiltro(f, consulta)}
            className={f.clave === filtro.clave ? 'filtro filtro-activo' : 'filtro'}
            aria-current={f.clave === filtro.clave ? 'page' : undefined}
          >
            {f.etiqueta}
          </Link>
        ))}
      </nav>

      <section className="seccion seccion-pegada">
        <h2 className="subtitulo">
          {consulta ? `Resultados para «${consulta}»` : filtro.clave === 'todas' ? 'Todas las fichas' : filtro.etiqueta}{' '}
          ({filas.length})
        </h2>
        <ListaFichas
          filas={filas}
          modo="historial"
          vacio={consulta ? 'No se encontraron fichas para esa búsqueda.' : 'No hay fichas en esta categoría.'}
        />
        {!consulta && filas.length >= LIMITE ? (
          <p className="nota">Se muestran las {LIMITE} más recientes. Usa el buscador para encontrar una más antigua.</p>
        ) : null}
      </section>
    </main>
  )
}
