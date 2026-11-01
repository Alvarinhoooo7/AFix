/**
 * Un teléfono chileno en el formato de wa.me: solo dígitos y con el 56 adelante. Devuelve
 * null si no parece un celular (wa.me con un número malo abre un chat vacío).
 */
export function telefonoWhatsapp(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (/^569\d{8}$/.test(digitos)) return digitos
  if (/^9\d{8}$/.test(digitos)) return `56${digitos}`
  // Otro país escrito con su código (+54..., +1...): se respeta tal cual.
  if ((telefono ?? '').trim().startsWith('+') && digitos.length >= 10) return digitos
  return null
}

export function enlaceWhatsapp(telefono: string | null | undefined, texto: string): string | null {
  const numero = telefonoWhatsapp(telefono)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null
}

export function mensajeDocumento(tipo: 'ingreso' | 'salida', numero: number, taller: string | null, cliente: string | null): string {
  const saludo = cliente ? `Hola ${cliente.split(' ')[0]}` : 'Hola'
  const ficha = String(numero).padStart(4, '0')
  const nombre = taller ?? 'AFIX'
  return tipo === 'ingreso'
    ? `${saludo}, te enviamos el comprobante de ingreso de tu equipo (ficha ${ficha}). Guárdalo para retirarlo. ${nombre}.`
    : `${saludo}, te enviamos el informe de entrega de tu equipo (ficha ${ficha}), con el trabajo realizado y la garantía. ${nombre}.`
}
