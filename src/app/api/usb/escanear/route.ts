import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { cargarTablaModelos } from '@/datos/modelos'
import { resolverModelo } from '@/dominio/modelos-iphone'

const execFileAsync = promisify(execFile)

export async function GET() {
  const pythonPath = 'C:\\Users\\alvar\\pmd3\\Scripts\\python.exe'
  const scriptPath = path.join(process.cwd(), 'scripts', 'lector_usb.py')

  try {
    const { stdout } = await execFileAsync(pythonPath, [scriptPath], {
      timeout: 10000,
      encoding: 'utf8',
    })

    const parseado = JSON.parse(stdout.trim())

    if (!parseado.exito) {
      return NextResponse.json({
        exito: false,
        mensaje: parseado.error || 'No se detectó ningún dispositivo por USB.',
      })
    }

    // Resolver modelo comercial si es iOS y viene el productType
    if (parseado.plataforma === 'ios' && parseado.equipo?.modeloProducto) {
      try {
        const tabla = await cargarTablaModelos()
        const resolucion = resolverModelo(parseado.equipo.modeloProducto, tabla)
        if (resolucion.modeloComercial) {
          parseado.equipo.modeloComercial = resolucion.modeloComercial
        }
      } catch {
        // Fallback no bloqueante si falla la consulta de BD
      }
    }

    return NextResponse.json(parseado)
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      exito: false,
      mensaje: `No se pudo conectar con el lector USB local: ${detalle}`,
    })
  }
}
