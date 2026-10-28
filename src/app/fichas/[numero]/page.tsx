import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Campo } from '@/componentes/campo'
import { Timbre } from '@/componentes/timbre'
import { obtenerEquipo } from '@/datos/equipos'
import { actualizarFicha, obtenerFicha } from '@/datos/fichas'
import { estaCongelada, TRABAJOS } from '@/dominio/ficha'

function separarTrabajos(trabajos: string[]): { estandar: Set<string>; otro: string } {
  const conjuntoEstandar = new Set<string>(TRABAJOS)
  const elegidos = new Set<string>()
  const extras: string[] = []
  for (const t of trabajos) {
    if (conjuntoEstandar.has(t)) elegidos.add(t)
    else if (t.trim() !== '') extras.push(t.trim())
  }
  return { estandar: elegidos, otro: extras.join(', ') }
}

async function guardarReparacionAccion(formData: FormData) {
  'use server'
  const numero = Number.parseInt(String(formData.get('numero') ?? ''), 10)
  if (Number.isNaN(numero)) return

  const marcados = formData.getAll('trabajo').map((v) => String(v).trim()).filter(Boolean)
  const otro = String(formData.get('otroTrabajo') ?? '').trim()
  const trabajosRealizados = otro ? [...marcados, otro] : marcados
  const notaReparacion = String(formData.get('notaReparacion') ?? '').trim()

  let guardado = true
  try {
    await actualizarFicha(numero, { trabajosRealizados, notaReparacion })
  } catch {
    guardado = false
  }
  revalidatePath(`/fichas/${numero}`)
  redirect(guardado ? `/fichas/${numero}?guardado=1` : `/fichas/${numero}?falla=1`)
}

export default async function PaginaFicha({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>
  searchParams: Promise<{ guardado?: string; falla?: string }>
}) {
  const [{ numero: textoNumero }, consulta] = await Promise.all([params, searchParams])
  const numero = Number.parseInt(textoNumero, 10)
  if (Number.isNaN(numero)) notFound()

  const ficha = await obtenerFicha(numero)
  if (!ficha) notFound()

  const equipo = await obtenerEquipo(ficha.equipoId)
  const congelada = estaCongelada(ficha)
  const { estandar, otro } = separarTrabajos(ficha.trabajosRealizados)

  return (
    <main className="hoja">
      <header className="encabezado-ficha">
        <div>
          <h1 className="titulo">{equipo?.modeloComercial ?? 'Equipo sin modelo'}</h1>
          <p className="nota">
            Recibido el{' '}
            {ficha.recibidoEn.toLocaleDateString('es-CL', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <Timbre numero={ficha.numero} />
      </header>
      <div className="doble-linea" />

      {consulta.guardado ? <p className="aviso">Los cambios quedaron guardados en la ficha.</p> : null}
      {consulta.falla ? (
        <p className="aviso aviso-falla">No se pudieron guardar los cambios. Revisa el estado de la ficha.</p>
      ) : null}

      <section className="seccion">
        <h2 className="subtitulo">Datos del equipo y motivo</h2>
        <div className="formulario">
          <Campo etiqueta="Modelo" valor={equipo?.modeloComercial} />
          <Campo etiqueta="Capacidad" valor={equipo?.capacidad} />
          <Campo etiqueta="IMEI" valor={equipo?.imei} />
          <Campo etiqueta="Número de serie" valor={equipo?.numeroSerie} />
          <Campo etiqueta="Versión de iOS" valor={ficha.iosVersion} />
          <Campo
            etiqueta="Batería al ingreso"
            valor={
              ficha.bateriaPct != null || ficha.bateriaCiclos != null
                ? `${ficha.bateriaPct != null ? `${ficha.bateriaPct} %` : 'Sin %'} / ${
                    ficha.bateriaCiclos != null ? `${ficha.bateriaCiclos} ciclos` : 'Sin ciclos'
                  }`
                : null
            }
          />
          <div className="ancho-total">
            <Campo etiqueta="Qué pidió el cliente" valor={ficha.pidioCliente} />
          </div>
          <Campo etiqueta="Quién lo trajo" valor={ficha.quienLoTrajo} />
          <Campo etiqueta="Teléfono" valor={ficha.telefono} />
        </div>
      </section>

      <section className="seccion">
        <h2 className="subtitulo">Reparación</h2>
        <form action={guardarReparacionAccion}>
          <input type="hidden" name="numero" value={ficha.numero} />
          <div className="grilla-trabajos" role="group" aria-label="Trabajos realizados">
            {TRABAJOS.map((trabajo) => (
              <label key={trabajo} className="casilla-trabajo">
                <input
                  type="checkbox"
                  name="trabajo"
                  value={trabajo}
                  defaultChecked={estandar.has(trabajo)}
                  disabled={congelada}
                />
                <span>{trabajo}</span>
              </label>
            ))}
          </div>

          <div className="formulario">
            <div className="ancho-total">
              <Campo
                etiqueta="Otro trabajo realizado"
                nombre="otroTrabajo"
                valor={otro}
                editable={!congelada}
              />
            </div>
            <div className="campo ancho-total">
              <label className="campo-etiqueta" htmlFor="campo-notaReparacion">
                Nota de la reparación (uso interno del taller, no se imprime en el voucher)
              </label>
              <textarea
                className="campo-valor campo-entrada campo-area"
                id="campo-notaReparacion"
                name="notaReparacion"
                defaultValue={ficha.notaReparacion}
                disabled={congelada}
              />
            </div>
          </div>

          {!congelada ? (
            <div className="acciones seccion">
              <button className="boton" type="submit">
                Guardar reparación
              </button>
              <Link className="boton-secundario" href="/">
                Volver al inicio
              </Link>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  )
}
