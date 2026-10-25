"""Contrato de la API de scoring (v2). Cambiar un campo exige nueva versión: ver TND-071.

v2 (oct 2026): escala 0-1000 con tres franjas (bajo, medio, bueno), segmento del negocio,
componentes del puntaje y datos de pago/cupo opcionales del distribuidor.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

CONTRACT_VERSION = "2"
MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _check_month(value: str) -> str:
    if not MONTH_RE.match(value):
        raise ValueError("El mes debe tener formato YYYY-MM")
    return value


class Business(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business_age_months: int = Field(ge=0, le=1200)
    business_type: str = Field(default="tienda", max_length=40)
    declared_monthly_sales: float | None = Field(default=None, ge=0)


class SalesMonth(BaseModel):
    model_config = ConfigDict(extra="forbid")

    month: str
    amount: float = Field(ge=0)
    source: Literal["datafono", "declarado", "open_finance"] = "datafono"

    _month = field_validator("month")(_check_month)


class DistributorMonth(BaseModel):
    """Un mes de la relación de crédito con el distribuidor (compras fiadas y pagos)."""

    model_config = ConfigDict(extra="forbid")

    month: str
    purchases: float = Field(ge=0, description="Lo que compró fiado ese mes")
    invoices: int = Field(ge=0)
    paid_on_time: int = Field(ge=0)
    avg_days_late: float = Field(default=0, ge=0)
    paid_amount: float | None = Field(
        default=None, ge=0, description="Lo que pagó ese mes (cubre lo facturado el mes anterior)"
    )
    credit_limit: float | None = Field(
        default=None, ge=0, description="Cupo que le da el proveedor"
    )

    _month = field_validator("month")(_check_month)


class Adjustment(BaseModel):
    """Variación justificada por el tendero: ese mes no cuenta para estabilidad ni tendencia."""

    model_config = ConfigDict(extra="forbid")

    month: str
    reason: str = Field(min_length=3, max_length=280)

    _month = field_validator("month")(_check_month)


class ScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business: Business
    sales: list[SalesMonth] = Field(default_factory=list, max_length=36)
    distributor: list[DistributorMonth] = Field(default_factory=list, max_length=36)
    adjustments: list[Adjustment] = Field(default_factory=list, max_length=12)


class Contribution(BaseModel):
    feature: str
    component: Literal["pagos", "negocio"]
    label: str
    value: float
    display_value: str
    points: float


class DataIssue(BaseModel):
    code: str
    message: str


class DataQuality(BaseModel):
    sufficient: bool
    months_of_sales: int
    months_of_distributor: int
    issues: list[DataIssue]


class Band(BaseModel):
    code: Literal["bajo", "medio", "bueno"]
    name: str
    min_score: int
    max_score: int


class Segment(BaseModel):
    code: str
    name: str
    description: str
    share_of_businesses: float
    median_monthly_sales: float
    median_age_months: float
    requested_credit: float
    obtained_credit: float
    used_loan_sharks: float
    n_sample: int


class ComponentScore(BaseModel):
    name: Literal["pagos", "negocio"]
    label: str
    points: float
    trained_on: str


class ScoreResponse(BaseModel):
    contract_version: str
    model_version: str
    request_id: str
    probability_default: float | None
    score: int | None
    band: Band | None
    segment: Segment | None
    components: list[ComponentScore]
    contributions: list[Contribution]
    top_positive: list[Contribution]
    top_negative: list[Contribution]
    adjusted_months: list[str]
    data_quality: DataQuality
