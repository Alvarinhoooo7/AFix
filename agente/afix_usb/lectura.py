"""Arma la lectura que consume la app a partir de lo crudo que entregó el iPhone.

Pura a propósito: la sonda guarda lo crudo en JSON y las pruebas lo reconstruyen sin
equipo. Regla del plan §2: el USB solo afirma lo que leyó. Lo que el equipo no entrega
queda en None y la app lo muestra como "No informado por el equipo".
"""

from datetime import datetime, timezone
from typing import Any, Optional

from .estabilidad import resumir, zona_desde_offset

VERSION_LECTURA = 1

# Capacidades comerciales en GB. El disco informa algo menos que lo impreso en la caja.
CAPACIDADES_GB = (16, 32, 64, 128, 256, 512, 1024, 2048)

OPERADORES = (("Claro", "Claro"), ("Entel", "Entel"), ("Movistar", "Movistar"), ("WOM", "WOM"))

PIEZAS_CAMARA = (
    ("camara_principal", "Cámara trasera principal", "BackCameraModuleSerialNumString"),
    ("camara_ultra", "Cámara trasera ultra gran angular", "BackSuperWideCameraModuleSerialNumString"),
    ("camara_tele", "Cámara trasera teleobjetivo", "BackTeleCameraModuleSerialNumString"),
    ("camara_frontal", "Cámara frontal", "FrontCameraModuleSerialNumString"),
    ("faceid_ir", "Face ID: cámara infrarroja", "FrontIRCameraModuleSerialNumString"),
    ("faceid_proyector", "Face ID: proyector de puntos", "FrontIRStructuredLightProjectorSerialNumString"),
)


def _texto(valor: Any) -> Optional[str]:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _entero(valor: Any) -> Optional[int]:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def capacidad_comercial(bytes_totales: Any) -> Optional[str]:
    total = _entero(bytes_totales)
    if not total or total <= 0:
        return None
    gb = total / 1000**3
    elegida = None
    for c in CAPACIDADES_GB:
        if gb > c * 0.75:
            elegida = c
    if elegida is None:
        return f"{round(gb)} GB"
    return f"{elegida // 1024} TB" if elegida >= 1024 else f"{elegida} GB"


def _operador(lockdown: dict[str, Any]) -> Optional[str]:
    paquetes = lockdown.get("CarrierBundleInfoArray")
    if not isinstance(paquetes, list) or not paquetes:
        return None
    identificador = str(paquetes[0].get("CFBundleIdentifier", ""))
    for clave, nombre in OPERADORES:
        if clave.lower() in identificador.lower():
            return nombre
    return identificador or None


def _sim(lockdown: dict[str, Any]) -> Optional[str]:
    estado = lockdown.get("SIMStatus")
    if estado is None:
        return None
    if "NotInserted" in str(estado):
        return "Sin SIM"
    if "Ready" in str(estado):
        return "SIM lista"
    if "Locked" in str(estado) or "PIN" in str(estado):
        return "SIM bloqueada con PIN"
    return str(estado)


def _bandeja(lockdown: dict[str, Any]) -> Optional[str]:
    estado = lockdown.get("SIMTrayStatus")
    if estado is None:
        return None
    if "NoSIM" in str(estado) or "Inserted" in str(estado):
        return "Bandeja puesta"
    if "Missing" in str(estado) or "NotInserted" in str(estado):
        return "Sin bandeja"
    return str(estado)


def buscar_mi_iphone(fmip: dict[str, Any], nvram_fm: dict[str, Any]) -> dict[str, Any]:
    """Cruza las dos vías: lockdown fmip/IsAssociated y la NVRAM fm-activation-locked."""
    asociado = fmip.get("IsAssociated")
    asociado = asociado if isinstance(asociado, bool) else None
    bloqueo_bruto = _texto(nvram_fm.get("fm-activation-locked"))
    bloqueo = None if bloqueo_bruto is None else bloqueo_bruto.upper() == "YES"
    cuenta = _texto(nvram_fm.get("fm-account-masked"))

    conocidos = [v for v in (asociado, bloqueo) if v is not None]
    if not conocidos:
        estado = None
    elif all(conocidos):
        estado = "activo"
    elif not any(conocidos):
        estado = "inactivo"
    else:
        estado = "no_concluyente"
    return {"estado": estado, "asociado": asociado, "bloqueoActivacion": bloqueo, "cuentaEnmascarada": cuenta}


def _bateria(bateria: dict[str, Any]) -> dict[str, Any]:
    datos = bateria.get("BatteryData") or {}
    diseno = _entero(datos.get("DesignCapacity"))
    actual = _entero(datos.get("NominalChargeCapacity"))
    salud = round(actual / diseno * 100) if diseno and actual else None
    return {
        "saludPct": salud,
        "ciclos": _entero(bateria.get("CycleCount")),
        "capacidadDisenoMah": diseno,
        "capacidadActualMah": actual,
        "cargaPct": _entero(bateria.get("CurrentCapacity")),
        "cargando": bateria.get("IsCharging") if isinstance(bateria.get("IsCharging"), bool) else None,
        "voltajeMv": _entero(bateria.get("Voltage")),
        "serie": _texto(bateria.get("Serial")),
    }


def _carga(bateria: dict[str, Any]) -> dict[str, Any]:
    adaptador = bateria.get("AdapterDetails") or {}
    conectado = bateria.get("ExternalConnected")
    return {
        "conectado": conectado if isinstance(conectado, bool) else None,
        "descripcion": _texto(adaptador.get("Description")),
        "watts": _entero(adaptador.get("Watts")),
        "voltajeMv": _entero(adaptador.get("AdapterVoltage")),
        "corrienteMa": _entero(adaptador.get("Current")),
        "inalambrico": adaptador.get("IsWireless") if isinstance(adaptador.get("IsWireless"), bool) else None,
    }


def _almacenamiento(disco: dict[str, Any]) -> dict[str, Any]:
    total = _entero(disco.get("TotalDiskCapacity"))
    libre = _entero(disco.get("AmountDataAvailable"))
    return {
        "totalBytes": total,
        "libreBytes": libre,
        "pctLibre": round(libre / total * 100, 1) if total and libre is not None else None,
    }


def _piezas(lockdown: dict[str, Any], bateria: dict[str, Any], camaras: dict[str, Any], pantalla: dict[str, Any]) -> list[dict[str, Any]]:
    panel = _texto(pantalla.get("Panel_ID"))
    if panel and "+" in panel:
        panel = panel.split("+")[0]
    piezas = [
        {"clave": "placa", "nombre": "Placa (MLB)", "serie": _texto(lockdown.get("MLBSerialNumber"))},
        {"clave": "bateria", "nombre": "Batería", "serie": _texto(bateria.get("Serial"))},
        {"clave": "pantalla", "nombre": "Pantalla", "serie": panel},
    ]
    for clave, nombre, campo in PIEZAS_CAMARA:
        piezas.append({"clave": clave, "nombre": nombre, "serie": _texto(camaras.get(campo))})
    return piezas


def _reloj(lockdown: dict[str, Any], hora_pc: float) -> dict[str, Any]:
    hora_equipo = lockdown.get("TimeIntervalSince1970")
    if not isinstance(hora_equipo, (int, float)):
        return {"horaEquipo": None, "desfaseSegundos": None, "zona": _texto(lockdown.get("TimeZone"))}
    return {
        "horaEquipo": datetime.fromtimestamp(hora_equipo, tz=timezone.utc).isoformat(),
        "desfaseSegundos": round(hora_equipo - hora_pc),
        "zona": _texto(lockdown.get("TimeZone")),
    }


def construir_lectura(crudo: dict[str, Any]) -> dict[str, Any]:
    lockdown: dict[str, Any] = crudo.get("lockdown") or {}
    bateria: dict[str, Any] = crudo.get("bateria") or {}
    hora_pc = float(crudo["horaPc"])
    ahora = datetime.fromtimestamp(hora_pc, tz=timezone.utc)
    zona = zona_desde_offset(lockdown.get("TimeZoneOffsetFromUTC"))

    modelo = _texto(lockdown.get("ModelNumber"))
    region = _texto(lockdown.get("RegionInfo"))
    crash = crudo.get("crash")

    lectura: dict[str, Any] = {
        "version": VERSION_LECTURA,
        "leidoEn": ahora.isoformat(),
        "nivel": crudo.get("nivel"),
        "identidad": {
            "productType": _texto(lockdown.get("ProductType")),
            "claseEquipo": _texto(lockdown.get("DeviceClass")),
            "numeroModelo": f"{modelo}{region}" if modelo and region else modelo,
            "region": region,
            "imei": _texto(lockdown.get("InternationalMobileEquipmentIdentity")),
            "imei2": _texto(lockdown.get("InternationalMobileEquipmentIdentity2")),
            "numeroSerie": _texto(lockdown.get("SerialNumber")),
            "ecid": _texto(lockdown.get("UniqueChipID")),
            "udid": _texto(lockdown.get("UniqueDeviceID")),
            "nombreEquipo": _texto(lockdown.get("DeviceName")),
            "colorCodigo": _texto(lockdown.get("DeviceColor")),
            "colorCarcasa": _texto(lockdown.get("DeviceEnclosureColor")),
            "capacidad": capacidad_comercial((crudo.get("discoUso") or {}).get("TotalDiskCapacity")),
        },
        "sistema": {
            "ios": _texto(lockdown.get("ProductVersion")),
            "build": _texto(lockdown.get("BuildVersion")),
            "baseband": _texto(lockdown.get("BasebandVersion")),
        },
        "seguridad": {
            "activacion": _texto(lockdown.get("ActivationState")),
            "codigoConfigurado": lockdown.get("PasswordProtected") if isinstance(lockdown.get("PasswordProtected"), bool) else None,
            "buscarMiIphone": buscar_mi_iphone(crudo.get("fmip") or {}, crudo.get("nvramFm") or {}),
        },
        "bateria": _bateria(bateria) if bateria else None,
        "carga": _carga(bateria) if bateria else None,
        "almacenamiento": _almacenamiento(crudo.get("discoUso") or {}) if crudo.get("discoUso") else None,
        "red": {
            "operador": _operador(lockdown),
            "sim": _sim(lockdown),
            "bandeja": _bandeja(lockdown),
            "macWifi": _texto(lockdown.get("WiFiAddress")),
            "macBluetooth": _texto(lockdown.get("BluetoothAddress")),
        },
        "piezas": _piezas(lockdown, bateria, crudo.get("ioregCamaras") or {}, crudo.get("ioregPantalla") or {})
        if crudo.get("nivel") == "emparejado"
        else [],
        "reloj": _reloj(lockdown, hora_pc),
        "estabilidad": resumir(crash["rutas"], crash["eventos"], zona, ahora) if crash else None,
        "avisos": list(crudo.get("avisos") or []),
    }
    return lectura
