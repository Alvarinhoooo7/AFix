import { armarRespaldo } from '@/dominio/respaldo'

export async function GET() {
  try {
    const respaldo = await armarRespaldo()
    const fecha = respaldo.generadoEn.slice(0, 10)
    const cuerpo = JSON.stringify(respaldo, null, 2)

    return new Response(cuerpo, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="respaldo-afix-${fecha}.json"`,
      },
    })
  } catch {
    return Response.json(
      { mensaje: 'No se pudo generar el archivo de respaldo. Revisa la conexión con la base de datos.' },
      { status: 500 },
    )
  }
}
