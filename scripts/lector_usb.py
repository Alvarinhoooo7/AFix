import asyncio
import json
import sys

# Asegurar salida utf-8 en Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def bytes_to_human_gb(raw_bytes):
    try:
        val = int(raw_bytes)
        # Commercial disk capacity in GB
        gb = val / (1000 ** 3)
        if gb > 400:
            return "512 GB"
        elif gb > 200:
            return "256 GB"
        elif gb > 100:
            return "128 GB"
        elif gb > 50:
            return "64 GB"
        elif gb > 25:
            return "32 GB"
        elif gb > 10:
            return "16 GB"
        return f"{round(gb)} GB"
    except Exception:
        return ""

async def leer_iphone():
    from pymobiledevice3.lockdown import create_using_usbmux
    from pymobiledevice3.services.diagnostics import DiagnosticsService

    try:
        ld = await create_using_usbmux()
    except Exception as e:
        return None, f"No hay iPhone detectado en usbmux: {e}"

    diag = DiagnosticsService(ld)
    lockdown = await ld.get_value()

    # Capacidad de disco desde el dominio disk_usage
    capacidad = ""
    try:
        disk = await ld.get_value(domain="com.apple.disk_usage")
        raw_cap = disk.get("TotalDiskCapacity", 0)
        capacidad = bytes_to_human_gb(raw_cap)
    except Exception:
        pass

    # Batería
    salud_pct = None
    ciclos = None
    serial_bat = "No detectado"
    bat_nominal = 0
    bat_diseno = 0
    carga_actual = None
    try:
        battery = await diag.get_battery()
        bat_data = battery.get("BatteryData", {})
        bat_diseno = bat_data.get("DesignCapacity", 0)
        bat_nominal = bat_data.get("NominalChargeCapacity", 0)
        if bat_diseno and bat_nominal:
            salud_pct = round((bat_nominal / bat_diseno) * 100)
        ciclos = battery.get("CycleCount")
        carga_actual = battery.get("CurrentCapacity")
        serial_bat = battery.get("Serial", "No detectado")
    except Exception:
        pass

    # Cámaras y Face ID
    cam_back_wide = "No detectado"
    cam_back_ultra = "No detectado"
    cam_front = "No detectado"
    faceid_ir = "No detectado"
    faceid_projector = "No detectado"
    try:
        cam = await diag.ioregistry(ioclass="AppleH13CamIn")
        cam_back_wide = cam.get("BackCameraModuleSerialNumString", "No detectado")
        cam_back_ultra = cam.get("BackSuperWideCameraModuleSerialNumString", "No detectado")
        cam_front = cam.get("FrontCameraModuleSerialNumString", "No detectado")
        faceid_ir = cam.get("FrontIRCameraModuleSerialNumString", "No detectado")
        faceid_projector = cam.get("FrontIRStructuredLightProjectorSerialNumString", "No detectado")
    except Exception:
        pass

    # Pantalla OLED
    panel_serial = "No detectado"
    try:
        fb = await diag.ioregistry(ioclass="IOMobileFramebuffer")
        panel_id = fb.get("Panel_ID", "")
        if panel_id:
            panel_serial = panel_id.split("+")[0] if "+" in panel_id else panel_id
    except Exception:
        pass

    # Datos generales
    product_type = lockdown.get("ProductType", "")
    serie = lockdown.get("SerialNumber", "")
    imei = lockdown.get("InternationalMobileEquipmentIdentity") or lockdown.get("IMEI", "")
    imei2 = lockdown.get("InternationalMobileEquipmentIdentity2", "")
    ios_version = lockdown.get("ProductVersion", "")
    build_version = lockdown.get("BuildVersion", "")
    mlb_serial = lockdown.get("MLBSerialNumber", "No detectado")
    wifi_mac = lockdown.get("WiFiAddress", "No detectado")
    bt_mac = lockdown.get("BluetoothAddress", "No detectado")
    baseband_ver = lockdown.get("BasebandVersion", "No detectado")
    
    carrier = "No disponible"
    bundle_arr = lockdown.get("CarrierBundleInfoArray")
    if bundle_arr and isinstance(bundle_arr, list) and len(bundle_arr) > 0:
        c_id = bundle_arr[0].get("CFBundleIdentifier", "")
        if "Claro" in c_id:
            carrier = "Claro Chile"
        elif "Entel" in c_id:
            carrier = "Entel Chile"
        elif "Movistar" in c_id:
            carrier = "Movistar Chile"
        elif "WOM" in c_id:
            carrier = "WOM Chile"
        elif c_id:
            carrier = c_id

    # El USB solo afirma lo que leyó: que la pieza entregue su serie no prueba que funcione.
    def leido(serial):
        return "Serie leída por USB" if serial and serial != "No detectado" else "No informado por el equipo"

    perifericos = [
        {"nombre": "Placa madre (MLB)", "serial": mlb_serial, "estado": leido(mlb_serial)},
        {
            "nombre": "Batería",
            "serial": serial_bat,
            "estado": f"{salud_pct}% salud ({bat_nominal}/{bat_diseno} mAh) · {ciclos} ciclos · Carga: {carga_actual}%" if salud_pct else leido(serial_bat),
        },
        {"nombre": "Pantalla OLED", "serial": panel_serial, "estado": leido(panel_serial)},
        {"nombre": "Cámara trasera (Principal)", "serial": cam_back_wide, "estado": leido(cam_back_wide)},
        {"nombre": "Cámara trasera (Ultra gran angular)", "serial": cam_back_ultra, "estado": leido(cam_back_ultra)},
        {"nombre": "Cámara frontal", "serial": cam_front, "estado": leido(cam_front)},
        {"nombre": "Face ID (Sensor IR TrueDepth)", "serial": faceid_ir, "estado": leido(faceid_ir)},
        {"nombre": "Face ID (Proyector de puntos)", "serial": faceid_projector, "estado": leido(faceid_projector)},
        {"nombre": "Wi-Fi", "serial": wifi_mac, "estado": "Dirección MAC leída por USB"},
        {"nombre": "Bluetooth", "serial": bt_mac, "estado": "Dirección MAC leída por USB"},
        {"nombre": "Módem celular (Baseband)", "serial": f"Firmware {baseband_ver}", "estado": f"Operador: {carrier}"},
    ]

    resultado = {
        "exito": True,
        "plataforma": "ios",
        "equipo": {
            "modeloProducto": product_type,
            "modeloComercial": "",
            "capacidad": capacidad,
            "iosVersion": f"{ios_version} ({build_version})" if build_version else ios_version,
            "imei": imei,
            "imei2": imei2,
            "numeroSerie": serie,
            "bateriaPct": salud_pct,
            "bateriaCiclos": ciclos,
            "color": "",
        },
        "perifericos": perifericos,
    }
    return resultado, None

async def main():
    res_ios, err_ios = await leer_iphone()
    if res_ios:
        print(json.dumps(res_ios, ensure_ascii=True))
        return

    error_final = err_ios or "No se detectó ningún iPhone por USB"
    print(json.dumps({
        "exito": False,
        "error": error_final
    }, ensure_ascii=True))

if __name__ == "__main__":
    asyncio.run(main())
