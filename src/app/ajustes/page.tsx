import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Campo } from '@/componentes/campo'
import { guardarAjustes, leerAjustes } from '@/datos/ajustes'
import { almacenConfigurado } from '@/datos/almacen'
import { catalogoActivo, crearVersionCatalogo, type LineaNueva } from '@/datos/catalogo'
import { clausulasActivas, crearVersionClausulas } from '@/datos/clausulas'
import { EditorCatalogo, EditorClausulas, EstadoAgente } from './editores'

export const metadata = { title: 'Ajustes — AFIX' }

async function guardar(datos: FormData) {
  'use server'
  const texto = (campo: string) => String(datos.get(campo) ?? '')
  let guardado = true
  try {
    await guardarAjustes({
      nombre: texto('nombre'),
      telefono: texto('telefono'),
      direccion: texto('direccion'),
      rutaLogo: texto('rutaLogo'),
      razonSocial: texto('razonSocial'),
      rut: texto('rut'),
      correo: texto('correo'),
      instagram: texto('instagram'),
      whatsapp: texto('whatsapp'),
      garantiaMeses: Number.parseInt(texto('garantiaMeses'), 10),
    })
  } catch (error) {
    console.error('No se pudieron guardar los ajustes del taller.', error)
    guardado = false
  }
  revalidatePath('/ajustes')
  redirect(guardado ? '/ajustes?guardado=1' : '/ajustes?falla=1')
}

async function guardarClausulas(datos: FormData) {
  'use server'
  let resultado = 'guardado=1'
  try {
    await crearVersionClausulas(JSON.parse(String(datos.get('clausulas') ?? '[]')))
  } catch {
    resultado = 'falla=1'
  }
  revalidatePath('/ajustes')
  redirect(`/ajustes?${resultado}#clausulas`)
}

async function guardarCatalogo(datos: FormData) {
  'use server'
  let resultado = 'guardado=1'
  try {
    await crearVersionCatalogo(JSON.parse(String(datos.get('lineas') ?? '[]')) as LineaNueva[])
  } catch (error) {
    resultado = `falla=1&motivo=${encodeURIComponent(error instanceof Error ? error.message : '')}`
  }
  revalidatePath('/ajustes')
  redirect(`/ajustes?${resultado}#checklist`)
}

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ guardado?: string; falla?: string; motivo?: string }> }) {
  const [ajustes, clausulas, catalogo, consulta] = await Promise.all([leerAjustes(), clausulasActivas(), catalogoActivo(), searchParams])
  const storage = almacenConfigurado() !== null
  return (
    <main className="hoja">
      <header className="encabezado">
        <h1 className="titulo">Ajustes</h1>
        <p className="nota">Los datos del taller encabezan los documentos. Se pueden cambiar cuando quieras: lo ya emitido no cambia.</p>
      </header>
      <div className="doble-linea" />

      {consulta.guardado ? <p className="aviso aviso-verificado">Cambios guardados.</p> : null}
      {consulta.falla ? <p className="aviso aviso-falla">No se pudo guardar. {consulta.motivo}</p> : null}

      <form className="formulario" action={guardar}>
        <Campo etiqueta="Nombre del taller" nombre="nombre" valor={ajustes.nombre} editable />
        <Campo etiqueta="Razón social (opcional)" nombre="razonSocial" valor={ajustes.razonSocial} editable />
        <Campo etiqueta="RUT (opcional)" nombre="rut" valor={ajustes.rut} editable />
        <Campo etiqueta="Teléfono" nombre="telefono" valor={ajustes.telefono} editable />
        <div className="ancho-total">
          <Campo etiqueta="Dirección" nombre="direccion" valor={ajustes.direccion} editable />
        </div>
        <Campo etiqueta="Correo" nombre="correo" valor={ajustes.correo} editable />
        <Campo etiqueta="Instagram" nombre="instagram" valor={ajustes.instagram} placeholder="@afix" editable />
        <Campo etiqueta="WhatsApp" nombre="whatsapp" tipo="tel" valor={ajustes.whatsapp} editable />
        <Campo etiqueta="Garantía (meses)" nombre="garantiaMeses" tipo="number" valor={ajustes.garantiaMeses} editable />
        <input type="hidden" name="rutaLogo" value={ajustes.rutaLogo ?? ''} />
        <div className="acciones ancho-total">
          <button className="boton" type="submit">
            Guardar los datos
          </button>
        </div>
      </form>

      <section className="seccion" id="clausulas">
        <h2 className="subtitulo">Cláusulas del comprobante</h2>
        <EditorClausulas version={clausulas.version} clausulas={clausulas.clausulas.map(({ titulo, texto }) => ({ titulo, texto }))} accion={guardarClausulas} />
      </section>

      <section className="seccion" id="checklist">
        <h2 className="subtitulo">Checklist de inspección</h2>
        <EditorCatalogo version={catalogo.version} lineas={catalogo.lineas} accion={guardarCatalogo} />
      </section>

      <section className="seccion">
        <h2 className="subtitulo">Agente USB y documentos</h2>
        <EstadoAgente />
        <p className={storage ? 'aviso-verificado' : 'texto-alerta'}>
          {storage
            ? 'Los PDF se archivan en Supabase Storage.'
            : 'Falta configurar Supabase Storage: los PDF no se pueden emitir hasta agregar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.'}
        </p>
      </section>

      <section className="seccion">
        <h2 className="subtitulo">Respaldo</h2>
        <p className="nota nota-seccion">Descarga un .zip con todas las fichas, equipos, registros y los PDF emitidos. Guárdalo fuera de este PC.</p>
        <a className="boton-secundario" href="/api/respaldo">
          Descargar respaldo
        </a>
      </section>
    </main>
  )
}
