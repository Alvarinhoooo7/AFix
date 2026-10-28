import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Campo } from '@/componentes/campo'
import { Timbre } from '@/componentes/timbre'
import { catalogoPorVersion } from '@/datos/catalogo'
import { obtenerEquipo } from '@/datos/equipos'
import { actualizarFicha, agregarNotaPosterior, cerrarFicha, obtenerFicha } from '@/datos/fichas'
import { compararBateria } from '@/dominio/bateria'
import { limpiarChecklist, type Checklist, type LineaCatalogo } from '@/dominio/checklist'
import { estaCongelada, TRABAJOS } from '@/dominio/ficha'
import { ChecklistControlado } from './checklists-ficha'

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

function enteroOpcional(formData: FormData, campo: string): number | null {
  const valor = String(formData.get(campo) ?? '').trim()
  if (valor === '') return null
  const numero = Number.parseInt(valor, 10)
  return Number.isNaN(numero) ? null : numero
}

function leerChecklistForm(formData: FormData, campo: string): Checklist | undefined {
  const bruto = formData.get(campo)
  if (bruto === null) return undefined
  const texto = String(bruto).trim()
  if (!texto) return {}
  try {
    return limpiarChecklist(JSON.parse(texto) as Checklist)
  } catch {
    return undefined
  }
}

async function guardarFichaAccion(formData: FormData) {
  'use server'
  const numero = Number.parseInt(String(formData.get('numero') ?? ''), 10)
  if (Number.isNaN(numero)) return

  const marcados = formData.getAll('trabajo').map((v) => String(v).trim()).filter(Boolean)
  const otro = String(formData.get('otroTrabajo') ?? '').trim()
  const trabajosRealizados = otro ? [...marcados, otro] : marcados
  const notaReparacion = String(formData.get('notaReparacion') ?? '').trim()
  const observacionIngreso = String(formData.get('observacionIngreso') ?? '').trim()
  const observacionSalida = String(formData.get('observacionSalida') ?? '').trim()
  const bateriaSalidaPct = enteroOpcional(formData, 'bateriaSalidaPct')
  const bateriaSalidaCiclos = enteroOpcional(formData, 'bateriaSalidaCiclos')
  const checklistIngreso = leerChecklistForm(formData, 'checklistIngreso')
  const checklistSalida = leerChecklistForm(formData, 'checklistSalida')
  const accion = String(formData.get('accion') ?? 'guardar')

  let guardado = true
  try {
    await actualizarFicha(numero, {
      trabajosRealizados,
      notaReparacion,
      observacionIngreso,
      observacionSalida,
      bateriaSalidaPct,
      bateriaSalidaCiclos,
      ...(checklistIngreso ? { checklistIngreso } : {}),
      ...(checklistSalida ? { checklistSalida } : {}),
    })
    if (accion === 'entregado' || accion === 'entregado_sin_reparar') {
      await cerrarFicha(numero, accion)
    }
  } catch {
    guardado = false
  }
  revalidatePath(`/fichas/${numero}`)
  redirect(guardado ? `/fichas/${numero}?guardado=1` : `/fichas/${numero}?falla=1`)
}

async function agregarNotaAccion(formData: FormData) {
  'use server'
  const numero = Number.parseInt(String(formData.get('numero') ?? ''), 10)
  if (Number.isNaN(numero)) return
  const texto = String(formData.get('textoNota') ?? '').trim()

  let guardado = true
  try {
    await agregarNotaPosterior(numero, texto)
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

  const [equipo, catalogo] = await Promise.all([
    obtenerEquipo(ficha.equipoId),
    catalogoPorVersion(ficha.catalogoVersion ?? 1).catch(() => ({ version: 1, lineas: [] as LineaCatalogo[] })),
  ])

  const congelada = estaCongelada(ficha)
  const { estandar, otro } = separarTrabajos(ficha.trabajosRealizados)
  const comparacionBateria = compararBateria(
    { pct: ficha.bateriaPct, ciclos: ficha.bateriaCiclos },
    { pct: ficha.bateriaSalidaPct, ciclos: ficha.bateriaSalidaCiclos },
  )

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
            {ficha.entregadoEn
              ? `, entregado el ${ficha.entregadoEn.toLocaleDateString('es-CL', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}`
              : ' (en taller)'}
          </p>
        </div>
        <Timbre numero={ficha.numero} />
      </header>
      <div className="doble-linea" />

      {congelada ? (
        <div className="franja-usb" role="status">
          <p className="franja-usb-texto">
            Ficha cerrada y congelada ({ficha.estado === 'entregado_sin_reparar' ? 'entregado sin reparar' : 'entregado'}).
            Los datos ya no se pueden editar; abajo puedes agregar una nota posterior con fecha.
          </p>
          <div className="acciones">
            <Link className="boton" href={`/fichas/${ficha.numero}/voucher`}>
              Ver e imprimir voucher
            </Link>
            <Link className="boton-secundario" href="/">
              Volver al inicio
            </Link>
          </div>
        </div>
      ) : null}

      {consulta.guardado ? <p className="aviso">Los cambios quedaron guardados en la ficha.</p> : null}
      {consulta.falla ? (
        <p className="aviso aviso-falla">
          No se pudieron guardar los cambios. Una ficha ya entregada está congelada y solo admite notas posteriores.
        </p>
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

      <form action={guardarFichaAccion}>
        <input type="hidden" name="numero" value={ficha.numero} />

        <section className="seccion">
          <h2 className="subtitulo">Checklist de ingreso</h2>
          <ChecklistControlado
            lineas={catalogo.lineas}
            valorInicial={ficha.checklistIngreso}
            nombreCampo="checklistIngreso"
            deshabilitado={congelada}
          />
          <div className="campo" style={{ marginTop: '1rem' }}>
            <label className="campo-etiqueta" htmlFor="campo-observacionIngreso">
              Observación general del ingreso
            </label>
            <textarea
              className="campo-valor campo-entrada campo-area"
              id="campo-observacionIngreso"
              name="observacionIngreso"
              defaultValue={ficha.observacionIngreso}
              disabled={congelada}
            />
          </div>
        </section>

        <section className="seccion">
          <h2 className="subtitulo">Reparación</h2>
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
        </section>

        <section className="seccion">
          <h2 className="subtitulo">Salida y comparación</h2>
          <div className="formulario" style={{ marginBottom: '1.25rem' }}>
            <Campo
              etiqueta="Salud de batería al entregar (%)"
              nombre="bateriaSalidaPct"
              tipo="number"
              valor={ficha.bateriaSalidaPct}
              editable={!congelada}
            />
            <Campo
              etiqueta="Ciclos de batería al entregar"
              nombre="bateriaSalidaCiclos"
              tipo="number"
              valor={ficha.bateriaSalidaCiclos}
              editable={!congelada}
            />
            {comparacionBateria.comparable ? (
              <div className="ancho-total">
                <Campo
                  etiqueta="Comparación de batería (ingreso a salida)"
                  valor={`De ${ficha.bateriaPct ?? '—'} % (${ficha.bateriaCiclos ?? '—'} ciclos) a ${
                    ficha.bateriaSalidaPct ?? '—'
                  } % (${ficha.bateriaSalidaCiclos ?? '—'} ciclos)`}
                />
              </div>
            ) : null}
          </div>

          <ChecklistControlado
            lineas={catalogo.lineas}
            valorInicial={ficha.checklistSalida}
            nombreCampo="checklistSalida"
            deshabilitado={congelada}
          />

          <div className="campo" style={{ marginTop: '1rem' }}>
            <label className="campo-etiqueta" htmlFor="campo-observacionSalida">
              Observación general de salida
            </label>
            <textarea
              className="campo-valor campo-entrada campo-area"
              id="campo-observacionSalida"
              name="observacionSalida"
              defaultValue={ficha.observacionSalida}
              disabled={congelada}
            />
          </div>
        </section>

        {!congelada ? (
          <div className="acciones seccion">
            <button className="boton" type="submit" name="accion" value="guardar">
              Guardar avances
            </button>
            <button className="boton" type="submit" name="accion" value="entregado">
              Cerrar y entregar reparado
            </button>
            <button className="boton-secundario" type="submit" name="accion" value="entregado_sin_reparar">
              Cerrar sin reparar
            </button>
            <Link className="boton-secundario" href={`/fichas/${ficha.numero}/voucher`}>
              Vista previa del voucher
            </Link>
            <Link className="boton-secundario" href="/">
              Volver al inicio
            </Link>
          </div>
        ) : null}
      </form>

      {congelada ? (
        <section className="seccion">
          <h2 className="subtitulo">Notas posteriores al cierre</h2>
          {ficha.notasPosteriores.length > 0 ? (
            <ul style={{ paddingLeft: '1.25rem', marginBottom: '1rem' }}>
              {ficha.notasPosteriores.map((nota) => (
                <li key={nota.id} style={{ marginBottom: '0.4rem' }}>
                  <strong>
                    {nota.creadaEn.toLocaleDateString('es-CL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    :
                  </strong>{' '}
                  {nota.texto}
                </li>
              ))}
            </ul>
          ) : (
            <p className="nota" style={{ marginBottom: '1rem' }}>
              No hay notas posteriores registradas en esta ficha.
            </p>
          )}
          <form action={agregarNotaAccion} className="formulario">
            <input type="hidden" name="numero" value={ficha.numero} />
            <div className="ancho-total">
              <Campo etiqueta="Agregar nota con fecha (no altera los datos originales)" nombre="textoNota" editable />
            </div>
            <div className="acciones ancho-total">
              <button className="boton" type="submit">
                Guardar nota posterior
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  )
}
