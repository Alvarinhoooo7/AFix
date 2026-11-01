"""Servicio HTTP del agente (plan §3.1–3.2) en 127.0.0.1:8765. La app web nunca habla con
el iPhone: habla con este servicio, a través de su propio proxy en /api/agente.

    python -m afix_usb.servidor
"""

import asyncio
import json
import logging
import time
from typing import Any, AsyncIterator, Optional

from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse

from . import VERSION, dispositivo
from .dispositivo import ErrorEquipo
from .estabilidad import clasificar
from .lectura import construir_lectura

log = logging.getLogger("afix_usb")

PUERTO = 8765
INTERVALO_EVENTOS = 1.5
INTERVALO_VIGILANCIA = 5.0

app = FastAPI(title="Agente USB AFix", version=VERSION)


def _sse(evento: str, datos: Any) -> str:
    return f"event: {evento}\ndata: {json.dumps(datos, ensure_ascii=False)}\n\n"


def _error(mensaje: str, estado: int = 409) -> JSONResponse:
    return JSONResponse({"ok": False, "mensaje": mensaje}, status_code=estado)


async def _resumen_equipo(udid: str) -> dict[str, Any]:
    """Lo mínimo para la tarjeta "Equipo conectado": sale de lockdown, aun sin confianza."""
    try:
        async with dispositivo.conectar(udid) as cliente:
            valores = cliente.all_values or {}
            return {
                "udid": udid,
                "nivel": "emparejado" if cliente.paired else "sin_confianza",
                "productType": valores.get("ProductType"),
                "nombre": valores.get("DeviceName"),
                "ios": valores.get("ProductVersion"),
                "numeroSerie": valores.get("SerialNumber"),
                "imei": valores.get("InternationalMobileEquipmentIdentity"),
                "ecid": str(valores["UniqueChipID"]) if valores.get("UniqueChipID") is not None else None,
            }
    except ErrorEquipo as error:
        return {"udid": udid, "nivel": "sin_respuesta", "mensaje": str(error)}


@app.get("/salud")
async def salud() -> dict[str, Any]:
    try:
        await dispositivo.listar()
        return {"ok": True, "version": VERSION, "servicioApple": True}
    except ErrorEquipo as error:
        return {"ok": True, "version": VERSION, "servicioApple": False, "mensaje": str(error)}


@app.get("/equipos")
async def equipos() -> Any:
    try:
        conectados = await dispositivo.listar()
    except ErrorEquipo as error:
        return _error(str(error), 503)
    resumenes = [await _resumen_equipo(e["udid"]) for e in conectados]
    recuperacion = await asyncio.to_thread(dispositivo.listar_recuperacion) if not conectados else []
    return {"equipos": resumenes, "recuperacion": recuperacion}


@app.post("/equipos/{udid}/emparejar")
async def emparejar(udid: str) -> Any:
    try:
        await dispositivo.emparejar(udid)
    except ErrorEquipo as error:
        return _error(str(error))
    return {"ok": True, "nivel": "emparejado"}


@app.get("/equipos/{udid}/lectura")
async def lectura(udid: str) -> Any:
    try:
        crudo = await dispositivo.leer_crudo(udid)
    except ErrorEquipo as error:
        return _error(str(error))
    return construir_lectura(crudo)


@app.delete("/equipos/{udid}/emparejamiento")
async def desemparejar(udid: str) -> Any:
    try:
        estaba = await dispositivo.desemparejar(udid)
    except ErrorEquipo as error:
        return _error(str(error))
    return {"ok": True, "estabaEmparejado": estaba}


async def flujo_eventos(intervalo: float = INTERVALO_EVENTOS) -> AsyncIterator[str]:
    """Avisa al enchufar, desenchufar y cuando el cliente toca "Confiar"."""
    conocidos: dict[str, dict[str, Any]] = {}
    primera = True
    while True:
        try:
            actuales = {e["udid"] for e in await dispositivo.listar()}
            servicio = True
        except ErrorEquipo:
            actuales, servicio = set(), False
        for udid in list(conocidos):
            if udid not in actuales:
                conocidos.pop(udid)
                yield _sse("desconectado", {"udid": udid})
        for udid in actuales:
            anterior = conocidos.get(udid)
            if anterior is None or anterior["nivel"] in ("sin_confianza", "sin_respuesta"):
                resumen = await _resumen_equipo(udid)
                if anterior is None:
                    yield _sse("conectado", resumen)
                elif resumen["nivel"] != anterior["nivel"]:
                    yield _sse("emparejado" if resumen["nivel"] == "emparejado" else "cambio", resumen)
                conocidos[udid] = resumen
        if primera:
            yield _sse("estado", {"servicioApple": servicio, "equipos": list(conocidos.values())})
            primera = False
        else:
            yield ": latido\n\n"
        await asyncio.sleep(intervalo)


@app.get("/eventos")
async def eventos() -> StreamingResponse:
    return StreamingResponse(flujo_eventos(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


def nuevas_relevantes(base: set[str], actuales: list[str]) -> list[str]:
    """Registros que aparecieron después de empezar a vigilar y que cuentan como falla.
    La falta de memoria (jetsam) no cuenta: son apps, no el equipo."""
    return [r for r in actuales if r not in base and clasificar(r) not in (None, "jetsam")]


async def flujo_vigilancia(udid: str, intervalo: float = INTERVALO_VIGILANCIA, reloj=time.monotonic) -> AsyncIterator[str]:
    """Durante las pruebas físicas de salida: cualquier pánico, bloqueo o reinicio nuevo se
    avisa en el momento. Si el iPhone se desconecta (un pánico lo reinicia), se espera a que
    vuelva y se revisa qué dejó."""
    inicio = reloj()
    try:
        base_lista, _ = await dispositivo.rutas_crash(udid)
    except ErrorEquipo as error:
        yield _sse("error", {"mensaje": str(error)})
        return
    base = set(base_lista)
    fallas = 0
    conectado = True
    yield _sse("inicio", {"registrosBase": len(base)})
    while True:
        await asyncio.sleep(intervalo)
        minutos = round((reloj() - inicio) / 60, 1)
        try:
            actuales, _ = await dispositivo.rutas_crash(udid)
        except ErrorEquipo:
            if conectado:
                conectado = False
                yield _sse("desconectado", {"minutos": minutos, "mensaje": "El iPhone se desconectó: puede haberse reiniciado."})
            continue
        if not conectado:
            conectado = True
            yield _sse("reconectado", {"minutos": minutos})
        nuevas = nuevas_relevantes(base, actuales)
        if nuevas:
            base.update(nuevas)
            eventos_nuevos = await dispositivo.eventos_de(udid, nuevas)
            fallas += len(eventos_nuevos)
            for evento in eventos_nuevos:
                yield _sse("falla", {"minutos": minutos, "evento": evento})
        yield _sse("latido", {"minutos": minutos, "fallas": fallas})


@app.get("/equipos/{udid}/vigilancia")
async def vigilancia(udid: str) -> StreamingResponse:
    return StreamingResponse(flujo_vigilancia(udid), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


def main() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    uvicorn.run(app, host="127.0.0.1", port=PUERTO, log_level="warning")


if __name__ == "__main__":
    main()
