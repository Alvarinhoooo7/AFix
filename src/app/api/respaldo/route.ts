import { armarZipRespaldo } from '@/dominio/respaldo'

export async function GET() {
  try {
    const { zip, fecha } = await armarZipRespaldo()
    return new Response(Buffer.from(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="respaldo-afix-${fecha}.zip"`,
      },
    })
  } catch {
    return Response.json(
      { mensaje: 'No se pudo generar el archivo de respaldo. Revisa la conexión con la base de datos.' },
      { status: 500 },
    )
  }
}
