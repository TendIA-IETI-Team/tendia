from fastapi.testclient import TestClient

from tendia_scoring.app import app

client = TestClient(app)

# Contrato v2 (TND-071): si un campo cambia, esta prueba falla y obliga a versionar.
RESPONSE_FIELDS = {
    "contract_version",
    "model_version",
    "request_id",
    "probability_default",
    "score",
    "band",
    "segment",
    "components",
    "contributions",
    "top_positive",
    "top_negative",
    "adjusted_months",
    "data_quality",
    "indicators",  # adición compatible de v2 (TND-042): campo nuevo, opcional para el cliente
}
INDICATOR_FIELDS = {
    "avg_ticket",
    "repurchase_regularity",
    "days_between_purchases",
    "sales_per_peso_purchased",
    "seasonality",
}
CONTRIBUTION_FIELDS = {"feature", "component", "label", "value", "display_value", "points"}
BAND_FIELDS = {"code", "name", "min_score", "max_score"}
SEGMENT_FIELDS = {
    "code",
    "name",
    "description",
    "share_of_businesses",
    "median_monthly_sales",
    "median_age_months",
    "requested_credit",
    "obtained_credit",
    "used_loan_sharks",
    "n_sample",
}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model_version"] == "tendia-v2"
    assert body["contract_version"] == "2"
    assert body["release"]


def test_release_usa_el_commit_de_render(monkeypatch):
    import importlib

    import tendia_scoring.app as app_mod

    monkeypatch.delenv("RELEASE", raising=False)
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abc1234")
    try:
        assert importlib.reload(app_mod).RELEASE == "abc1234"
        monkeypatch.setenv("RELEASE", "v-explicita")
        assert importlib.reload(app_mod).RELEASE == "v-explicita"
    finally:
        monkeypatch.undo()
        importlib.reload(app_mod)


def test_model_info_has_real_data_metrics():
    metrics = client.get("/model").json()["metrics"]
    assert "UCI" in metrics["pagos"]["data"]
    assert metrics["pagos"]["holdout_30pct"]["gini"] > 0.4


def test_referencias_reales():
    r = client.get("/referencias").json()
    assert r["tasas"]["filtro"] == "Crédito productivo, CIIU 4711, Bogotá"
    assert r["tasas"]["tasa_efectiva_anual"]["p50"] > 0
    assert r["emicron"]["n_muestra"] > 100


def test_score_contract(good_request):
    r = client.post("/score", json=good_request.model_dump(), headers={"x-request-id": "req-123"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == RESPONSE_FIELDS
    assert body["contract_version"] == "2"
    assert body["request_id"] == "req-123"
    assert 0 <= body["score"] <= 1000
    assert set(body["band"]) == BAND_FIELDS
    assert set(body["segment"]) == SEGMENT_FIELDS
    assert {c["name"] for c in body["components"]} == {"pagos", "negocio"}
    assert set(body["contributions"][0]) == CONTRIBUTION_FIELDS
    assert set(body["indicators"]) == INDICATOR_FIELDS
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
    assert body["band"] is None
    assert body["data_quality"]["sufficient"] is False


def test_rejects_unknown_fields():
    r = client.post("/score", json={"business": {"business_age_months": 3}, "cedula": "123"})
    assert r.status_code == 422


def test_indicadores_del_negocio(good_request):
    req = good_request.model_dump()
    for s in req["sales"]:
        s["transactions"] = round(s["amount"] / 10_000)
    ind = client.post("/score", json=req).json()["indicators"]
    assert 9_000 <= ind["avg_ticket"] <= 11_000
    assert 0 < ind["repurchase_regularity"] <= 1
    assert ind["days_between_purchases"] > 0
    assert ind["sales_per_peso_purchased"] > 0
    assert 0 <= ind["seasonality"] <= 1


def test_indicadores_sin_datos_quedan_vacios():
    body = client.post(
        "/score",
        json={"business": {"business_age_months": 3}, "sales": [], "distributor": []},
    ).json()
    assert body["score"] is None
    assert body["indicators"] == {k: None for k in INDICATOR_FIELDS}
