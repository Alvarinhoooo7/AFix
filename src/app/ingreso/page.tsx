import { catalogoActivo } from '@/datos/catalogo'
import { cargarTablaModelos } from '@/datos/modelos'
import type { LineaCatalogo } from '@/dominio/checklist'
import { AsistenteIngreso } from './asistente-ingreso'

export const metadata = { title: 'Nuevo ingreso — AFIX' }

export default async function PaginaIngreso({ searchParams }: { searchParams: Promise<{ udid?: string }> }) {
  const { udid } = await searchParams
  let tabla = new Map<string, string>()
  let lineas: LineaCatalogo[] = []
  let version = 1
  let errorConexion = false
  try {
    const [tablaCargada, catalogo] = await Promise.all([cargarTablaModelos(), catalogoActivo()])
    tabla = tablaCargada
    lineas = catalogo.lineas
    version = catalogo.version
  } catch {
    // Permite abrir la pantalla y escribir a mano aunque la base no responda en ese instante.
    errorConexion = true
  }

  return (
    <main className="hoja hoja-ancha">
      <header className="encabezado">
        <h1 className="titulo">Nuevo ingreso</h1>
      </header>
      <div className="doble-linea" />
      {errorConexion ? (
        <p className="aviso aviso-falla" role="alert">
          No se pudo conectar con la base de datos: puedes llenar el ingreso, pero no se podrá emitir hasta que vuelva.
        </p>
      ) : null}
      <AsistenteIngreso tablaModelos={Object.fromEntries(tabla)} lineas={lineas} catalogoVersion={version} udidInicial={udid ?? null} />
    </main>
  )
}
