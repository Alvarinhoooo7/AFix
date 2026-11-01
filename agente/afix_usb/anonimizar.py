"""Reemplaza los identificadores reales de un crudo por valores ficticios estables, para
que los volcados de la sonda puedan quedar en el repo como fixtures de prueba."""

import copy
import hashlib
from typing import Any

from .estabilidad import clasificar

CLAVES_LOCKDOWN = {
    "InternationalMobileEquipmentIdentity": "356000000000001",
    "InternationalMobileEquipmentIdentity2": "356000000000002",
    "SerialNumber": "FICTICIO0001",
    "UniqueDeviceID": "00000000-0000000000000001",
    "UniqueChipID": 1,
    "MLBSerialNumber": "MLBFICTICIO0001",
    "WiFiAddress": "00:00:00:00:00:01",
    "BluetoothAddress": "00:00:00:00:00:02",
    "EthernetAddress": "00:00:00:00:00:03",
    "DeviceName": "iPhone de pruebas",
    "BasebandSerialNumber": "AAAAAA==",
    "WirelessBoardSerialNumber": "WBFICTICIO",
    "ChipSerialNo": "AAAA",
    "DieID": 1,
    "DevicePublicKey": "",
    "BasebandMasterKeyHash": "",
    "BasebandKeyHashInformation": {},
    "PkHash": "",
    "MobileSubscriberCountryCode": "000",
    "MobileSubscriberNetworkCode": "00",
    "BootSessionID": "",
    "ProximitySensorCalibration": "",
    "CarrierBundleInfoArray": [{"CFBundleIdentifier": "com.apple.Claro_cl"}],
}

CAMPOS_SERIE = (
    "Serial",
    "BackCameraModuleSerialNumString",
    "BackSuperWideCameraModuleSerialNumString",
    "BackTeleCameraModuleSerialNumString",
    "FrontCameraModuleSerialNumString",
    "FrontIRCameraModuleSerialNumString",
    "FrontIRStructuredLightProjectorSerialNumString",
    "Panel_ID",
)


def _ficticio(texto: Any) -> str:
    return "FICT" + hashlib.sha256(str(texto).encode()).hexdigest()[:12].upper()


def anonimizar(crudo: dict[str, Any]) -> dict[str, Any]:
    limpio = copy.deepcopy(crudo)
    lockdown = limpio.get("lockdown") or {}
    for clave, valor in CLAVES_LOCKDOWN.items():
        if clave in lockdown:
            lockdown[clave] = valor
    for bloque in ("bateria", "ioregCamaras", "ioregPantalla"):
        datos = limpio.get(bloque) or {}
        for campo in CAMPOS_SERIE:
            if datos.get(campo):
                datos[campo] = _ficticio(datos[campo])
    if (limpio.get("nvramFm") or {}).get("fm-account-masked"):
        limpio["nvramFm"]["fm-account-masked"] = "a•••••@ejemplo.com"
    # Los nombres de registros de apps cuentan qué usa el dueño: quedan solo los del sistema.
    crash = limpio.get("crash")
    if crash:
        crash["rutas"] = [
            r for r in crash["rutas"] if clasificar(r) or r.rsplit("/", 1)[-1].startswith(("SFA-", "SiriSearchFeedback"))
        ]
        for evento in crash["eventos"]:
            if evento["tipo"] == "jetsam":
                evento["resumen"] = "Falta de memoria; proceso más grande: AppDePrueba"
                evento["texto"] = evento["texto"].rsplit("largestProcess:", 1)[0] + "largestProcess: AppDePrueba"
    # El IORegistry trae mucho más de lo que se usa; en el fixture basta lo que se lee.
    for bloque in ("ioregCamaras", "ioregPantalla"):
        if limpio.get(bloque):
            limpio[bloque] = {k: v for k, v in limpio[bloque].items() if k in CAMPOS_SERIE}
    return limpio
