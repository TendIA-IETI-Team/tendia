"""Servicio de inferencia /score (TND-044), contrato v2."""

from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path

import sentry_sdk
import structlog
from fastapi import FastAPI, Header

from . import __version__
from .features import compute_features
from .schemas import CONTRACT_VERSION, ScoreRequest, ScoreResponse, Segment
from .scorecard import ModeloTendIA, band_for
from .segmentos import Segmentacion, vector

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)
log = structlog.get_logger("scoring")

if os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        release=os.getenv("RELEASE", __version__),
        environment=os.getenv("APP_ENV", "dev"),
        send_default_pii=False,
    )

REFERENCIAS = Path(__file__).parent / "model" / "referencias"

model = ModeloTendIA.load()
segmentacion = Segmentacion.from_json({k: v for k, v in model.segmentacion.items() if k != "data"})
referencias = {
    p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(REFERENCIAS.glob("*.json"))
}
app = FastAPI(title="TendIA Scoring", version=__version__)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_version": model.version, "contract_version": CONTRACT_VERSION}


@app.get("/model")
def model_info() -> dict:
    return {"model_version": model.version, "metrics": model.metrics}


@app.get("/referencias")
def referencias_mercado() -> dict:
    """Datos reales de contexto: EMICRON (DANE) y tasas de crédito productivo (Superfinanciera)."""
    return referencias


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest, x_request_id: str | None = Header(default=None)) -> ScoreResponse:
    request_id = x_request_id or str(uuid.uuid4())
    fr = compute_features(req)
    base = {
        "contract_version": CONTRACT_VERSION,
        "model_version": model.version,
        "request_id": request_id,
        "adjusted_months": fr.adjusted_months,
        "data_quality": fr.quality,
    }
    if not fr.quality.sufficient:
        log.info("score_insufficient_data", request_id=request_id, issues=len(fr.quality.issues))
        return ScoreResponse(
            **base,
            probability_default=None,
            score=None,
            band=None,
            segment=None,
            components=[],
            contributions=[],
            top_positive=[],
            top_negative=[],
        )

    pd = model.probability_default(fr.values)
    points = model.score(fr.values)
    contribs = model.contributions(fr.values)
    ordered = sorted(contribs, key=lambda c: c.points, reverse=True)
    seg_code = segmentacion.asignar(
        vector(
            fr.values["avg_sales"], fr.values["business_age_months"], 1.0, float(fr.has_datafono)
        )
    )
    # Sin datos personales en logs: solo IDs y resultados.
    log.info(
        "score_computed",
        request_id=request_id,
        score=points,
        model_version=model.version,
        segment=seg_code,
        adjusted=len(fr.adjusted_months),
    )
    return ScoreResponse(
        **base,
        probability_default=round(pd, 4),
        score=points,
        band=band_for(points),
        segment=Segment(**segmentacion.describir(seg_code)),
        components=model.components(contribs),
        contributions=contribs,
        top_positive=[c for c in ordered if c.points > 0][:3],
        top_negative=[c for c in reversed(ordered) if c.points < 0][:3],
    )
