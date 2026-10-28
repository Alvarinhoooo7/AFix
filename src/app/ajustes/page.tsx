import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Campo } from '@/componentes/campo'
import { guardarAjustes, leerAjustes } from '@/datos/ajustes'

export const metadata = { title: 'Datos del taller — AFIX' }

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
    })
  } catch (error) {
    console.error('No se pudieron guardar los ajustes del taller.', error)
    guardado = false
  }
  revalidatePath('/ajustes')
  redirect(guardado ? '/ajustes?guardado=1' : '/ajustes?falla=1')
}

export default async function Ajustes({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string; falla?: string }>
}) {
  const [ajustes, consulta] = await Promise.all([leerAjustes(), searchParams])
  return (
    <main className="hoja">
      <header className="encabezado">
        <h1 className="titulo">Datos del taller</h1>
        <p className="nota">Encabezan el voucher que se lleva el cliente. Se cargan una sola vez.</p>
      </header>
      <div className="doble-linea" />

      <div className="marca">
        {ajustes.rutaLogo ? (
          // Mientras no exista el archivo del logo, la marca es el nombre en texto.
          <img className="marca-logo" src={ajustes.rutaLogo} alt={ajustes.nombre ?? 'AFIX'} />
        ) : (
          <p className="marca-nombre">{ajustes.nombre ?? 'AFIX'}</p>
        )}
      </div>

      {consulta.guardado ? <p className="aviso">Los datos quedaron guardados.</p> : null}
      {consulta.falla ? (
        <p className="aviso aviso-falla">No se pudieron guardar los datos. Revisa la conexión y vuelve a intentar.</p>
      ) : null}

      <form className="formulario" action={guardar}>
        <Campo etiqueta="Nombre del taller" nombre="nombre" valor={ajustes.nombre} editable />
        <Campo etiqueta="Teléfono" nombre="telefono" valor={ajustes.telefono} editable />
        <div className="ancho-total">
          <Campo etiqueta="Dirección" nombre="direccion" valor={ajustes.direccion} editable />
        </div>
        <div className="ancho-total">
          <Campo etiqueta="Ruta del logo" nombre="rutaLogo" valor={ajustes.rutaLogo} editable />
          <p className="nota">
            El logo es un archivo dentro de la carpeta public: si el archivo es public/logo.png, acá va /logo.png.
          </p>
        </div>
        <div className="acciones ancho-total">
          <button className="boton" type="submit">
            Guardar los datos
          </button>
        </div>
      </form>
    </main>
  )
}
