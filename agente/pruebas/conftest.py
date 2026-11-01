import json
from pathlib import Path

import pytest

FIXTURES = Path(__file__).with_name("fixtures")


def ips(encabezado: dict, cuerpo: dict | None = None, crudo: str | None = None) -> bytes:
    """Arma un .ips como los escribe iOS: una línea de encabezado JSON y el cuerpo JSON."""
    resto = crudo if crudo is not None else json.dumps(cuerpo or {})
    return (json.dumps(encabezado) + "\n" + resto).encode()


@pytest.fixture
def fixture_json():
    def cargar(nombre: str) -> dict:
        return json.loads((FIXTURES / nombre).read_text(encoding="utf-8"))

    return cargar
