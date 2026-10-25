"""Tasas reales de crédito productivo (antes microcrédito) para tiendas de barrio en Bogotá.

Fuente: Superintendencia Financiera, "Tasas de interés activas por tipo de crédito – Histórico",
datos.gov.co (w9zh-vetq). Filtro: CIIU 4711 (comercio al por menor en establecimientos no
especializados, con surtido de alimentos: la tienda de barrio), municipio 11001 (Bogotá),
tipo de crédito "Crédito productivo", últimos 12 meses publicados.
"""

from __future__ import annotations

import numpy as np

from .fuentes import SFC_TASAS, consultar_socrata

DESDE = "2025-08-01"


def creditos_tiendas_bogota() -> list[dict]:
    return consultar_socrata(
        SFC_TASAS,
        {
            "$select": (
                "nombre_entidad,fecha_corte,tasa_efectiva_promedio,numero_de_creditos,"
                "montos_desembolsados,tipo_de_garant_a,rango_monto_desembolsado"
            ),
            "$where": (
                f"codigo_ciiu='4711' AND codigo_municipio='11001' AND fecha_corte >= '{DESDE}' "
                "AND tipo_de_cr_dito like '%productivo%'"
            ),
            "$limit": "50000",
        },
        f"sfc_productivo_4711_bogota_{DESDE}.json",
    )


def _percentil_ponderado(valores: np.ndarray, pesos: np.ndarray, q: float) -> float:
    orden = np.argsort(valores)
    v, w = valores[orden], pesos[orden]
    acum = np.cumsum(w) / w.sum()
    return float(v[np.searchsorted(acum, q)])


def resumen(filas: list[dict]) -> dict:
    tasa = np.array([float(f["tasa_efectiva_promedio"]) for f in filas])
    n = np.array([float(f["numero_de_creditos"]) for f in filas])
    ok = (tasa > 0) & (n > 0)
    tasa, n = tasa[ok], n[ok]
    filas = [f for f, k in zip(filas, ok, strict=True) if k]

    def pct(t, w):
        return {
            "p25": round(_percentil_ponderado(t, w, 0.25), 1),
            "p50": round(_percentil_ponderado(t, w, 0.50), 1),
            "p75": round(_percentil_ponderado(t, w, 0.75), 1),
        }

    por_entidad: dict[str, list[int]] = {}
    for i, f in enumerate(filas):
        por_entidad.setdefault(f["nombre_entidad"], []).append(i)
    entidades = sorted(
        (
            {
                "entidad": e,
                "creditos": int(n[idx].sum()),
                "tasa_promedio_ponderada": round(float(np.average(tasa[idx], weights=n[idx])), 1),
            }
            for e, idx in por_entidad.items()
        ),
        key=lambda x: -x["creditos"],
    )[:10]

    fng = np.array(["fondo nacional" in f["tipo_de_garant_a"].lower() for f in filas])
    fechas = sorted(f["fecha_corte"][:10] for f in filas)
    return {
        "fuente": "Superintendencia Financiera, datos.gov.co w9zh-vetq",
        "filtro": "Crédito productivo, CIIU 4711, Bogotá",
        "desde": fechas[0],
        "hasta": fechas[-1],
        "creditos": int(n.sum()),
        "tasa_efectiva_anual": pct(tasa, n),
        "con_garantia_fng": pct(tasa[fng], n[fng]) if fng.any() else None,
        "sin_garantia_fng": pct(tasa[~fng], n[~fng]) if (~fng).any() else None,
        "entidades": entidades,
    }
