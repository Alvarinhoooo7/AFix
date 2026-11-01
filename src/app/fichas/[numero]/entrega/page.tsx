import { notFound, redirect } from 'next/navigation'
import { Timbre } from '@/componentes/timbre'
import { catalogoPorVersion } from '@/datos/catalogo'
import { obtenerEquipo } from '@/datos/equipos'
import { obtenerFicha } from '@/datos/fichas'
import { estaAbierta } from '@/dominio/ficha'
import { AsistenteEntrega } from './asistente-entrega'

export const metadata = { title: 'Entrega — AFIX' }

export default async function PaginaEntrega({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>
  searchParams: Promise<{ sinReparar?: string }>
}) {
  const [{ numero: texto }, { sinReparar }] = await Promise.all([params, searchParams])
  const numero = Number.parseInt(texto, 10)
  if (Number.isNaN(numero)) notFound()
  const f = await obtenerFicha(numero)
  if (!f) notFound()
  if (!estaAbierta(f.estado)) redirect(`/fichas/${numero}`)
  const [equipo, catalogo] = await Promise.all([obtenerEquipo(f.equipoId), catalogoPorVersion(f.catalogoVersion ?? 1)])

  return (
    <main className="hoja hoja-ancha">
      <header className="encabezado-ficha">
        <div>
          <h1 className="titulo">Entrega{sinReparar ? ' sin reparar' : ''}</h1>
          <p className="nota">
            {equipo?.modeloComercial ?? 'Equipo sin modelo'}
            {f.quienLoTrajo ? ` · ${f.quienLoTrajo}` : ''}
          </p>
        </div>
        <Timbre numero={f.numero} />
      </header>
      <div className="doble-linea" />
      <AsistenteEntrega
        numero={f.numero}
        recibidoEn={f.recibidoEn.toISOString()}
        listoEn={f.listoEn?.toISOString() ?? null}
        lineas={catalogo.lineas}
        checklistIngreso={f.checklistIngreso}
        checklistSalidaInicial={f.checklistSalida}
        observacionSalidaInicial={f.observacionSalida}
        lecturaIngreso={f.lecturaIngreso}
        lecturaSalidaInicial={f.lecturaSalida}
        vigilanciaInicial={f.vigilanciaSalida}
        trabajos={f.trabajosRealizados}
        bateriaIngreso={{ pct: f.bateriaPct, ciclos: f.bateriaCiclos }}
        identidad={{ imei: equipo?.imei ?? null, numeroSerie: equipo?.numeroSerie ?? null, udid: equipo?.udid ?? null }}
        sinReparar={Boolean(sinReparar)}
      />
    </main>
  )
}
