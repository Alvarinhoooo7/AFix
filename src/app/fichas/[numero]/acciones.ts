'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { emitirDocumento, marcarEnviado, type TipoDocumento } from '@/datos/documentos'
import {
  actualizarFicha,
  agregarNotaPosterior,
  cambiarEstado,
  cerrarFicha,
  guardarLecturaSalida,
  guardarVigilancia,
} from '@/datos/fichas'
import { limpiarChecklist, type Checklist } from '@/dominio/checklist'
import { TRABAJOS, type EstadoCierre, type PiezaCambiada, type ResultadoVigilancia } from '@/dominio/ficha'
import type { EventoEstabilidad, Lectura } from '@/dominio/lectura'
import { esLectura } from '@/dominio/validar-lectura'

type Resultado = { ok: true } | { ok: false; mensaje: string }

function numeroDe(formData: FormData): number {
  return Number.parseInt(String(formData.get('numero') ?? ''), 10)
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo guardar.'
}

export async function cambiarEstadoAccion(formData: FormData) {
  const numero = numeroDe(formData)
  const hacia = String(formData.get('hacia'))
  let falla = false
  if (hacia === 'recibido' || hacia === 'en_reparacion' || hacia === 'listo') {
    try {
      await cambiarEstado(numero, hacia)
    } catch {
      falla = true
    }
  }
  revalidatePath(`/fichas/${numero}`)
  redirect(`/fichas/${numero}${falla ? '?falla=1' : '?guardado=1'}`)
}

/** Trabajos, piezas cambiadas (para la garantía y el aviso de iOS) y la nota de taller. */
export async function guardarReparacionAccion(formData: FormData) {
  const numero = numeroDe(formData)
  const marcados = formData.getAll('trabajo').map((v) => String(v)).filter((t) => TRABAJOS.includes(t))
  const otro = String(formData.get('otroTrabajo') ?? '').trim()
  const trabajosRealizados = otro ? [...marcados, otro] : marcados
  const piezasCambiadas: PiezaCambiada[] = trabajosRealizados
    .map((trabajo) => ({
      trabajo,
      pieza: String(formData.get(`pieza:${trabajo}`) ?? '').trim(),
      calidad: formData.get(`calidad:${trabajo}`) === 'compatible' ? ('compatible' as const) : ('original' as const),
    }))
    .filter((p) => p.pieza !== '')
  let falla = false
  try {
    await actualizarFicha(numero, {
      trabajosRealizados,
      piezasCambiadas,
      notaReparacion: String(formData.get('notaReparacion') ?? '').trim(),
    })
  } catch {
    falla = true
  }
  revalidatePath(`/fichas/${numero}`)
  redirect(`/fichas/${numero}${falla ? '?falla=1' : '?guardado=1'}`)
}

export async function guardarLecturaSalidaAccion(numero: number, lectura: Lectura): Promise<Resultado> {
  if (!esLectura(lectura)) return { ok: false, mensaje: 'La lectura recibida no es válida.' }
  try {
    await guardarLecturaSalida(numero, lectura)
    return { ok: true }
  } catch (error) {
    return { ok: false, mensaje: mensajeDe(error) }
  }
}

export async function guardarVigilanciaAccion(
  numero: number,
  resultado: ResultadoVigilancia,
  eventos: EventoEstabilidad[],
): Promise<Resultado> {
  try {
    await guardarVigilancia(numero, resultado, eventos)
    return { ok: true }
  } catch (error) {
    return { ok: false, mensaje: mensajeDe(error) }
  }
}

/**
 * Cierra la ficha y emite el informe de entrega. El cierre va primero: el informe lleva la
 * fecha de entrega y la garantía. Si el PDF falla, la ficha queda cerrada igual y se puede
 * reemitir desde la ficha.
 */
export async function entregarAccion(
  numero: number,
  estado: EstadoCierre,
  checklistSalida: Checklist,
  observacionSalida: string,
): Promise<Resultado> {
  try {
    await actualizarFicha(numero, { checklistSalida: limpiarChecklist(checklistSalida), observacionSalida: observacionSalida.trim() })
    await cerrarFicha(numero, estado)
  } catch (error) {
    return { ok: false, mensaje: mensajeDe(error) }
  }
  const emision = await emitirDocumento(numero, 'salida')
  revalidatePath(`/fichas/${numero}`)
  redirect(emision.ok ? `/fichas/${numero}?emitido=salida` : `/fichas/${numero}?sinDocumento=salida`)
}

export async function reemitirAccion(formData: FormData) {
  const numero = numeroDe(formData)
  const tipo: TipoDocumento = formData.get('tipo') === 'salida' ? 'salida' : 'ingreso'
  const emision = await emitirDocumento(numero, tipo)
  revalidatePath(`/fichas/${numero}`)
  redirect(emision.ok ? `/fichas/${numero}?emitido=${tipo}` : `/fichas/${numero}?sinDocumento=${tipo}`)
}

export async function marcarEnviadoAccion(id: string): Promise<void> {
  await marcarEnviado(id)
}

export async function agregarNotaAccion(formData: FormData) {
  const numero = numeroDe(formData)
  let falla = false
  try {
    await agregarNotaPosterior(numero, String(formData.get('textoNota') ?? ''))
  } catch {
    falla = true
  }
  revalidatePath(`/fichas/${numero}`)
  redirect(`/fichas/${numero}${falla ? '?falla=1' : '?guardado=1'}`)
}
