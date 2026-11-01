"""Sonda (plan §3.6, fase 1): vuelca todo lo que el iPhone conectado entrega a un JSON.

    python -m afix_usb.sonda salida.json            # crudo real (no subir al repo)
    python -m afix_usb.sonda salida.json --anonimo  # para agente/pruebas/fixtures/

El crudo es exactamente la entrada de lectura.construir_lectura, así que un volcado
anonimizado sirve directo como fixture de las pruebas.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from .anonimizar import anonimizar
from .dispositivo import leer_crudo, listar
from .lectura import construir_lectura


def _serializable(valor):
    if isinstance(valor, (bytes, bytearray)):
        return {"__bytes__": bytes(valor).hex()}
    return str(valor)


async def principal(destino: Path, anonimo: bool) -> int:
    equipos = await listar()
    if not equipos:
        print("No hay ningún iPhone conectado por cable.", file=sys.stderr)
        return 1
    crudo = await leer_crudo(equipos[0]["udid"])
    if anonimo:
        crudo = anonimizar(crudo)
    destino.write_text(json.dumps(crudo, ensure_ascii=False, indent=1, default=_serializable), encoding="utf-8")
    lectura = construir_lectura(json.loads(destino.read_text(encoding="utf-8")))
    estabilidad = lectura.get("estabilidad") or {}
    print(f"Nivel: {lectura['nivel']} · {lectura['identidad']['productType']} · iOS {lectura['sistema']['ios']}")
    print(f"Registros: {estabilidad.get('conteos')} desde {estabilidad.get('registrosDesde')}")
    if lectura["avisos"]:
        print("Avisos:", "; ".join(lectura["avisos"]))
    print(f"Guardado en {destino}")
    return 0


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("destino", type=Path)
    parser.add_argument("--anonimo", action="store_true", help="reemplaza IMEI, series y cuenta por valores ficticios")
    args = parser.parse_args()
    sys.exit(asyncio.run(principal(args.destino, args.anonimo)))


if __name__ == "__main__":
    main()
