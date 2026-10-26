"""Generador de historiales de tiendas para el componente "negocio" (TND-041).

No existe un dataset público que una las ventas mensuales de tiendas con su incumplimiento, por
eso el componente de negocio se entrena con datos sintéticos. Lo que sí es real es su
calibración: el nivel y la dispersión de las ventas salen de EMICRON 2024 (DANE), micronegocios
de comercio en Bogotá (mediana $2.8 M/mes, p10 $0.6 M, p90 $12 M). El componente de pagos se
entrena con datos reales (UCI #350), no con estos.

Los conectores simulados de la API (services/api/src/conectores/simulacion.ts) siguen las mismas
reglas para generar el historial de un negocio a partir de su identificador.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from .schemas import Business, DistributorMonth, SalesMonth, ScoreRequest

# Calibración con EMICRON 2024, comercio en Bogotá (ver model/referencias/emicron.json).
VENTAS_MEDIANA = 2_800_000
VENTAS_SIGMA = 1.17

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
    age = int(min(360, max(3, rng.lognormvariate(math.log(80), 0.9) * (1 + 0.15 * q))))
    base = rng.lognormvariate(math.log(VENTAS_MEDIANA), VENTAS_SIGMA) * math.exp(0.15 * q)
    trend = 0.012 * q + rng.gauss(0, 0.01)
    noise_sd = 0.06 + 0.16 * _sigmoid(-1.3 * q)
    shock_month = rng.randrange(n_months) if rng.random() < 0.25 else None

    months = months_ending(end_month, n_months)
    sales: list[SalesMonth] = []
    dist: list[DistributorMonth] = []
    # Puntualidad por factura y uso del cupo calibrados con UCI #350: en los datos reales la mitad
    # de los clientes pagó a tiempo los 6 meses (86 % de meses al día) y usa ~30 % del cupo.
    on_time_p = _sigmoid(4.3 + 1.6 * q)
    margin_ratio = min(1.4, max(0.35, 0.72 + rng.gauss(0, 0.05) - 0.06 * q))
    cupo = base * margin_ratio * rng.uniform(1.8, 4.0) * math.exp(0.2 * q)
    compra_anterior = None
    for i, m in enumerate(months):
        season = SEASONALITY.get(int(m[5:7]), 1.0)
        amount = base * season * (1 + trend) ** i * max(0.05, rng.gauss(1, noise_sd))
        if shock_month == i:
            amount *= 0.45  # obras en la calle, enfermedad, etc.
        sales.append(SalesMonth(month=m, amount=round(amount, -3), source="datafono"))
        invoices = rng.randint(3, 8)
        paid = sum(rng.random() < on_time_p for _ in range(invoices))
        days_late = rng.expovariate(1 / (3 + 12 * _sigmoid(-q))) if paid < invoices else 0.0
        compras = round(amount * margin_ratio * rng.uniform(0.9, 1.1), -3)
        # Paga lo que compró el mes anterior: completo si estuvo al día, una parte si no.
        fraccion = 1.0 if paid == invoices else min(1.0, max(0.3, rng.gauss(0.85 + 0.05 * q, 0.1)))
        pagado = None if compra_anterior is None else round(compra_anterior * fraccion, -3)
        dist.append(
            DistributorMonth(
                month=m,
                purchases=compras,
                invoices=invoices,
                paid_on_time=paid,
                avg_days_late=round(days_late, 1),
                paid_amount=pagado,
                credit_limit=round(cupo, -3),
            )
        )
        compra_anterior = compras

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
