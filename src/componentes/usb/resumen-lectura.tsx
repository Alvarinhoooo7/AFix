import {
  avisosDeContexto,
  fechaHora,
  NO_INFORMADO,
  textoAntecedentes,
  textoBuscarMiIphone,
  TIPOS_FALLA,
  type Lectura,
} from '@/dominio/lectura'
import { ListaRegistros } from './registros'

const NIVEL = {
  emparejado: 'Lectura completa (equipo emparejado)',
  sin_confianza: 'Lectura parcial: el equipo no confió en este PC',
  recuperacion: 'Equipo en modo recuperación',
} as const

function valor(v: string | number | null | undefined, sufijo = ''): string {
  return v === null || v === undefined || v === '' ? NO_INFORMADO : `${v}${sufijo}`
}

function gigas(bytes: number | null | undefined): string {
  return bytes == null ? NO_INFORMADO : `${(bytes / 1e9).toFixed(1)} GB`
}

/**
 * Lo que el USB leyó, con lo importante arriba: Buscar mi iPhone, antecedentes de
 * estabilidad y batería. Todo lo ausente dice "No informado por el equipo" (plan §3.4).
 * `compacto` es la columna lateral del asistente; completo va en la ficha.
 */
export function ResumenLectura({ lectura, compacto = false }: { lectura: Lectura; compacto?: boolean }) {
  const fmi = lectura.seguridad.buscarMiIphone
  const bateria = lectura.bateria
  const contexto = avisosDeContexto(lectura)
  const estabilidad = lectura.estabilidad
  const fallas = estabilidad?.eventos.filter((e) => TIPOS_FALLA.includes(e.tipo)) ?? []

  return (
    <div>
      <section className={fmi.estado === 'activo' ? 'tarjeta tarjeta-alerta' : 'tarjeta'}>
        <h3 className="tarjeta-titulo">Seguridad</h3>
        <dl className="datos">
          <dt>Buscar mi iPhone</dt>
          <dd className={fmi.estado === 'activo' || fmi.estado === 'no_concluyente' ? 'texto-alerta' : undefined}>
            {textoBuscarMiIphone(fmi)}
          </dd>
          <dt>Activación</dt>
          <dd>{valor(lectura.seguridad.activacion)}</dd>
          <dt>Código</dt>
          <dd>
            {lectura.seguridad.codigoConfigurado === null ? NO_INFORMADO : lectura.seguridad.codigoConfigurado ? 'Configurado' : 'Sin código'}
          </dd>
        </dl>
        {fmi.estado === 'activo' ? (
          <p className="nota">Confirma con el cliente que la cuenta es suya. Para restaurar o cambiar placa hay que desactivarlo.</p>
        ) : null}
      </section>

      <section className={fallas.length > 0 ? 'tarjeta tarjeta-alerta' : 'tarjeta'}>
        <h3 className="tarjeta-titulo">Antecedentes de estabilidad</h3>
        {estabilidad ? (
          <>
            <p style={{ margin: 0 }}>{textoAntecedentes(estabilidad)}</p>
            {!compacto ? (
              <div style={{ marginTop: '0.75rem' }}>
                <ListaRegistros
                  registros={estabilidad.eventos.map((e) => ({ clave: e.nombre, ...e }))}
                  vacio="El equipo no tiene registros de fallas."
                />
              </div>
            ) : fallas.length > 0 ? (
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
                {fallas.slice(0, 6).map((e) => (
                  <li key={e.nombre}>
                    {e.fecha ? fechaHora(e.fecha) : 'Sin fecha'}: {e.causaProbable ?? e.resumen}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="nota" style={{ margin: 0 }}>
            {lectura.nivel === 'emparejado' ? 'No se pudieron leer los registros del equipo.' : 'Se leen cuando el equipo confía en este PC.'}
          </p>
        )}
      </section>

      <section className={bateria?.saludPct != null && bateria.saludPct < 80 ? 'tarjeta tarjeta-alerta' : 'tarjeta'}>
        <h3 className="tarjeta-titulo">Batería y carga</h3>
        {bateria ? (
          <dl className="datos">
            <dt>Salud</dt>
            <dd className={bateria.saludPct != null && bateria.saludPct < 80 ? 'texto-alerta' : undefined}>
              {valor(bateria.saludPct, ' %')}
              {bateria.capacidadActualMah && bateria.capacidadDisenoMah
                ? ` (${bateria.capacidadActualMah} de ${bateria.capacidadDisenoMah} mAh)`
                : ''}
            </dd>
            <dt>Ciclos</dt>
            <dd>{valor(bateria.ciclos)}</dd>
            {!compacto ? (
              <>
                <dt>Carga actual</dt>
                <dd>
                  {valor(bateria.cargaPct, ' %')}
                  {bateria.cargando ? ', cargando' : ''}
                </dd>
                <dt>Serie</dt>
                <dd className="codigo-serial">{valor(bateria.serie)}</dd>
              </>
            ) : null}
            <dt>Cargador</dt>
            <dd>
              {lectura.carga?.conectado
                ? [lectura.carga.descripcion, lectura.carga.watts ? `${lectura.carga.watts} W` : null].filter(Boolean).join(', ') ||
                  'Conectado'
                : lectura.carga?.conectado === false
                  ? 'No conectado'
                  : NO_INFORMADO}
            </dd>
          </dl>
        ) : (
          <p className="nota" style={{ margin: 0 }}>
            Se lee cuando el equipo confía en este PC.
          </p>
        )}
      </section>

      {contexto.length > 0 ? (
        <section className="tarjeta">
          <h3 className="tarjeta-titulo">Para tener en cuenta</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {contexto.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {!compacto ? (
        <>
          <section className="tarjeta">
            <h3 className="tarjeta-titulo">Equipo</h3>
            <dl className="datos">
              <dt>Modelo</dt>
              <dd>
                {valor(lectura.identidad.productType)}
                {lectura.identidad.numeroModelo ? ` · ${lectura.identidad.numeroModelo}` : ''}
              </dd>
              <dt>Capacidad</dt>
              <dd>{valor(lectura.identidad.capacidad)}</dd>
              <dt>IMEI</dt>
              <dd className="codigo-serial">
                {valor(lectura.identidad.imei)}
                {lectura.identidad.imei2 ? ` / ${lectura.identidad.imei2}` : ''}
              </dd>
              <dt>Serie</dt>
              <dd className="codigo-serial">{valor(lectura.identidad.numeroSerie)}</dd>
              <dt>iOS</dt>
              <dd>
                {valor(lectura.sistema.ios)}
                {lectura.sistema.build ? ` (${lectura.sistema.build})` : ''}
              </dd>
              <dt>Almacenamiento libre</dt>
              <dd>
                {lectura.almacenamiento
                  ? `${gigas(lectura.almacenamiento.libreBytes)}${lectura.almacenamiento.pctLibre != null ? ` (${lectura.almacenamiento.pctLibre} %)` : ''}`
                  : NO_INFORMADO}
              </dd>
              <dt>Red</dt>
              <dd>{[lectura.red.operador, lectura.red.sim, lectura.red.bandeja].filter(Boolean).join(' · ') || NO_INFORMADO}</dd>
            </dl>
          </section>

          {lectura.piezas.length > 0 ? (
            <section className="tarjeta">
              <h3 className="tarjeta-titulo">Series de piezas</h3>
              <table className="tabla">
                <tbody>
                  {lectura.piezas.map((p) => (
                    <tr key={p.clave}>
                      <td>{p.nombre}</td>
                      <td className="codigo-serial">{p.serie ?? NO_INFORMADO}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="nota">Que una pieza entregue su serie no prueba que funcione: eso es la inspección.</p>
            </section>
          ) : null}
        </>
      ) : null}

      <p className="nota">
        {NIVEL[lectura.nivel]}. Leído el {fechaHora(lectura.leidoEn)}.
        {lectura.avisos.length > 0 ? ` No se pudo leer: ${lectura.avisos.join(', ')}.` : ''}
      </p>
    </div>
  )
}
