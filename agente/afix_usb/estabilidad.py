"""Antecedentes de estabilidad a partir de los crash reports del iPhone (plan §3.7).

Todo es puro: recibe nombres de archivo y textos ya leídos. La lectura por USB vive en
dispositivo.py. Nunca se borra nada del iPhone y de cada archivo solo se guarda el texto
que importa (unos pocos KB), con el sha256 del original para poder cotejarlo.
"""

import hashlib
import json
import posixpath
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from .panicos import sensores_faltantes, traducir

TIPOS = ("panic", "reinicio_forzado", "stacks", "reset_counter", "jetsam")

# Los que se copian y se leen. El tailspin de un reinicio forzado pesa ~55 MB: solo nombre y fecha.
TIPOS_CON_TEXTO = ("panic", "stacks", "reset_counter", "jetsam")

LARGO_MAXIMO_TEXTO = 20_000

_FECHA_EN_NOMBRE = re.compile(r"(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})")


def clasificar(ruta: str) -> Optional[str]:
    """Tipo del archivo según su nombre, o None si es ruido del sistema."""
    nombre = posixpath.basename(ruta)
    if nombre.startswith("panic-full-") or nombre.endswith(".panic"):
        return "panic"
    if nombre.startswith("tailspin-trace_reset") or ("/ForceResetTailspins/" in ruta and nombre.endswith(".tailspin")):
        return "reinicio_forzado"
    if nombre.startswith("stacks-"):
        return "stacks"
    if nombre.startswith("ResetCounter"):
        return "reset_counter"
    if nombre.startswith("JetsamEvent-"):
        return "jetsam"
    return None


def fecha_del_nombre(ruta: str, zona: timezone) -> Optional[datetime]:
    """La fecha que iOS escribe en el nombre (AAAA-MM-DD-HHMMSS), en la zona del iPhone."""
    encontrado = _FECHA_EN_NOMBRE.search(posixpath.basename(ruta))
    if not encontrado:
        return None
    try:
        return datetime(*(int(g) for g in encontrado.groups()), tzinfo=zona)
    except ValueError:
        return None


def zona_desde_offset(segundos: Optional[float]) -> timezone:
    return timezone(timedelta(seconds=int(segundos or 0)))


def _partir_ips(texto: str) -> tuple[dict[str, Any], Optional[dict[str, Any]], str]:
    """Un .ips es una línea con el encabezado JSON y luego el cuerpo JSON."""
    primera, _, resto = texto.partition("\n")
    try:
        encabezado = json.loads(primera)
        if not isinstance(encabezado, dict):
            encabezado = {}
    except ValueError:
        encabezado = {}
    try:
        cuerpo = json.loads(resto) if resto.strip() else None
        if not isinstance(cuerpo, dict):
            cuerpo = None
    except ValueError:
        cuerpo = None
    return encabezado, cuerpo, resto


def _fecha_encabezado(encabezado: dict[str, Any]) -> Optional[datetime]:
    """'2026-11-01 11:16:39.00 -0300' -> datetime con zona."""
    bruto = encabezado.get("timestamp")
    if not isinstance(bruto, str):
        return None
    for formato in ("%Y-%m-%d %H:%M:%S.%f %z", "%Y-%m-%d %H:%M:%S %z"):
        try:
            return datetime.strptime(bruto, formato)
        except ValueError:
            continue
    return None


def _recortar(texto: str) -> str:
    return texto if len(texto) <= LARGO_MAXIMO_TEXTO else texto[:LARGO_MAXIMO_TEXTO] + "\n[… texto recortado]"


def extraer(ruta: str, contenido: bytes, zona: timezone) -> dict[str, Any]:
    """Arma el evento de un archivo con texto: lo que se guarda y se muestra en la ficha."""
    tipo = clasificar(ruta)
    if tipo not in TIPOS_CON_TEXTO:
        raise ValueError(f"{ruta} no es un registro con texto")
    texto = contenido.decode("utf-8", errors="replace")
    encabezado, cuerpo, resto = _partir_ips(texto)
    fecha = _fecha_encabezado(encabezado) or fecha_del_nombre(ruta, zona)
    linea_encabezado = json.dumps(encabezado, ensure_ascii=False) if encabezado else ""

    evento: dict[str, Any] = {
        "tipo": tipo,
        "nombre": ruta,
        "fecha": fecha.isoformat() if fecha else None,
        "bugType": encabezado.get("bug_type"),
        "resumen": "",
        "causaProbable": None,
        "lineaChecklist": None,
        "sensores": [],
        "texto": "",
        "sha256": hashlib.sha256(contenido).hexdigest(),
    }

    if tipo == "panic":
        panic = (cuerpo or {}).get("panicString")
        if not isinstance(panic, str):
            # Formato viejo o cuerpo dañado: el texto crudo sigue siendo la evidencia.
            panic = resto
        traduccion = traducir(panic)
        primera = next((l.strip() for l in panic.splitlines() if l.strip()), "")
        evento.update(
            resumen=primera[:160] or "Pánico del kernel",
            causaProbable=traduccion.causa,
            lineaChecklist=traduccion.linea,
            sensores=sensores_faltantes(panic),
            texto=_recortar(f"{linea_encabezado}\n{panic}".strip()),
        )
    elif tipo == "stacks":
        razon = (cuerpo or {}).get("reason") or "Sin motivo informado"
        notas = (cuerpo or {}).get("notes") or []
        notas_texto = "\n".join(str(n)[:300] for n in notas[:3]) if isinstance(notas, list) else ""
        evento.update(
            resumen=str(razon)[:160],
            causaProbable="Un proceso del sistema dejó de responder",
            texto=_recortar(f"{linea_encabezado}\nreason: {razon}\n{notas_texto}".strip()),
        )
    elif tipo == "reset_counter":
        cuerpo_texto = json.dumps(cuerpo, ensure_ascii=False, indent=1) if cuerpo else resto
        evento.update(
            resumen="Contador de reinicios",
            causaProbable="El equipo registró reinicios",
            texto=_recortar(f"{linea_encabezado}\n{cuerpo_texto[:4000]}".strip()),
        )
    else:  # jetsam
        mayor = (cuerpo or {}).get("largestProcess") or "no informado"
        evento.update(
            resumen=f"Falta de memoria; proceso más grande: {mayor}",
            causaProbable="iOS cerró apps por falta de memoria (apps o almacenamiento, no hardware)",
            texto=f"{linea_encabezado}\nlargestProcess: {mayor}".strip(),
        )
    return evento


def evento_sin_texto(ruta: str, zona: timezone) -> dict[str, Any]:
    """Un reinicio forzado: el tailspin no se copia, se registra por nombre y fecha."""
    fecha = fecha_del_nombre(ruta, zona)
    return {
        "tipo": "reinicio_forzado",
        "nombre": ruta,
        "fecha": fecha.isoformat() if fecha else None,
        "bugType": None,
        "resumen": "Reinicio forzado con los botones",
        "causaProbable": "El equipo quedó pegado y alguien forzó el reinicio",
        "lineaChecklist": None,
        "sensores": [],
        "texto": f"Archivo en el iPhone: {ruta}\n(El trazo del reinicio pesa decenas de MB: se registra por nombre y fecha, sin copiarlo.)",
        "sha256": None,
    }


def _clave_fecha(ruta: str) -> str:
    encontrado = _FECHA_EN_NOMBRE.search(posixpath.basename(ruta))
    return encontrado.group(0) if encontrado else ""


def elegir_para_leer(rutas: list[str], maximo_por_tipo: int = 25) -> list[str]:
    """Las rutas relevantes con texto, las más nuevas primero, con tope por tipo."""
    por_tipo: dict[str, list[str]] = {t: [] for t in TIPOS_CON_TEXTO}
    for ruta in rutas:
        tipo = clasificar(ruta)
        if tipo in por_tipo:
            por_tipo[tipo].append(ruta)
    elegidas: list[str] = []
    for tipo, lista in por_tipo.items():
        tope = 10 if tipo == "jetsam" else maximo_por_tipo
        lista.sort(key=_clave_fecha, reverse=True)
        elegidas.extend(lista[:tope])
    return elegidas


def resumir(rutas: list[str], eventos: list[dict[str, Any]], zona: timezone, ahora: datetime) -> dict[str, Any]:
    """Bloque `estabilidad` de la lectura: desde cuándo hay registros, conteos y eventos."""
    fechas = [f for f in (fecha_del_nombre(r, zona) for r in rutas) if f is not None]
    hace_7 = ahora - timedelta(days=7)
    conteos = {t: 0 for t in TIPOS}
    ultimos7 = {t: 0 for t in TIPOS}
    for e in eventos:
        conteos[e["tipo"]] += 1
        if e["fecha"] and datetime.fromisoformat(e["fecha"]) >= hace_7:
            ultimos7[e["tipo"]] += 1
    sin_fecha = datetime.min.replace(tzinfo=timezone.utc)
    ordenados = sorted(eventos, key=lambda e: datetime.fromisoformat(e["fecha"]) if e["fecha"] else sin_fecha, reverse=True)
    return {
        "leidoEn": ahora.isoformat(),
        "registrosDesde": min(fechas).isoformat() if fechas else None,
        "archivosRevisados": len(rutas),
        "conteos": conteos,
        "ultimos7Dias": ultimos7,
        "eventos": ordenados,
    }
