"""Variables de comportamiento de pago con el proveedor (componente entrenado con datos reales).

Se calculan igual para los 30.000 créditos reales de UCI #350 y para el historial del tendero con
su distribuidor, así el modelo se entrena y se sirve con el mismo código.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import mean

VENTANA = 6

VARIABLES_PAGO = [
    "pago_meses_al_dia",
    "pago_max_meses_mora",
    "pago_proporcion_pagada",
    "pago_uso_cupo",
    "pago_tendencia_compras",
]

ETIQUETAS_PAGO = {
    "pago_meses_al_dia": "Meses en que le pagaste a tiempo a tu proveedor",
    "pago_max_meses_mora": "El atraso más largo con tu proveedor",
    "pago_proporcion_pagada": "Cuánto pagas de lo que te fían",
    "pago_uso_cupo": "Cuánto usas del cupo que te da el proveedor",
    "pago_tendencia_compras": "Cómo vienen tus compras al proveedor",
}


@dataclass
class MesPago:
    facturado: float
    pagado: float | None  # None si la fuente no lo informa
    meses_mora: int  # 0 = al día
    cupo: float | None


def variables_pago(meses: list[MesPago]) -> dict[str, float]:
    m = meses[-VENTANA:]
    al_dia = sum(x.meses_mora == 0 for x in m) / len(m)
    max_mora = float(max(x.meses_mora for x in m))

    # Lo pagado en un mes cubre lo facturado el mes anterior.
    pares = [(m[i].pagado, m[i - 1].facturado) for i in range(1, len(m)) if m[i].pagado is not None]
    facturado = sum(f for _, f in pares)
    if pares and facturado > 0:
        proporcion = min(sum(p for p, _ in pares) / facturado, 1.5)
    else:
        proporcion = al_dia  # sin datos de pago: se aproxima con la puntualidad

    cupos = [x.cupo for x in m if x.cupo]
    uso = min(mean(x.facturado for x in m) / max(cupos), 1.5) if cupos else 0.5

    ult = [x.facturado for x in m[-3:]]
    prev = [x.facturado for x in m[-6:-3]]
    tendencia = (mean(ult) - mean(prev)) / mean(prev) if prev and mean(prev) > 0 else 0.0
    tendencia = max(min(tendencia, 2.0), -1.0)

    return {
        "pago_meses_al_dia": al_dia,
        "pago_max_meses_mora": max_mora,
        "pago_proporcion_pagada": proporcion,
        "pago_uso_cupo": uso,
        "pago_tendencia_compras": tendencia,
    }


def mora_en_meses(dias: float) -> int:
    """Días de atraso → meses de mora como en el estándar de UCI (1 = hasta 30 días)."""
    return 0 if dias <= 0 else int(-(-dias // 30))
