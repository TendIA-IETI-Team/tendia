"""Pipeline de variables del negocio (TND-042) y validación de suficiencia y consistencia (TND-033).

El mismo código se usa para entrenar y para servir, así no hay diferencias entre ambos.
Produce dos grupos de variables:
- negocio: ventas y su estabilidad (componente calibrado con EMICRON).
- pagos: relación de crédito con el distribuidor (componente entrenado con datos reales, UCI #350).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from statistics import mean, median, pstdev

from .pagos import ETIQUETAS_PAGO, VARIABLES_PAGO, MesPago, mora_en_meses, variables_pago
from .schemas import DataIssue, DataQuality, ScoreRequest

MIN_SALES_MONTHS = 6
MIN_DISTRIBUTOR_MONTHS = 3
WINDOW_MONTHS = 12
SOURCE_PRIORITY = {"datafono": 0, "open_finance": 1, "declarado": 2}

FEATURES_NEGOCIO = [
    "avg_sales",
    "sales_cv",
    "sales_trend",
    "low_months_ratio",
    "purchases_to_sales",
    "business_age_months",
]
FEATURES_PAGOS = VARIABLES_PAGO
FEATURES = FEATURES_NEGOCIO + FEATURES_PAGOS

FEATURE_LABELS = {
    "avg_sales": "Tus ventas promedio al mes",
    "sales_cv": "Qué tan estables son tus ventas",
    "sales_trend": "Cómo vienen tus ventas en los últimos 3 meses",
    "low_months_ratio": "Meses con ventas muy bajas",
    "purchases_to_sales": "Lo que le compras al proveedor frente a lo que vendes",
    "business_age_months": "Tiempo que lleva abierto tu negocio",
    **ETIQUETAS_PAGO,
}

_PORCENTAJES = {
    "sales_cv",
    "low_months_ratio",
    "purchases_to_sales",
    "pago_meses_al_dia",
    "pago_proporcion_pagada",
    "pago_uso_cupo",
}


def display_value(feature: str, value: float) -> str:
    if feature == "avg_sales":
        return f"${value:,.0f}".replace(",", ".")
    if feature in _PORCENTAJES:
        return f"{value * 100:.0f} %"
    if feature in {"sales_trend", "pago_tendencia_compras"}:
        return f"{value * 100:+.0f} %"
    if feature == "pago_max_meses_mora":
        return "ninguno" if value == 0 else f"{value:.0f} {'mes' if value == 1 else 'meses'}"
    if feature == "business_age_months":
        return f"{value:.0f} meses"
    return f"{value:.2f}"


@dataclass
class FeatureResult:
    values: dict[str, float]
    quality: DataQuality
    adjusted_months: list[str] = field(default_factory=list)
    has_datafono: bool = False


def _monthly_sales(req: ScoreRequest) -> tuple[dict[str, float], bool]:
    chosen: dict[str, tuple[int, float]] = {}
    for s in req.sales:
        prio = SOURCE_PRIORITY[s.source]
        if s.month not in chosen or prio < chosen[s.month][0]:
            chosen[s.month] = (prio, s.amount)
    months = sorted(chosen)[-WINDOW_MONTHS:]
    has_datafono = any(s.source == "datafono" for s in req.sales)
    return {m: chosen[m][1] for m in months}, has_datafono


def historial_pagos(req: ScoreRequest) -> list[MesPago]:
    dist = sorted(req.distributor, key=lambda d: d.month)
    out = []
    for d in dist:
        tarde = d.invoices > 0 and min(d.paid_on_time, d.invoices) < d.invoices
        out.append(
            MesPago(
                facturado=d.purchases,
                pagado=d.paid_amount,
                meses_mora=mora_en_meses(d.avg_days_late or 1) if tarde else 0,
                cupo=d.credit_limit,
            )
        )
    return out


def compute_features(req: ScoreRequest) -> FeatureResult:
    sales, has_datafono = _monthly_sales(req)
    dist = sorted(req.distributor, key=lambda d: d.month)[-WINDOW_MONTHS:]
    adjusted = sorted({a.month for a in req.adjustments if a.month in sales})

    issues: list[DataIssue] = []
    if len(sales) < MIN_SALES_MONTHS:
        issues.append(
            DataIssue(
                code="pocas_ventas",
                message=(
                    f"Necesitamos al menos {MIN_SALES_MONTHS} meses de ventas y hay {len(sales)}."
                ),
            )
        )
    if len(dist) < MIN_DISTRIBUTOR_MONTHS:
        issues.append(
            DataIssue(
                code="pocos_pagos_proveedor",
                message=(
                    f"Necesitamos al menos {MIN_DISTRIBUTOR_MONTHS} meses de compras al proveedor "
                    f"y hay {len(dist)}."
                ),
            )
        )
    sufficient = not issues

    values: dict[str, float] = {}
    if sufficient:
        amounts = list(sales.values())
        # Los meses justificados no castigan estabilidad, tendencia ni meses bajos.
        stable = [v for m, v in sales.items() if m not in adjusted] or amounts
        values["avg_sales"] = mean(amounts)
        values["sales_cv"] = pstdev(stable) / mean(stable) if mean(stable) > 0 else 1.0
        last3, prev3 = stable[-3:], stable[-6:-3]
        values["sales_trend"] = (
            (mean(last3) - mean(prev3)) / mean(prev3)
            if len(prev3) == 3 and mean(prev3) > 0
            else 0.0
        )
        med = median(stable)
        values["low_months_ratio"] = sum(v < 0.5 * med for v in stable) / len(stable)
        dist_months = {d.month for d in dist}
        overlap_sales = sum(v for m, v in sales.items() if m in dist_months)
        purchases = sum(d.purchases for d in dist if d.month in sales)
        values["purchases_to_sales"] = purchases / overlap_sales if overlap_sales > 0 else 0.0
        values["business_age_months"] = float(req.business.business_age_months)
        values.update(variables_pago(historial_pagos(req)))

        issues.extend(_consistency_issues(req, values))

    quality = DataQuality(
        sufficient=sufficient,
        months_of_sales=len(sales),
        months_of_distributor=len(dist),
        issues=issues,
    )
    return FeatureResult(
        values=values, quality=quality, adjusted_months=adjusted, has_datafono=has_datafono
    )


def _consistency_issues(req: ScoreRequest, values: dict[str, float]) -> list[DataIssue]:
    """Cruce de fuentes contra fraude: ventas declaradas vs. datáfono vs. compras al proveedor."""
    issues: list[DataIssue] = []
    declared = req.business.declared_monthly_sales
    if declared and values["avg_sales"] > 0:
        gap = abs(declared - values["avg_sales"]) / values["avg_sales"]
        if gap > 0.5:
            issues.append(
                DataIssue(
                    code="ventas_declaradas_no_coinciden",
                    message="Las ventas que declaraste difieren en más de 50 % de las registradas.",
                )
            )
    ratio = values["purchases_to_sales"]
    if ratio > 1.2:
        issues.append(
            DataIssue(
                code="compras_mayores_que_ventas",
                message="Las compras al proveedor superan las ventas registradas.",
            )
        )
    elif 0 < ratio < 0.3:
        issues.append(
            DataIssue(
                code="compras_muy_bajas",
                message="Las compras al proveedor son muy bajas frente a las ventas registradas.",
            )
        )
    return issues
