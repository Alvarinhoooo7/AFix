from datetime import datetime, timedelta, timezone

import pytest

from afix_usb.estabilidad import (
    clasificar,
    elegir_para_leer,
    evento_sin_texto,
    extraer,
    fecha_del_nombre,
    resumir,
)
from conftest import ips

CHILE = timezone(timedelta(hours=-3))

# Pánico SINTÉTICO con la forma de un panic-full real de iOS (bug_type 210). Reemplazar por
# uno real anonimizado cuando la sonda lea los iPhone de garantía (plan §3.6).
PANICO_MIC = ips(
    {"bug_type": "210", "timestamp": "2026-10-20 14:03:11.00 -0300", "os_version": "iPhone OS 17.5 (21F79)"},
    {"panicString": "panic(cpu 4 caller 0xfffffff0284c1a2c): Missing sensor(s): mic1 \nDebugger message: panic\nOS version: 21F79", "product": "iPhone12,1"},
)


@pytest.mark.parametrize(
    "ruta,tipo",
    [
        ("/panic-full-2026-10-20-140311.0002.ips", "panic"),
        ("/Retired/panic-full-2026-10-01-010101.ips", "panic"),
        ("/ForceResetTailspins/tailspin-trace_reset_2026-10-05-232339.tailspin", "reinicio_forzado"),
        ("/Retired/stacks-2026-10-30-065249.ips", "stacks"),
        ("/ResetCounter-2026-10-30-065249.ips", "reset_counter"),
        ("/JetsamEvent-2026-11-01-111639.ips", "jetsam"),
        ("/SiriSearchFeedback-2026-11-01-151701.ips", None),
        ("/WhatsApp.diskwrites_resource-2026-11-01-125331.ips", None),
        ("/Retired", None),
    ],
)
def test_clasifica_por_nombre(ruta, tipo):
    assert clasificar(ruta) == tipo


def test_lee_la_fecha_del_nombre_en_la_zona_del_iphone():
    fecha = fecha_del_nombre("/ForceResetTailspins/tailspin-trace_reset_2026-10-05-232339.tailspin", CHILE)
    assert fecha == datetime(2026, 10, 5, 23, 23, 39, tzinfo=CHILE)
    assert fecha_del_nombre("/ota_patch.txt", CHILE) is None


def test_extrae_un_panico_con_su_traduccion_y_huella():
    evento = extraer("/panic-full-2026-10-20-140311.ips", PANICO_MIC, CHILE)
    assert evento["tipo"] == "panic"
    assert evento["fecha"] == "2026-10-20T14:03:11-03:00"
    assert evento["resumen"].startswith("panic(cpu 4")
    assert "micrófono" in evento["causaProbable"]
    assert evento["lineaChecklist"] == "carga"
    assert evento["sensores"] == ["mic1"]
    assert "Missing sensor(s): mic1" in evento["texto"]
    assert len(evento["sha256"]) == 64


def test_un_panico_con_cuerpo_danado_guarda_el_texto_crudo():
    contenido = ips({"bug_type": "210", "timestamp": "2026-10-20 14:03:11.00 -0300"}, crudo='{"panicString": "panic(cpu 0): Missing sens')
    evento = extraer("/panic-full-2026-10-20-140311.ips", contenido, CHILE)
    assert evento["tipo"] == "panic"
    assert "panic(cpu 0)" in evento["texto"]


def test_un_archivo_sin_encabezado_usa_la_fecha_del_nombre():
    evento = extraer("/stacks-2026-10-30-065249.ips", b"basura sin json", CHILE)
    assert evento["fecha"] == "2026-10-30T06:52:49-03:00"
    assert evento["resumen"] == "Sin motivo informado"


def test_extrae_el_motivo_de_un_bloqueo():
    contenido = ips(
        {"bug_type": "288", "timestamp": "2026-10-30 06:52:49.00 -0300"},
        {"reason": "BTAudioPlugin start condition timed out", "notes": ["Requested by audiomxd"]},
    )
    evento = extraer("/Retired/stacks-2026-10-30-065249.ips", contenido, CHILE)
    assert evento["resumen"] == "BTAudioPlugin start condition timed out"
    assert "Requested by audiomxd" in evento["texto"]


def test_jetsam_solo_guarda_el_proceso_mas_grande():
    contenido = ips({"bug_type": "298", "timestamp": "2026-11-01 11:16:39.00 -0300"}, {"largestProcess": "AppX", "processes": [{"x": 1}] * 500})
    evento = extraer("/JetsamEvent-2026-11-01-111639.ips", contenido, CHILE)
    assert "AppX" in evento["resumen"]
    assert len(evento["texto"]) < 400


def test_el_reinicio_forzado_se_registra_sin_copiar_el_archivo():
    evento = evento_sin_texto("/ForceResetTailspins/tailspin-trace_reset_2026-10-05-183111.tailspin", CHILE)
    assert evento["tipo"] == "reinicio_forzado"
    assert evento["fecha"] == "2026-10-05T18:31:11-03:00"
    assert evento["sha256"] is None


def test_un_tailspin_no_se_extrae_como_texto():
    with pytest.raises(ValueError):
        extraer("/ForceResetTailspins/tailspin-trace_reset_2026-10-05-183111.tailspin", b"x", CHILE)


def test_elige_los_mas_nuevos_con_tope_y_sin_ruido():
    rutas = [f"/JetsamEvent-2026-10-{d:02d}-101010.ips" for d in range(1, 21)] + [
        "/panic-full-2026-10-02-010101.ips",
        "/SiriSearchFeedback-2026-11-01-151701.ips",
        "/ForceResetTailspins/tailspin-trace_reset_2026-10-05-232339.tailspin",
    ]
    elegidas = elegir_para_leer(rutas)
    jetsam = [r for r in elegidas if "Jetsam" in r]
    assert len(jetsam) == 10
    assert jetsam[0] == "/JetsamEvent-2026-10-20-101010.ips"
    assert "/panic-full-2026-10-02-010101.ips" in elegidas
    assert not any("Siri" in r or "tailspin" in r for r in elegidas)


def test_resume_conteos_y_desde_cuando_hay_registros():
    ahora = datetime(2026, 11, 1, 22, 0, tzinfo=timezone.utc)
    rutas = [
        "/SiriSearchFeedback-2026-10-26-101010.ips",
        "/ForceResetTailspins/tailspin-trace_reset_2026-10-05-232339.tailspin",
        "/panic-full-2026-10-30-140311.ips",
    ]
    eventos = [
        evento_sin_texto(rutas[1], CHILE),
        extraer(rutas[2], PANICO_MIC, CHILE),
    ]
    resumen = resumir(rutas, eventos, CHILE, ahora)
    assert resumen["registrosDesde"] == "2026-10-05T23:23:39-03:00"
    assert resumen["conteos"]["reinicio_forzado"] == 1
    assert resumen["conteos"]["panic"] == 1
    # El pánico del fixture dice 20-10 en su encabezado: fuera de los últimos 7 días.
    assert resumen["ultimos7Dias"]["panic"] == 0
    assert resumen["eventos"][0]["tipo"] == "panic"


def test_sin_registros_no_inventa_fecha():
    resumen = resumir([], [], CHILE, datetime(2026, 11, 1, tzinfo=timezone.utc))
    assert resumen["registrosDesde"] is None
    assert all(v == 0 for v in resumen["conteos"].values())
