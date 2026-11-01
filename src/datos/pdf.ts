import { chromium } from 'playwright-core'

/**
 * Imprime a PDF una página de la propia app con Microsoft Edge, que viene con Windows 11:
 * no hay que descargar Chromium (plan §6.1). Lo que se ve en /imprimir es lo que sale.
 */
export async function generarPdf(url: string): Promise<Uint8Array> {
  const navegador = await chromium.launch({ channel: process.env.PDF_NAVEGADOR ?? 'msedge', headless: true })
  try {
    const pagina = await navegador.newPage()
    const respuesta = await pagina.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    if (!respuesta?.ok()) throw new Error(`La página del documento respondió ${respuesta?.status() ?? 'sin respuesta'}.`)
    await pagina.emulateMedia({ media: 'print' })
    return await pagina.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '12mm', bottom: '14mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#5a5a57;text-align:right;padding:0 14mm;font-family:Arial">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
    })
  } finally {
    await navegador.close()
  }
}

/** La dirección de la propia app, para que el generador abra la página del documento. */
export function origenApp(): string {
  return process.env.APP_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3000'}`
}
