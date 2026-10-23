"""Contrato de la API de scoring (v1). Cambiar un campo exige nueva versión: ver TND-071."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
    model_config = ConfigDict(extra="forbid")

    month: str
    purchases: float = Field(ge=0)
    invoices: int = Field(ge=0)
    paid_on_time: int = Field(ge=0)
    avg_days_late: float = Field(default=0, ge=0)

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


class Level(BaseModel):
    index: int
    name: str


class ScoreResponse(BaseModel):
    model_version: str
    request_id: str
    probability_default: float | None
    score: int | None
    level: Level | None
    contributions: list[Contribution]
    top_positive: list[Contribution]
    top_negative: list[Contribution]
    adjusted_months: list[str]
    data_quality: DataQuality
