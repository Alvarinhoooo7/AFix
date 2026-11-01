"""Todo lo que habla con el iPhone por usbmux. Lo que sale de acá es "crudo": lectura.py
lo convierte en la lectura de la app, y la sonda lo guarda tal cual en JSON.

Reglas: nunca se borra nada del iPhone (ni crash reports ni ajustes), y una falla en una
parte de la lectura no tumba el resto: queda anotada en `avisos`.
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

from pymobiledevice3 import usbmux
from pymobiledevice3.exceptions import (
    PairingDialogResponsePendingError,
    PasswordRequiredError,
    UserDeniedPairingError,
)
from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.services.crash_reports import CrashReportsManager
from pymobiledevice3.services.diagnostics import DiagnosticsService

from .estabilidad import clasificar, elegir_para_leer, evento_sin_texto, extraer, zona_desde_offset

log = logging.getLogger("afix_usb")

# La clase del IORegistry con los seriales de cámaras cambia con el chip.
CLASES_CAMARA = tuple(f"AppleH{n}CamIn" for n in range(18, 6, -1))

CLAVES_NVRAM_FM = ("fm-activation-locked", "fm-account-masked")


class ErrorEquipo(Exception):
    """Un error con un mensaje en castellano listo para mostrar en la app."""


def _decodificar(valor: Any) -> Optional[str]:
    if isinstance(valor, (bytes, bytearray)):
        return bytes(valor).decode("utf-8", errors="replace")
    return None if valor is None else str(valor)


async def listar() -> list[dict[str, str]]:
    """Equipos conectados por cable (los de red no cuentan para el taller)."""
    try:
        dispositivos = await usbmux.list_devices()
    except Exception as error:  # Apple Mobile Device Service caído o ausente
        raise ErrorEquipo(f"No se pudo hablar con el servicio de Apple (usbmux): {error}") from error
    return [{"udid": d.serial, "conexion": d.connection_type} for d in dispositivos if d.is_usb]


def listar_recuperacion() -> list[dict[str, Any]]:
    """Equipos en modo recuperación o DFU. En Windows depende del driver de Apple: si no se
    puede consultar, devuelve vacío en vez de fallar."""
    try:
        from pymobiledevice3.irecv.client import IRecv

        equipo = IRecv(timeout=1)
        return [
            {
                "ecid": str(equipo.ecid),
                "productType": equipo.product_type,
                "numeroSerie": equipo.serial_number,
                "modo": str(equipo.mode),
            }
        ]
    except Exception as error:
        log.debug("Sin equipos en recuperación: %s", error)
        return []


@asynccontextmanager
async def conectar(udid: str) -> AsyncIterator[Any]:
    try:
        cliente = await create_using_usbmux(serial=udid, autopair=False)
    except Exception as error:
        raise ErrorEquipo(f"El equipo no respondió por USB: {error}") from error
    try:
        yield cliente
    finally:
        try:
            await cliente.close()
        except Exception:
            pass


async def nivel_de(udid: str) -> str:
    async with conectar(udid) as cliente:
        return "emparejado" if cliente.paired else "sin_confianza"


async def emparejar(udid: str, espera: float = 60) -> None:
    """Dispara en el iPhone el cuadro "¿Confiar en esta computadora?" y espera la respuesta."""
    async with conectar(udid) as cliente:
        if cliente.paired:
            return
        try:
            await cliente.pair(timeout=espera)
        except PasswordRequiredError as error:
            raise ErrorEquipo("Desbloquea el iPhone con su código y vuelve a intentar.") from error
        except UserDeniedPairingError as error:
            raise ErrorEquipo("En el iPhone se tocó «No confiar». Desconecta, vuelve a conectar y acepta.") from error
        except PairingDialogResponsePendingError as error:
            raise ErrorEquipo("Nadie respondió el cuadro «¿Confiar en esta computadora?» a tiempo.") from error


async def desemparejar(udid: str) -> bool:
    """Borra la confianza entre este PC y el iPhone. Devuelve False si no estaba emparejado."""
    async with conectar(udid) as cliente:
        if not cliente.paired:
            return False
        await cliente.unpair()
        return True


async def _intentar(avisos: list[str], que: str, corrutina: Any) -> Any:
    try:
        return await corrutina
    except Exception as error:
        avisos.append(f"{que}: {type(error).__name__}")
        log.warning("Falló %s: %s", que, error)
        return None


async def _camaras(diagnostico: DiagnosticsService) -> dict[str, Any]:
    for clase in CLASES_CAMARA:
        try:
            datos = await diagnostico.ioregistry(ioclass=clase)
        except Exception:
            continue
        if datos:
            return datos
    return {}


async def listar_crash(cliente: Any) -> list[str]:
    async with CrashReportsManager(cliente) as gestor:
        try:
            await gestor.flush()
        except Exception as error:
            log.info("No se pudo pedir el flush de crash reports: %s", error)
        return await gestor.ls("/", depth=-1)


async def leer_eventos(cliente: Any, rutas: list[str], zona: Any) -> list[dict[str, Any]]:
    """Lee en memoria los registros elegidos y arma sus eventos. Nada queda escrito en el PC."""
    eventos: list[dict[str, Any]] = []
    elegidas = elegir_para_leer(rutas)
    async with CrashReportsManager(cliente) as gestor:
        for ruta in elegidas:
            try:
                contenido = await gestor.afc.get_file_contents(ruta)
                eventos.append(extraer(ruta, contenido, zona))
            except Exception as error:
                log.warning("No se pudo leer %s: %s", ruta, error)
    eventos.extend(evento_sin_texto(r, zona) for r in rutas if clasificar(r) == "reinicio_forzado")
    return eventos


async def leer_crudo(udid: str, con_estabilidad: bool = True) -> dict[str, Any]:
    avisos: list[str] = []
    async with conectar(udid) as cliente:
        emparejado = bool(cliente.paired)
        crudo: dict[str, Any] = {
            "horaPc": time.time(),
            "nivel": "emparejado" if emparejado else "sin_confianza",
            "lockdown": dict(cliente.all_values or {}),
            "avisos": avisos,
        }
        if not emparejado:
            return crudo

        crudo["lockdown"] = await _intentar(avisos, "Datos generales", cliente.get_value()) or crudo["lockdown"]
        crudo["lockdown"].pop("NonVolatileRAM", None)
        asociado = await _intentar(avisos, "Buscar mi iPhone (fmip)", cliente.get_value(domain="com.apple.fmip", key="IsAssociated"))
        crudo["fmip"] = {"IsAssociated": asociado} if isinstance(asociado, bool) else {}
        nvram = await _intentar(avisos, "Buscar mi iPhone (NVRAM)", cliente.get_value(key="NonVolatileRAM")) or {}
        crudo["nvramFm"] = {k: _decodificar(nvram.get(k)) for k in CLAVES_NVRAM_FM if k in nvram}
        crudo["discoUso"] = await _intentar(avisos, "Almacenamiento", cliente.get_value(domain="com.apple.disk_usage")) or {}

        diagnostico = DiagnosticsService(cliente)
        crudo["bateria"] = await _intentar(avisos, "Batería", diagnostico.get_battery()) or {}
        crudo["ioregCamaras"] = await _intentar(avisos, "Cámaras y Face ID", _camaras(diagnostico)) or {}
        crudo["ioregPantalla"] = await _intentar(avisos, "Pantalla", diagnostico.ioregistry(ioclass="IOMobileFramebuffer")) or {}

        if con_estabilidad:
            zona = zona_desde_offset(crudo["lockdown"].get("TimeZoneOffsetFromUTC"))
            rutas = await _intentar(avisos, "Registros del equipo", listar_crash(cliente))
            if rutas is not None:
                eventos = await _intentar(avisos, "Lectura de registros", leer_eventos(cliente, rutas, zona)) or []
                crudo["crash"] = {"rutas": rutas, "eventos": eventos}
    return crudo


async def rutas_crash(udid: str) -> tuple[list[str], Any]:
    """Para la vigilancia: la lista actual de registros y la zona horaria del iPhone."""
    async with conectar(udid) as cliente:
        if not cliente.paired:
            raise ErrorEquipo("El equipo no está emparejado con este PC.")
        zona = zona_desde_offset((cliente.all_values or {}).get("TimeZoneOffsetFromUTC"))
        return await listar_crash(cliente), zona


async def eventos_de(udid: str, rutas: list[str]) -> list[dict[str, Any]]:
    async with conectar(udid) as cliente:
        zona = zona_desde_offset((cliente.all_values or {}).get("TimeZoneOffsetFromUTC"))
        return await leer_eventos(cliente, rutas, zona)


def ejecutar(corrutina: Any) -> Any:
    return asyncio.run(corrutina)
