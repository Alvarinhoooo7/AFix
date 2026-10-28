'use client'

import { useState } from 'react'
import { Checklist } from '@/componentes/checklist'
import type { Checklist as ValorChecklist, LineaCatalogo } from '@/dominio/checklist'

type PropsChecklistControlado = {
  lineas: LineaCatalogo[]
  valorInicial: ValorChecklist
  nombreCampo: string
  deshabilitado: boolean
}

export function ChecklistControlado({
  lineas,
  valorInicial,
  nombreCampo,
  deshabilitado,
}: PropsChecklistControlado) {
  const [valor, setValor] = useState<ValorChecklist>(valorInicial)
  return (
    <Checklist
      lineas={lineas}
      valor={valor}
      onChange={setValor}
      nombreCampo={nombreCampo}
      deshabilitado={deshabilitado}
    />
  )
}
