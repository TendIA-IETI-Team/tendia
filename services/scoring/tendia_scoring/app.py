"""Servicio de inferencia /score (TND-044)."""

from __future__ import annotations

import logging
import os
import uuid

import sentry_sdk
import structlog
from fastapi import FastAPI, Header

from . import __version__
from .features import compute_features
from .schemas import ScoreRequest, ScoreResponse
from .scorecard import Scorecard, level_for

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

model = Scorecard.load()
app = FastAPI(title="TendIA Scoring", version=__version__)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_version": model.version}


@app.get("/model")
def model_info() -> dict:
    return {"model_version": model.version, "metrics": model.metrics}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest, x_request_id: str | None = Header(default=None)) -> ScoreResponse:
    request_id = x_request_id or str(uuid.uuid4())
    fr = compute_features(req)
    if not fr.quality.sufficient:
        log.info("score_insufficient_data", request_id=request_id, issues=len(fr.quality.issues))
        return ScoreResponse(
            model_version=model.version,
            request_id=request_id,
            probability_default=None,
            score=None,
            level=None,
            contributions=[],
            top_positive=[],
            top_negative=[],
            adjusted_months=fr.adjusted_months,
            data_quality=fr.quality,
        )

    pd = model.probability_default(fr.values)
    points = model.score(fr.values)
    contribs = model.contributions(fr.values)
    ordered = sorted(contribs, key=lambda c: c.points, reverse=True)
    # Sin datos personales en logs: solo IDs y resultados.
    log.info(
        "score_computed",
        request_id=request_id,
        score=points,
        model_version=model.version,
        adjusted=len(fr.adjusted_months),
    )
    return ScoreResponse(
        model_version=model.version,
        request_id=request_id,
        probability_default=round(pd, 4),
        score=points,
        level=level_for(points),
        contributions=contribs,
        top_positive=[c for c in ordered if c.points > 0][:3],
        top_negative=[c for c in reversed(ordered) if c.points < 0][:3],
        adjusted_months=fr.adjusted_months,
        data_quality=fr.quality,
    )
