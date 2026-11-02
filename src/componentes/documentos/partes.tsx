import type { ReactNode } from 'react'
import { Logo } from '@/componentes/logo'
import { Timbre } from '@/componentes/timbre'
import type { AjustesTaller } from '@/datos/ajustes'
import type { DatoEquipo } from '@/datos/documento-ficha'
import type { RegistroEquipo } from '@/datos/fichas'
import { tonoEstado, type Checklist, type LineaCatalogo } from '@/dominio/checklist'
import { fechaHora, gravedad, motivoRegistro, nombreTipo } from '@/dominio/lectura'

const ZONA = 'America/Santiago'

export function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString('es-CL', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' })
}

export function fechaYHora(fecha: Date): string {
  return `${fechaLarga(fecha)}, ${fecha.toLocaleTimeString('es-CL', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })}`
}

export function EncabezadoDocumento({ taller, numero }: { taller: AjustesTaller; numero: number }) {
  const lineaUno = [taller.razonSocial, taller.rut ? `RUT ${taller.rut}` : null].filter(Boolean).join(' · ')
  const lineaDos = [taller.direccion, taller.telefono].filter(Boolean).join(' · ')
  const lineaTres = [taller.correo, taller.instagram, taller.whatsapp ? `WhatsApp ${taller.whatsapp}` : null].filter(Boolean).join(' · ')
  return (
    <header className="documento-encabezado">
      <div className="documento-marca">
        <Logo titulo={taller.nombre ?? 'AFix'} />
        <div>
          <p className="documento-taller">{taller.nombre ?? 'AFIX'}</p>
          {lineaUno ? <p className="documento-taller-datos">{lineaUno}</p> : null}
          {lineaDos ? <p className="documento-taller-datos">{lineaDos}</p> : null}
          {lineaTres ? <p className="documento-taller-datos">{lineaTres}</p> : null}
        </div>
      </div>
      <Timbre numero={numero} />
    </header>
  )
}

export function CampoDoc({ etiqueta, children, ancho }: { etiqueta: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'ancho-total' : undefined}>
      <span className="documento-campo-etiqueta">{etiqueta}</span>
      <span className="documento-campo-valor">{children}</span>
    </div>
  )
}

export function CamposEquipo({ datos }: { datos: DatoEquipo[] }) {
  return (
    <div className="documento-campos">
      {datos
        .filter((d) => d.valor || d.etiqueta === 'IMEI' || d.etiqueta === 'Modelo')
        .map((d) => (
          <CampoDoc key={d.etiqueta} etiqueta={d.etiqueta}>
            {d.valor ?? ''}
            {d.origen ? <span className="documento-origen">({d.origen})</span> : null}
          </CampoDoc>
        ))}
    </div>
  )
}

const CLASE_TONO = { alerta: 'estado-alerta', bien: 'estado-bien', sin_dato: 'estado-sin-dato' } as const

function Estado({ valor }: { valor: { estado: string; nota?: string } | undefined }) {
  const estado = valor?.estado ?? 'No probado'
  return (
    <>
      <span className={CLASE_TONO[tonoEstado(estado)]}>{estado}</span>
      {valor?.nota ? <span className="documento-nota-linea">{valor.nota}</span> : null}
    </>
  )
}

/** Una columna de checklist (ingreso) o dos lado a lado (entrega). */
export function TablaChecklist({
  lineas,
  bloque,
  ingreso,
  salida,
}: {
  lineas: LineaCatalogo[]
  bloque: LineaCatalogo['bloque']
  ingreso: Checklist
  salida?: Checklist
}) {
  return (
    <table className="documento-tabla">
      <thead>
        <tr>
          <th>{bloque === 'condicion' ? 'Estado físico' : 'Funcionamiento'}</th>
          <th>{salida ? 'Al ingreso' : 'Resultado'}</th>
          {salida ? <th>A la entrega</th> : null}
        </tr>
      </thead>
      <tbody>
        {lineas
          .filter((l) => l.bloque === bloque)
          .map((l) => (
            <tr key={l.clave}>
              <td>{l.etiqueta}</td>
              <td>
                <Estado valor={ingreso[l.clave]} />
              </td>
              {salida ? (
                <td>
                  <Estado valor={salida[l.clave]} />
                </td>
              ) : null}
            </tr>
          ))}
      </tbody>
    </table>
  )
}

/**
 * Cada registro del equipo con su fecha, gravedad y motivo en palabras del taller. Los de
 * gravedad alta van en rojo. La causa probable solo aparece si agrega algo al motivo.
 */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function TablaRegistros({ registros }: { registros: RegistroEquipo[] }) {
  const ordenados = [...registros].sort((a, b) => (b.fechaEvento?.getTime() ?? 0) - (a.fechaEvento?.getTime() ?? 0))
  return (
    <table className="documento-tabla">
      <thead>
        <tr>
          <th>Fecha y hora</th>
          <th>Registro</th>
          <th>Gravedad</th>
          <th>Motivo</th>
        </tr>
      </thead>
      <tbody>
        {ordenados.map((r) => {
          const nivel = gravedad(r.tipo)
          const motivo = motivoRegistro(r)
          // En bloqueos, reinicios y memoria el motivo ya lo explica; la causa probable suma en los pánicos.
          const causa = r.tipo === 'panic' || r.tipo === 'reset_counter' ? r.causaProbable : null
          return (
            <tr key={r.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{r.fechaEvento ? fechaHora(r.fechaEvento.toISOString()) : 'Sin fecha'}</td>
              <td>{capitalizar(nombreTipo(r.tipo))}</td>
              <td className={nivel === 'Alta' ? 'estado-alerta' : nivel === 'Baja' ? 'estado-sin-dato' : 'estado-bien'}>{nivel}</td>
              <td>
                {motivo}
                {causa ? <span className="documento-nota-linea">Causa probable: {causa}</span> : null}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function Clausulas({ clausulas }: { clausulas: { titulo: string; texto: string }[] }) {
  if (clausulas.length === 0) return null
  return (
    <section className="documento-seccion-larga">
      <h2>Condiciones</h2>
      <ol className="documento-clausulas">
        {clausulas.map((c) => (
          <li key={c.titulo}>
            <strong>{c.titulo}.</strong> {c.texto}
          </li>
        ))}
      </ol>
    </section>
  )
}
