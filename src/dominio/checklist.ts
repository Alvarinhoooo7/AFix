export type LineaCatalogo = {
  clave: string
  etiqueta: string
  bloque: 'funcionamiento' | 'condicion'
  orden: number
  estados: string[]
}

export type Checklist = Record<string, { estado: string; nota?: string }>

export type Catalogo = { version: number; lineas: LineaCatalogo[] }

/** Devuelve las claves inválidas: no están en el catálogo o traen un estado que la línea no tiene. */
export function validarChecklist(checklist: Checklist, lineas: LineaCatalogo[]): string[] {
  const porClave = new Map(lineas.map((l) => [l.clave, l]))
  return Object.entries(checklist)
    .filter(([clave, { estado }]) => !porClave.get(clave)?.estados.includes(estado))
    .map(([clave]) => clave)
}

/** Recorta las notas escritas y descarta las vacías para que no ocupen lugar en la ficha. */
export function limpiarChecklist(checklist: Checklist): Checklist {
  const limpio: Checklist = {}
  for (const [clave, valor] of Object.entries(checklist)) {
    if (!valor || typeof valor.estado !== 'string') continue
    const nota = valor.nota?.trim()
    limpio[clave] = nota ? { estado: valor.estado, nota } : { estado: valor.estado }
  }
  return limpio
}
