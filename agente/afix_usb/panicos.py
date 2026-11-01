"""Traduce el texto de un pánico del kernel a una causa probable (plan §3.7).

Las reglas viven en reglas_panicos.json para sumar casos sin tocar código. La traducción
siempre es "causa probable": el dato duro es el texto original, que se guarda igual.
"""

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

RUTA_REGLAS = Path(__file__).with_name("reglas_panicos.json")

SIN_CLASIFICAR = "Pánico no clasificado: revisar el texto original"


@dataclass(frozen=True)
class Traduccion:
    causa: str
    linea: Optional[str]
    clasificado: bool


@lru_cache(maxsize=1)
def _reglas() -> list[tuple[re.Pattern[str], str, Optional[str]]]:
    datos = json.loads(RUTA_REGLAS.read_text(encoding="utf-8"))
    return [
        (re.compile(r["patron"], re.IGNORECASE | re.DOTALL), r["causa"], r.get("linea"))
        for r in datos["reglas"]
    ]


def traducir(panic_string: str) -> Traduccion:
    texto = panic_string or ""
    for patron, causa, linea in _reglas():
        if patron.search(texto):
            return Traduccion(causa=causa, linea=linea, clasificado=True)
    return Traduccion(causa=SIN_CLASIFICAR, linea=None, clasificado=False)


def sensores_faltantes(panic_string: str) -> list[str]:
    """Los nombres que siguen a 'Missing sensor(s):', tal como los escribe iOS."""
    encontrado = re.search(r"missing sensor\(s\):\s*([^\n\\]+)", panic_string or "", re.IGNORECASE)
    if not encontrado:
        return []
    return [s for s in re.split(r"[\s,]+", encontrado.group(1).strip()) if s]
