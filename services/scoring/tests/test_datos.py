"""Pruebas de las transformaciones de datos que no requieren descargar las fuentes."""

import numpy as np

from tendia_scoring.datos.preparar import _q
from tendia_scoring.datos.sfc import resumen


def _fila(entidad, tasa, n, garantia="Sin garantía"):
    return {
        "nombre_entidad": entidad,
        "fecha_corte": "2026-01-02T00:00:00.000",
        "tasa_efectiva_promedio": str(tasa),
        "numero_de_creditos": str(n),
        "tipo_de_garant_a": garantia,
    }


def test_resumen_de_tasas_pondera_por_numero_de_creditos():
    filas = [
        _fila("Banco A", 40, 90),
        _fila("Banco B", 70, 10, "Garantía fondo nacional de garantías (FNG)"),
        _fila("Banco C", 0, 5),  # tasa 0 se descarta
    ]
    r = resumen(filas)
    assert r["creditos"] == 100
    assert r["tasa_efectiva_anual"]["p50"] == 40
    assert r["con_garantia_fng"]["p50"] == 70
    assert r["entidades"][0] == {
        "entidad": "Banco A",
        "creditos": 90,
        "tasa_promedio_ponderada": 40,
    }


def test_percentil_ponderado():
    v = np.array([1.0, 2.0, 3.0])
    w = np.array([1.0, 1.0, 8.0])
    assert _q(v, w, 0.5) == 3.0
    assert _q(v, w, 0.1) == 1.0
