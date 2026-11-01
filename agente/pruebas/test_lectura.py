import pytest

from afix_usb.lectura import buscar_mi_iphone, capacidad_comercial, construir_lectura

HORA = 1793570000.0  # 2026-11-01


def crudo_minimo(**extra):
    base = {
        "horaPc": HORA,
        "nivel": "emparejado",
        "lockdown": {"ProductType": "iPhone14,8", "ProductVersion": "27.0.1", "TimeZoneOffsetFromUTC": -10800},
        "avisos": [],
    }
    base.update(extra)
    return base


@pytest.mark.parametrize(
    "bytes_totales,esperado",
    [(127_900_000_000, "128 GB"), (255_000_000_000, "256 GB"), (511_000_000_000, "512 GB"), (1_000_000_000_000, "1 TB"), (2_000_000_000_000, "2 TB"), (63_000_000_000, "64 GB"), (None, None), (0, None)],
)
def test_capacidad_comercial(bytes_totales, esperado):
    assert capacidad_comercial(bytes_totales) == esperado


@pytest.mark.parametrize(
    "fmip,nvram,estado",
    [
        ({"IsAssociated": True}, {"fm-activation-locked": "YES"}, "activo"),
        ({"IsAssociated": False}, {"fm-activation-locked": "NO"}, "inactivo"),
        ({"IsAssociated": True}, {"fm-activation-locked": "NO"}, "no_concluyente"),
        ({}, {"fm-activation-locked": "YES"}, "activo"),
        ({"IsAssociated": False}, {}, "inactivo"),
        ({}, {}, None),
    ],
)
def test_buscar_mi_iphone_cruza_las_dos_vias(fmip, nvram, estado):
    assert buscar_mi_iphone(fmip, nvram)["estado"] == estado


def test_lo_que_el_equipo_no_entrega_queda_en_none():
    lectura = construir_lectura(crudo_minimo())
    assert lectura["identidad"]["imei"] is None
    assert lectura["identidad"]["capacidad"] is None
    assert lectura["bateria"] is None
    assert lectura["estabilidad"] is None
    assert lectura["seguridad"]["buscarMiIphone"]["estado"] is None


def test_sin_confianza_no_hay_piezas():
    lectura = construir_lectura(crudo_minimo(nivel="sin_confianza"))
    assert lectura["nivel"] == "sin_confianza"
    assert lectura["piezas"] == []


def test_bateria_calcula_salud_desde_mah():
    lectura = construir_lectura(
        crudo_minimo(bateria={"CycleCount": 1176, "BatteryData": {"DesignCapacity": 4325, "NominalChargeCapacity": 3393}, "Serial": "B1"})
    )
    assert lectura["bateria"]["saludPct"] == 78
    assert lectura["bateria"]["ciclos"] == 1176


def test_reloj_calcula_el_desfase_con_el_pc():
    lockdown = {"TimeIntervalSince1970": HORA + 600, "TimeZone": "America/Santiago"}
    lectura = construir_lectura(crudo_minimo(lockdown=lockdown))
    assert lectura["reloj"]["desfaseSegundos"] == 600


def test_numero_de_modelo_con_region():
    lectura = construir_lectura(crudo_minimo(lockdown={"ModelNumber": "MQ593", "RegionInfo": "BE/A"}))
    assert lectura["identidad"]["numeroModelo"] == "MQ593BE/A"


def test_fixture_real_del_iphone_de_pruebas(fixture_json):
    """Volcado anonimizado de la sonda: iPhone 14 Plus, iOS 27.0.1 (1 de noviembre de 2026)."""
    try:
        crudo = fixture_json("iphone14plus-ios27.json")
    except FileNotFoundError:
        pytest.skip("Falta el volcado de la sonda")
    lectura = construir_lectura(crudo)
    assert lectura["nivel"] == "emparejado"
    assert lectura["identidad"]["productType"] == "iPhone14,8"
    assert lectura["identidad"]["imei"] == "356000000000001"
    assert lectura["bateria"]["ciclos"] > 0
    assert lectura["seguridad"]["buscarMiIphone"]["estado"] in ("activo", "inactivo", "no_concluyente")
    assert lectura["estabilidad"]["conteos"]["reinicio_forzado"] >= 0
    assert all(p["serie"] is None or p["serie"].startswith("FICT") or p["clave"] == "placa" for p in lectura["piezas"])
