import { leerAjustes, type AjustesTaller } from '@/datos/ajustes'
import { catalogoPorVersion } from '@/datos/catalogo'
import { clausulasDeFicha, textoClausula } from '@/datos/clausulas'
import { obtenerEquipo, type Equipo, type Ficha } from '@/datos/equipos'
import { obtenerFicha, registrosDeFicha, type RegistroEquipo } from '@/datos/fichas'
import { compararBateria, type ComparacionBateria } from '@/dominio/bateria'
import type { LineaCatalogo } from '@/dominio/checklist'
import { vencimientoGarantia } from '@/dominio/ficha'
import { compararPiezas, type DiferenciaPieza } from '@/dominio/lectura'

export type OrigenDato = 'USB' | 'Declarado' | null

export type DatoEquipo = { etiqueta: string; valor: string | null; origen: OrigenDato }

export type DatosDocumento = {
  ficha: Ficha
  equipo: Equipo | null
  taller: AjustesTaller
  lineas: LineaCatalogo[]
  clausulas: { titulo: string; texto: string }[]
  datosEquipo: DatoEquipo[]
  registros: RegistroEquipo[]
  bateria: ComparacionBateria
  piezas: DiferenciaPieza[]
  garantiaMeses: number
  garantiaHasta: Date | null
}

/** De dónde salió un dato: si coincide con la lectura USB, del USB; si no, lo declaró alguien. */
function origen(valor: string | null | undefined, leido: string | null | undefined, hayLectura: boolean): OrigenDato {
  if (!valor) return null
  if (!hayLectura) return 'Declarado'
  return leido && valor.replace(/\s/g, '').toUpperCase().startsWith(leido.replace(/\s/g, '').toUpperCase()) ? 'USB' : 'Declarado'
}

/**
 * Todo lo que imprimen el comprobante de ingreso y el informe de entrega (plan §6.2 y
 * §6.3), con la versión de cláusulas y de checklist que tenía la ficha.
 */
export async function datosDocumento(numero: number): Promise<DatosDocumento | null> {
  const ficha = await obtenerFicha(numero)
  if (!ficha) return null
  const [equipo, taller, catalogo, clausulas, registros] = await Promise.all([
    obtenerEquipo(ficha.equipoId),
    leerAjustes(),
    catalogoPorVersion(ficha.catalogoVersion ?? 1),
    clausulasDeFicha(ficha.clausulasVersion),
    registrosDeFicha(numero),
  ])
  const l = ficha.lecturaIngreso
  const hay = l !== null
  const garantiaMeses = ficha.garantiaMeses ?? taller.garantiaMeses
  const datosEquipo: DatoEquipo[] = [
    { etiqueta: 'Modelo', valor: equipo?.modeloComercial ?? null, origen: equipo?.modeloComercial ? (hay && l.identidad.productType === equipo.modeloProducto ? 'USB' : 'Declarado') : null },
    { etiqueta: 'Número de modelo', valor: equipo?.numeroModelo ?? null, origen: equipo?.numeroModelo ? 'USB' : null },
    { etiqueta: 'Capacidad', valor: equipo?.capacidad ?? null, origen: origen(equipo?.capacidad, l?.identidad.capacidad, hay) },
    { etiqueta: 'Color', valor: equipo?.color ?? null, origen: equipo?.color ? 'Declarado' : null },
    { etiqueta: 'IMEI', valor: equipo?.imei ?? null, origen: origen(equipo?.imei, l?.identidad.imei, hay) },
    { etiqueta: 'IMEI 2', valor: equipo?.imei2 ?? null, origen: origen(equipo?.imei2, l?.identidad.imei2, hay) },
    { etiqueta: 'Número de serie', valor: equipo?.numeroSerie ?? null, origen: origen(equipo?.numeroSerie, l?.identidad.numeroSerie, hay) },
    { etiqueta: 'Versión de iOS', valor: ficha.iosVersion, origen: origen(ficha.iosVersion, l?.sistema.ios, hay) },
  ]
  return {
    ficha,
    equipo,
    taller,
    lineas: catalogo.lineas,
    clausulas: (clausulas?.clausulas ?? []).map((c) => ({ titulo: c.titulo, texto: textoClausula(c.texto, garantiaMeses) })),
    datosEquipo,
    registros,
    bateria: compararBateria(
      { pct: ficha.bateriaPct, ciclos: ficha.bateriaCiclos },
      { pct: ficha.bateriaSalidaPct, ciclos: ficha.bateriaSalidaCiclos },
    ),
    piezas: compararPiezas(ficha.lecturaIngreso?.piezas ?? [], ficha.lecturaSalida?.piezas ?? [], ficha.trabajosRealizados),
    garantiaMeses,
    garantiaHasta: ficha.entregadoEn && ficha.estado === 'entregado' ? vencimientoGarantia(ficha.entregadoEn, garantiaMeses) : null,
  }
}
