import pytest

from afix_usb.panicos import SIN_CLASIFICAR, sensores_faltantes, traducir


@pytest.mark.parametrize(
    "texto,linea,fragmento",
    [
        ("panic(cpu 0 caller 0x1): Missing sensor(s): mic1 \nDebugger message", "carga", "micrófono"),
        ("panic(cpu 5 caller 0x2): Missing sensor(s): PrS0", "carga", "barómetro"),
        ("panic(cpu 1 caller 0x3): Missing sensor(s): TG0B TG0V", "carga", "batería"),
        ("panic(cpu 2 caller 0x4): Missing sensor(s): prox", "sensor_proximidad", "proximidad"),
        ("panic(cpu 0 caller 0x5): userspace watchdog timeout: no successful checkins from com.apple.backboardd", None, "dejó de responder"),
        ("panic(cpu 3 caller 0x6): ANS2 Recoverable Panic - assert failed", None, "NAND"),
        ("panic(cpu 0 caller 0x7): SEP Panic: :sks /sks : 0x0001", "face_id", "SEP"),
    ],
)
def test_traduce_los_panicos_conocidos(texto, linea, fragmento):
    traduccion = traducir(texto)
    assert traduccion.clasificado
    assert traduccion.linea == linea
    assert fragmento.lower() in traduccion.causa.lower()


def test_un_sensor_raro_igual_dice_que_falta_un_sensor():
    traduccion = traducir("panic(cpu 0 caller 0x1): Missing sensor(s): XYZ9")
    assert traduccion.clasificado
    assert "sensor" in traduccion.causa


def test_un_panico_desconocido_no_se_inventa_una_causa():
    traduccion = traducir("panic(cpu 0 caller 0x1): algo nunca visto")
    assert not traduccion.clasificado
    assert traduccion.causa == SIN_CLASIFICAR
    assert traduccion.linea is None


def test_texto_vacio_no_rompe():
    assert not traducir("").clasificado


def test_lista_los_sensores_faltantes():
    assert sensores_faltantes("x Missing sensor(s): TG0B TG0V\nmás") == ["TG0B", "TG0V"]
    assert sensores_faltantes("sin sensores") == []
