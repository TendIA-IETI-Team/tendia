"""Descarga las fuentes y genera los agregados que se versionan en el repo.

Uso: uv run python -m tendia_scoring.datos.preparar
Escribe tendia_scoring/model/referencias/{emicron,tasas}.json.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .emicron import micronegocios_comercio
from .sfc import creditos_tiendas_bogota, resumen

REFERENCIAS = Path(__file__).resolve().parents[1] / "model" / "referencias"


def _q(v: np.ndarray, w: np.ndarray, q: float) -> float:
    o = np.argsort(v)
    acum = np.cumsum(w[o]) / w.sum()
    return float(v[o][np.searchsorted(acum, q)])


def emicron_resumen() -> dict:
    bog = micronegocios_comercio(area=11)
    v, w = bog["ventas_mes"].to_numpy(), bog["peso"].to_numpy()
    pidio = bog["pidio_credito"].to_numpy() == 1

    def prop(col: str, mask=None) -> float:
        m = np.ones(len(bog), bool) if mask is None else mask
        return round(float(np.average(bog[col].to_numpy()[m], weights=w[m])), 3)

    return {
        "fuente": "DANE, Encuesta de Micronegocios (EMICRON) 2024; comercio (GRUPOS12=05), Bogotá",
        "n_muestra": int(len(bog)),
        "micronegocios_representados": int(w.sum()),
        "ventas_mes": {
            "p10": round(_q(v, w, 0.10), -3),
            "p25": round(_q(v, w, 0.25), -3),
            "p50": round(_q(v, w, 0.50), -3),
            "p75": round(_q(v, w, 0.75), -3),
            "p90": round(_q(v, w, 0.90), -3),
        },
        "antiguedad_meses_mediana": round(_q(bog["antiguedad_meses"].to_numpy(), w, 0.5)),
        "lleva_registros": prop("lleva_registros"),
        "usa_cuaderno": prop("usa_cuaderno"),
        "acepta_pagos_digitales": prop("pagos_digitales"),
        "pidio_credito_ultimo_anio": prop("pidio_credito"),
        "de_quienes_pidieron": {
            "lo_obtuvieron": prop("obtuvo_credito", pidio),
            "acudieron_a_gota_a_gota": prop("gota_a_gota", pidio),
        },
    }


def main() -> None:
    REFERENCIAS.mkdir(parents=True, exist_ok=True)
    emicron = emicron_resumen()
    tasas = resumen(creditos_tiendas_bogota())
    (REFERENCIAS / "emicron.json").write_text(
        json.dumps(emicron, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    (REFERENCIAS / "tasas.json").write_text(
        json.dumps(tasas, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps({"emicron": emicron, "tasas": tasas}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
