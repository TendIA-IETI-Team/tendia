"""Generador de datos sintéticos de tiendas (TND-041).

IMPORTANTE: no hay datos reales todavía. Estos datos imitan supuestos razonables
(estacionalidad de enero y lluvias, pagos a distribuidores, ~10 % de incumplimiento)
y sirven para construir y probar el pipeline. Las métricas obtenidas con ellos NO
deben presentarse como desempeño real del modelo.

Los conectores simulados de la API usan las mismas reglas para generar el historial
de un negocio a partir de su identificador.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from .schemas import Business, DistributorMonth, SalesMonth, ScoreRequest

# Factor de estacionalidad por mes calendario (1 = mes normal).
SEASONALITY = {1: 0.80, 2: 0.92, 4: 0.93, 5: 0.92, 10: 0.94, 11: 0.96, 12: 1.25}


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def month_add(month: str, delta: int) -> str:
    y, m = int(month[:4]), int(month[5:7])
    total = y * 12 + (m - 1) + delta
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def months_ending(end: str, n: int) -> list[str]:
    return [month_add(end, -i) for i in range(n - 1, -1, -1)]


@dataclass
class SyntheticBusiness:
    request: ScoreRequest
    defaulted: int
    cohort: str
    quality: float


def generate_business(rng: random.Random, end_month: str, n_months: int = 12) -> SyntheticBusiness:
    q = rng.gauss(0, 1)  # calidad latente del negocio: no se observa directamente
    age = int(min(360, max(3, rng.lognormvariate(math.log(48), 0.9) * (1 + 0.15 * q))))
    base = rng.lognormvariate(math.log(9_000_000), 0.5)
    trend = 0.012 * q + rng.gauss(0, 0.01)
    noise_sd = 0.06 + 0.16 * _sigmoid(-1.3 * q)
    shock_month = rng.randrange(n_months) if rng.random() < 0.25 else None

    months = months_ending(end_month, n_months)
    sales: list[SalesMonth] = []
    dist: list[DistributorMonth] = []
    on_time_p = _sigmoid(1.9 + 1.4 * q)
    margin_ratio = min(1.4, max(0.35, 0.72 + rng.gauss(0, 0.05) - 0.06 * q))
    for i, m in enumerate(months):
        season = SEASONALITY.get(int(m[5:7]), 1.0)
        amount = base * season * (1 + trend) ** i * max(0.05, rng.gauss(1, noise_sd))
        if shock_month == i:
            amount *= 0.45  # obras en la calle, enfermedad, etc.
        sales.append(SalesMonth(month=m, amount=round(amount, -3), source="datafono"))
        invoices = rng.randint(3, 8)
        paid = sum(rng.random() < on_time_p for _ in range(invoices))
        days_late = rng.expovariate(1 / (3 + 12 * _sigmoid(-q))) if paid < invoices else 0.0
        dist.append(
            DistributorMonth(
                month=m,
                purchases=round(amount * margin_ratio * rng.uniform(0.9, 1.1), -3),
                invoices=invoices,
                paid_on_time=paid,
                avg_days_late=round(days_late, 1),
            )
        )

    declared = base * rng.uniform(0.85, 1.3)
    logit = -2.35 - 1.25 * q + rng.gauss(0, 0.6)
    defaulted = int(rng.random() < _sigmoid(logit))
    req = ScoreRequest(
        business=Business(business_age_months=age, declared_monthly_sales=round(declared, -3)),
        sales=sales,
        distributor=dist,
    )
    return SyntheticBusiness(request=req, defaulted=defaulted, cohort=end_month, quality=q)


def generate_dataset(
    n: int = 12_000, seed: int = 20261023, first_cohort: str = "2024-01", n_cohorts: int = 24
) -> list[SyntheticBusiness]:
    rng = random.Random(seed)
    cohorts = [month_add(first_cohort, i) for i in range(n_cohorts)]
    return [generate_business(rng, cohorts[i % n_cohorts]) for i in range(n)]
