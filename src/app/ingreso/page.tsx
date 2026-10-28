import { redirect } from 'next/navigation'
import type { ItemHistorialEquipo } from '@/componentes/aviso-equipo-conocido'
import { catalogoActivo } from '@/datos/catalogo'
import { historialDeImei } from '@/datos/equipos'
import { intentarGuardarIngreso } from '@/datos/fichas'
import { cargarTablaModelos } from '@/datos/modelos'
import { obtenerDb } from '@/db/cliente'
import { limpiarChecklist, type Checklist, type LineaCatalogo } from '@/dominio/checklist'
import type { DatosIngreso } from '@/dominio/ficha'
import { resolverModelo } from '@/dominio/modelos-iphone'
import { FormularioIngreso, type EstadoAccionIngreso } from './formulario-ingreso'

export const metadata = { title: 'Ingreso de equipo — AFIX' }

function datosVacios(catalogoVersion = 1): DatosIngreso {
  return {
    imei: null,
    numeroSerie: null,
    modeloProducto: null,
    modeloComercial: '',
    capacidad: null,
    iosVersion: null,
    bateriaPct: null,
    bateriaCiclos: null,
    pidioCliente: '',
    quienLoTrajo: null,
    telefono: null,
    observacionIngreso: '',
    checklistIngreso: {},
    catalogoVersion,
    origenDatos: 'manual',
  }
}

function textoOpcional(formData: FormData, campo: string): string | null {
  const valor = String(formData.get(campo) ?? '').trim()
  return valor === '' ? null : valor
}

function enteroOpcional(formData: FormData, campo: string): number | null {
  const valor = String(formData.get(campo) ?? '').trim()
  if (valor === '') return null
  const numero = Number.parseInt(valor, 10)
  return Number.isNaN(numero) ? null : numero
}

function leerChecklistForm(formData: FormData, campo: string): Checklist {
  const bruto = String(formData.get(campo) ?? '').trim()
  if (!bruto) return {}
  try {
    const parsed = JSON.parse(bruto) as Checklist
    return limpiarChecklist(parsed)
  } catch {
    return {}
  }
}

async function consultarHistorialAccion(imei: string): Promise<ItemHistorialEquipo[]> {
  'use server'
  try {
    return await historialDeImei(imei)
  } catch {
    return []
  }
}

async function guardarIngresoAccion(_previo: EstadoAccionIngreso, formData: FormData): Promise<EstadoAccionIngreso> {
  'use server'
  let tabla = new Map<string, string>()
  try {
    tabla = await cargarTablaModelos()
  } catch {
    // Si la base no responde al cargar la tabla, intentarGuardarIngreso capturará el fallo.
  }

  const modeloProducto = textoOpcional(formData, 'modeloProducto')
  const modeloEscrito = String(formData.get('modeloComercial') ?? '').trim()
  const modeloComercial =
    modeloEscrito !== '' ? modeloEscrito : resolverModelo(modeloProducto, tabla).modeloComercial

  const versionLeida = enteroOpcional(formData, 'catalogoVersion') ?? 1

  const datos: DatosIngreso = {
    imei: textoOpcional(formData, 'imei'),
    numeroSerie: textoOpcional(formData, 'numeroSerie'),
    modeloProducto,
    modeloComercial,
    capacidad: textoOpcional(formData, 'capacidad'),
    iosVersion: textoOpcional(formData, 'iosVersion'),
    bateriaPct: enteroOpcional(formData, 'bateriaPct'),
    bateriaCiclos: enteroOpcional(formData, 'bateriaCiclos'),
    pidioCliente: String(formData.get('pidioCliente') ?? '').trim(),
    quienLoTrajo: textoOpcional(formData, 'quienLoTrajo'),
    telefono: textoOpcional(formData, 'telefono'),
    observacionIngreso: String(formData.get('observacionIngreso') ?? '').trim(),
    checklistIngreso: leerChecklistForm(formData, 'checklistIngreso'),
    catalogoVersion: versionLeida,
    origenDatos: 'manual',
  }

  const resultado = await intentarGuardarIngreso(datos, { db: obtenerDb() })
  if (!resultado.ok) {
    return { mensaje: resultado.mensaje, datos: resultado.datos }
  }
  redirect(`/fichas/${resultado.ficha.numero}`)
}

export default async function PaginaIngreso() {
  let tabla = new Map<string, string>()
  let lineas: LineaCatalogo[] = []
  let version = 1
  try {
    const [tablaCargada, catalogo] = await Promise.all([cargarTablaModelos(), catalogoActivo()])
    tabla = tablaCargada
    lineas = catalogo.lineas
    version = catalogo.version
  } catch {
    // Permite abrir la pantalla y escribir a mano aunque la base no responda en ese instante.
  }

  return (
    <main className="hoja">
      <header className="encabezado">
        <h1 className="titulo">Ingreso de equipo</h1>
        <p className="nota">
          Todos los campos son opcionales: si el equipo llega apagado o sin IMEI visible, la ficha se guarda igual.
        </p>
      </header>
      <div className="doble-linea" />

      <FormularioIngreso
        accionGuardar={guardarIngresoAccion}
        accionConsultarImei={consultarHistorialAccion}
        estadoInicial={{ mensaje: null, datos: datosVacios(version) }}
        tablaModelos={Object.fromEntries(tabla)}
        lineasCatalogo={lineas}
        catalogoVersion={version}
      />
    </main>
  )
}
