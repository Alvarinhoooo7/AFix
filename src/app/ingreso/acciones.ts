'use server'

import { redirect } from 'next/navigation'
import type { ItemHistorialEquipo } from '@/componentes/aviso-equipo-conocido'
import { leerAjustes } from '@/datos/ajustes'
import { clausulasActivas } from '@/datos/clausulas'
import { emitirDocumento } from '@/datos/documentos'
import { historialPorIdentificadores, type IdentificadoresEquipo } from '@/datos/equipos'
import { intentarGuardarIngreso } from '@/datos/fichas'
import { cargarTablaModelos } from '@/datos/modelos'
import { limpiarChecklist, type Checklist } from '@/dominio/checklist'
import { ACCESORIOS, type Accesorio } from '@/dominio/ficha'
import type { Lectura } from '@/dominio/lectura'
import { resolverModelo } from '@/dominio/modelos-iphone'
import { esLectura } from '@/dominio/validar-lectura'

export type PayloadIngreso = {
  lectura: Lectura | null
  origenDatos: 'usb' | 'manual' | 'mixto'
  equipo: {
    modeloProducto: string
    modeloComercial: string
    capacidad: string
    iosVersion: string
    imei: string
    numeroSerie: string
    bateriaPct: string
    bateriaCiclos: string
  }
  checklist: Checklist
  catalogoVersion: number
  cliente: { quienLoTrajo: string; telefono: string; pidioCliente: string }
  accesorios: Accesorio[]
  codigoEntregado: boolean | null
  observacionIngreso: string
}

export type ResultadoEmision = { ok: false; mensaje: string }

function texto(valor: string | undefined): string | null {
  const limpio = valor?.trim() ?? ''
  return limpio === '' ? null : limpio
}

function entero(valor: string | undefined): number | null {
  const numero = Number.parseInt(valor?.trim() ?? '', 10)
  return Number.isNaN(numero) ? null : numero
}

/** Solo accesorios de la lista, más "Otro" con su detalle escrito. */
function accesoriosValidos(lista: Accesorio[]): Accesorio[] {
  return lista
    .filter((a) => ACCESORIOS.includes(a.nombre) || (a.nombre === 'Otro' && a.detalle?.trim()))
    .map((a) => (a.nombre === 'Otro' ? { nombre: 'Otro', detalle: a.detalle!.trim() } : { nombre: a.nombre }))
}

export async function consultarHistorial(ids: IdentificadoresEquipo): Promise<ItemHistorialEquipo[]> {
  try {
    return await historialPorIdentificadores(ids)
  } catch {
    return []
  }
}

/**
 * Guarda el ingreso y emite el comprobante en PDF. Si el PDF falla (por ejemplo, Storage
 * sin configurar), la ficha queda guardada igual y la ficha ofrece reintentar: el ingreso
 * nunca se pierde por un documento.
 */
export async function emitirIngreso(payload: PayloadIngreso): Promise<ResultadoEmision> {
  const lectura = esLectura(payload.lectura) ? payload.lectura : null
  const e = payload.equipo

  let tabla = new Map<string, string>()
  let clausulasVersion: number | null = null
  let garantiaMeses: number | null = null
  try {
    const [t, clausulas, ajustes] = await Promise.all([cargarTablaModelos(), clausulasActivas(), leerAjustes()])
    tabla = t
    clausulasVersion = clausulas.version
    garantiaMeses = ajustes.garantiaMeses
  } catch {
    // Si la base no responde, intentarGuardarIngreso lo informa con su propio mensaje.
  }

  const modeloProducto = texto(e.modeloProducto)
  const resultado = await intentarGuardarIngreso({
    imei: texto(e.imei),
    numeroSerie: texto(e.numeroSerie),
    modeloProducto,
    modeloComercial: texto(e.modeloComercial) ?? resolverModelo(modeloProducto, tabla).modeloComercial,
    capacidad: texto(e.capacidad),
    iosVersion: texto(e.iosVersion),
    bateriaPct: entero(e.bateriaPct),
    bateriaCiclos: entero(e.bateriaCiclos),
    pidioCliente: payload.cliente.pidioCliente.trim(),
    quienLoTrajo: texto(payload.cliente.quienLoTrajo),
    telefono: texto(payload.cliente.telefono),
    observacionIngreso: payload.observacionIngreso.trim(),
    checklistIngreso: limpiarChecklist(payload.checklist ?? {}),
    catalogoVersion: payload.catalogoVersion,
    origenDatos: lectura ? payload.origenDatos : 'manual',
    lectura,
    identidad: lectura
      ? {
          imei2: lectura.identidad.imei2,
          udid: lectura.identidad.udid,
          ecid: lectura.identidad.ecid,
          numeroModelo: lectura.identidad.numeroModelo,
          region: lectura.identidad.region,
        }
      : undefined,
    accesorios: accesoriosValidos(payload.accesorios ?? []),
    codigoEntregado: payload.codigoEntregado,
    clausulasVersion,
    garantiaMeses,
  })
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje }

  const numero = resultado.ficha.numero
  const emision = await emitirDocumento(numero, 'ingreso')
  redirect(emision.ok ? `/fichas/${numero}?emitido=ingreso` : `/fichas/${numero}?sinDocumento=ingreso`)
}
