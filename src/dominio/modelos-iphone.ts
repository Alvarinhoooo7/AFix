export type Resolucion = { modeloComercial: string; requiereConfirmacion: boolean }

// Pura a proposito: recibe la tabla ya cargada. Un ProductType que la tabla no conoce
// (un modelo posterior a la semilla) no falla: devuelve el codigo crudo y pide que el
// tecnico escriba el nombre comercial a mano. Nunca bloquea el ingreso.
export function resolverModelo(productType: string | null, tabla: Map<string, string>): Resolucion {
  const codigo = productType?.trim() ?? ''
  if (codigo === '') return { modeloComercial: '', requiereConfirmacion: true }
  const comercial = tabla.get(codigo)
  if (comercial === undefined) return { modeloComercial: codigo, requiereConfirmacion: true }
  return { modeloComercial: comercial, requiereConfirmacion: false }
}
