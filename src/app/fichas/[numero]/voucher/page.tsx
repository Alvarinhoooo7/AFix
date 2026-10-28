import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Campo } from '@/componentes/campo'
import { Timbre } from '@/componentes/timbre'
import { datosVoucher } from '@/datos/fichas'
import '@/estilos/impresion.css'
import { BotonImprimir } from './boton-imprimir'

const ESTADOS_ALERTA = new Set([
  'Falla',
  'Con señales',
  'Activado',
  'Rayado',
  'Trizado',
  'Golpes',
  'Doblado',
])

function claseEstadoVoucher(estado: string | undefined): string {
  if (!estado) return ''
  if (ESTADOS_ALERTA.has(estado)) return 'voucher-estado-alerta'
  if (estado !== 'No probado') return 'voucher-estado-bien'
  return ''
}

function formatearFecha(fecha: Date | null): string {
  if (!fecha) return 'En taller'
  return fecha.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PaginaVoucher({
  params,
}: {
  params: Promise<{ numero: string }>
}) {
  const { numero: textoNumero } = await params
  const numero = Number.parseInt(textoNumero, 10)
  if (Number.isNaN(numero)) notFound()

  let v: Awaited<ReturnType<typeof datosVoucher>>
  try {
    v = await datosVoucher(numero)
  } catch {
    notFound()
  }

  const datosTaller = [v.taller.telefono, v.taller.direccion].filter(Boolean).join(' — ')
  const resumenTrabajos =
    v.estado === 'entregado_sin_reparar'
      ? 'Equipo entregado sin reparar'
      : v.trabajosRealizados.length > 0
        ? v.trabajosRealizados.join(', ')
        : 'Sin trabajos registrados'

  return (
    <main className="hoja">
      <div className="acciones no-imprimir" style={{ marginBottom: '1.25rem' }}>
        <BotonImprimir />
        <Link className="boton-secundario" href={`/fichas/${v.numero}`}>
          Volver a la ficha
        </Link>
      </div>

      <header className="voucher-encabezado">
        <div>
          {v.taller.rutaLogo ? (
            <img className="marca-logo" src={v.taller.rutaLogo} alt={v.taller.nombre ?? 'AFIX'} />
          ) : (
            <h1 className="marca-nombre">{v.taller.nombre ?? 'AFIX'}</h1>
          )}
          {datosTaller ? <p className="voucher-taller-datos">{datosTaller}</p> : null}
          <p className="voucher-taller-datos">
            Ingreso: {formatearFecha(v.recibidoEn)} | Entrega: {formatearFecha(v.entregadoEn)}
          </p>
        </div>
        <Timbre numero={v.numero} />
      </header>
      <div className="doble-linea" />

      <section className="seccion voucher-bloque-imprimible" style={{ marginTop: '1rem' }}>
        <h2 className="subtitulo">Datos del equipo y trabajo realizado</h2>
        <div className="formulario">
          <Campo etiqueta="Modelo" valor={v.equipo.modeloComercial} />
          <Campo etiqueta="Capacidad" valor={v.equipo.capacidad} />
          <Campo etiqueta="IMEI" valor={v.equipo.imei} />
          <Campo etiqueta="Número de serie" valor={v.equipo.numeroSerie} />
          <Campo etiqueta="Versión de iOS" valor={v.equipo.iosVersion} />
          <Campo etiqueta="Trabajos realizados" valor={resumenTrabajos} />
          {v.bateria.comparable ? (
            <div className="ancho-total">
              <Campo
                etiqueta="Batería (antes y después)"
                valor={`Ingreso: ${v.bateria.ingreso.pct ?? '—'} % (${
                  v.bateria.ingreso.ciclos ?? '—'
                } ciclos) — Salida: ${v.bateria.salida.pct ?? '—'} % (${v.bateria.salida.ciclos ?? '—'} ciclos)`}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="seccion voucher-bloque-imprimible">
        <h2 className="subtitulo">Revisión de ingreso y salida</h2>
        <table className="voucher-tabla-comparativa">
          <thead>
            <tr>
              <th>Punto revisado</th>
              <th>Al ingreso</th>
              <th>A la entrega</th>
            </tr>
          </thead>
          <tbody>
            {v.lineas.map((linea) => {
              const ing = v.checklistIngreso[linea.clave]
              const sal = v.checklistSalida[linea.clave]
              return (
                <tr key={linea.clave}>
                  <td>{linea.etiqueta}</td>
                  <td>
                    <span className={claseEstadoVoucher(ing?.estado)}>{ing?.estado ?? 'No probado'}</span>
                    {ing?.nota ? <span className="voucher-nota-linea">{ing.nota}</span> : null}
                  </td>
                  <td>
                    <span className={claseEstadoVoucher(sal?.estado)}>{sal?.estado ?? 'No probado'}</span>
                    {sal?.nota ? <span className="voucher-nota-linea">{sal.nota}</span> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {v.observacionIngreso || v.observacionSalida ? (
        <section className="seccion voucher-bloque-imprimible">
          <h2 className="subtitulo">Observaciones</h2>
          <div className="formulario">
            {v.observacionIngreso ? (
              <div className="ancho-total">
                <Campo etiqueta="Observación al ingreso" valor={v.observacionIngreso} />
              </div>
            ) : null}
            {v.observacionSalida ? (
              <div className="ancho-total">
                <Campo etiqueta="Observación a la entrega" valor={v.observacionSalida} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  )
}
