from fastapi.testclient import TestClient

from tendia_scoring.app import app

client = TestClient(app)

# Contrato v1 (TND-071): si un campo cambia, esta prueba falla y obliga a versionar.
RESPONSE_FIELDS = {
    "model_version",
    "request_id",
    "probability_default",
    "score",
    "level",
    "contributions",
    "top_positive",
    "top_negative",
    "adjusted_months",
    "data_quality",
}
CONTRIBUTION_FIELDS = {"feature", "label", "value", "display_value", "points"}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["model_version"] == "scorecard-v1"


def test_model_info_has_oot_metrics():
    metrics = client.get("/model").json()["metrics"]
    assert metrics["oot"]["gini"] > 0.3


def test_score_contract(good_request):
    r = client.post("/score", json=good_request.model_dump(), headers={"x-request-id": "req-123"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == RESPONSE_FIELDS
    assert body["request_id"] == "req-123"
    assert 0 <= body["score"] <= 100
    assert body["level"]["name"]
    assert set(body["contributions"][0]) == CONTRIBUTION_FIELDS
    assert len(body["top_positive"]) <= 3
    assert all(c["points"] > 0 for c in body["top_positive"])
    assert all(c["points"] < 0 for c in body["top_negative"])


def test_justified_month_raises_or_keeps_score(good_request):
    req = good_request.model_dump()
    req["sales"][-3]["amount"] *= 0.2
    base = client.post("/score", json=req).json()["score"]
    req["adjustments"] = [{"month": req["sales"][-3]["month"], "reason": "Temporada de lluvias"}]
    adjusted = client.post("/score", json=req).json()
    assert adjusted["adjusted_months"] == [req["sales"][-3]["month"]]
    assert adjusted["score"] >= base


def test_insufficient_data_returns_null_score():
    r = client.post("/score", json={"business": {"business_age_months": 3}})
    body = r.json()
    assert r.status_code == 200
    assert body["score"] is None
    assert body["data_quality"]["sufficient"] is False


def test_rejects_unknown_fields():
    r = client.post("/score", json={"business": {"business_age_months": 3}, "cedula": "123"})
    assert r.status_code == 422
