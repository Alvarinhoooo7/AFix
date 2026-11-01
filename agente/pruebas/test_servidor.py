import asyncio
import json
import re
from pathlib import Path

from fastapi.testclient import TestClient

from afix_usb import dispositivo, servidor
from afix_usb.dispositivo import ErrorEquipo


def eventos_sse(textos: list[str]) -> list[tuple[str, dict]]:
    salida = []
    for bloque in textos:
        encontrado = re.match(r"event: (\w+)\ndata: (.*)\n\n", bloque)
        if encontrado:
            salida.append((encontrado.group(1), json.loads(encontrado.group(2))))
    return salida


async def tomar(generador, cantidad: int) -> list[str]:
    salida = []
    async for bloque in generador:
        salida.append(bloque)
        if len(salida) >= cantidad:
            break
    await generador.aclose()
    return salida


def test_nuevas_relevantes_ignora_ruido_y_memoria():
    base = {"/a.ips"}
    actuales = ["/a.ips", "/panic-full-2026-11-01-101010.ips", "/JetsamEvent-2026-11-01-101010.ips", "/SFA-x-2026-11-01-101010.ips"]
    assert servidor.nuevas_relevantes(base, actuales) == ["/panic-full-2026-11-01-101010.ips"]


def test_vigilancia_avisa_falla_desconexion_y_regreso(monkeypatch):
    respuestas = iter(
        [
            ["/viejo.ips"],
            ["/viejo.ips"],
            ErrorEquipo("desconectado"),
            ["/viejo.ips", "/panic-full-2026-11-01-101010.ips"],
        ]
    )

    async def rutas_crash(udid):
        r = next(respuestas)
        if isinstance(r, Exception):
            raise r
        return r, None

    async def eventos_de(udid, rutas):
        return [{"tipo": "panic", "nombre": rutas[0]}]

    monkeypatch.setattr(dispositivo, "rutas_crash", rutas_crash)
    monkeypatch.setattr(dispositivo, "eventos_de", eventos_de)
    bloques = asyncio.run(tomar(servidor.flujo_vigilancia("u1", intervalo=0), 6))
    tipos = [t for t, _ in eventos_sse(bloques)]
    assert tipos == ["inicio", "latido", "desconectado", "reconectado", "falla", "latido"]
    assert eventos_sse(bloques)[-1][1]["fallas"] == 1


def test_eventos_avisa_conexion_y_confianza(monkeypatch):
    listas = iter([[{"udid": "u1", "conexion": "USB"}]] * 2 + [[]])
    niveles = iter(["sin_confianza", "emparejado"])

    async def listar():
        return next(listas)

    async def resumen(udid):
        return {"udid": udid, "nivel": next(niveles)}

    monkeypatch.setattr(dispositivo, "listar", listar)
    monkeypatch.setattr(servidor, "_resumen_equipo", resumen)
    bloques = asyncio.run(tomar(servidor.flujo_eventos(intervalo=0), 5))
    tipos = [t for t, _ in eventos_sse(bloques)]
    assert tipos == ["conectado", "estado", "emparejado", "desconectado"]


def test_salud_sin_servicio_de_apple(monkeypatch):
    async def listar():
        raise ErrorEquipo("sin usbmux")

    monkeypatch.setattr(dispositivo, "listar", listar)
    respuesta = TestClient(servidor.app).get("/salud").json()
    assert respuesta["ok"] is True
    assert respuesta["servicioApple"] is False


def test_lectura_con_error_devuelve_mensaje(monkeypatch):
    async def leer_crudo(udid):
        raise ErrorEquipo("El equipo no respondió por USB")

    monkeypatch.setattr(dispositivo, "leer_crudo", leer_crudo)
    respuesta = TestClient(servidor.app).get("/equipos/u1/lectura")
    assert respuesta.status_code == 409
    assert "no respondió" in respuesta.json()["mensaje"]


def test_el_agente_nunca_borra_registros_del_iphone():
    """Plan §3.7: copiar y listar, nunca --erase ni clear. Si alguien lo agrega, esto falla."""
    fuente = "\n".join(p.read_text(encoding="utf-8") for p in Path(dispositivo.__file__).parent.glob("*.py"))
    assert ".clear(" not in fuente
    assert "erase" not in fuente
    assert ".pull(" not in fuente
