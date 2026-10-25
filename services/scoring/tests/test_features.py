import pytest
from pydantic import ValidationError

from tendia_scoring.features import FEATURES, compute_features, display_value
from tendia_scoring.schemas import Adjustment, ScoreRequest
from tendia_scoring.synthetic import month_add, months_ending


def test_month_helpers():
    assert month_add("2026-01", -1) == "2025-12"
    assert month_add("2025-12", 1) == "2026-01"
    assert months_ending("2026-03", 3) == ["2026-01", "2026-02", "2026-03"]


def test_compute_features_has_all_variables(good_request):
    fr = compute_features(good_request)
    assert fr.quality.sufficient
    assert set(fr.values) == set(FEATURES)
    assert 0 <= fr.values["pago_meses_al_dia"] <= 1
    assert fr.has_datafono


def test_insufficient_data_is_reported():
    req = ScoreRequest.model_validate(
        {
            "business": {"business_age_months": 10},
            "sales": [{"month": "2026-01", "amount": 1000}],
            "distributor": [],
        }
    )
    fr = compute_features(req)
    assert not fr.quality.sufficient
    assert {i.code for i in fr.quality.issues} == {"pocas_ventas", "pocos_pagos_proveedor"}
    assert fr.values == {}


def test_datafono_has_priority_over_declared(good_request):
    req = good_request.model_copy(deep=True)
    req.sales.append(req.sales[-1].model_copy(update={"amount": 1.0, "source": "declarado"}))
    assert (
        compute_features(req).values["avg_sales"]
        == compute_features(good_request).values["avg_sales"]
    )


def test_adjustment_removes_bad_month_from_stability(good_request):
    req = good_request.model_copy(deep=True)
    req.sales[-2] = req.sales[-2].model_copy(update={"amount": req.sales[-2].amount * 0.2})
    before = compute_features(req)
    req.adjustments = [Adjustment(month=req.sales[-2].month, reason="Obras en la calle")]
    after = compute_features(req)
    assert after.adjusted_months == [req.sales[-2].month]
    assert after.values["sales_cv"] < before.values["sales_cv"]
    assert after.values["low_months_ratio"] <= before.values["low_months_ratio"]


def test_late_payments_become_months_of_delay(good_request):
    req = good_request.model_copy(deep=True)
    for d in req.distributor[-3:]:
        d.paid_on_time = 0
        d.avg_days_late = 45
    v = compute_features(req).values
    assert v["pago_meses_al_dia"] == 0.5
    assert v["pago_max_meses_mora"] == 2


def test_declared_sales_mismatch_is_flagged(good_request):
    req = good_request.model_copy(deep=True)
    req.business.declared_monthly_sales = compute_features(req).values["avg_sales"] * 3
    codes = {i.code for i in compute_features(req).quality.issues}
    assert "ventas_declaradas_no_coinciden" in codes


def test_purchases_ratio_flags(good_request):
    high = good_request.model_copy(deep=True)
    for d in high.distributor:
        d.purchases *= 3
    assert "compras_mayores_que_ventas" in {i.code for i in compute_features(high).quality.issues}
    low = good_request.model_copy(deep=True)
    for d in low.distributor:
        d.purchases *= 0.1
    assert "compras_muy_bajas" in {i.code for i in compute_features(low).quality.issues}


def test_invalid_month_is_rejected():
    with pytest.raises(ValidationError):
        ScoreRequest.model_validate(
            {"business": {"business_age_months": 1}, "sales": [{"month": "2026-13", "amount": 1}]}
        )


@pytest.mark.parametrize(
    ("feature", "value", "expected"),
    [
        ("avg_sales", 1234567, "$1.234.567"),
        ("pago_meses_al_dia", 0.5, "50 %"),
        ("sales_trend", -0.05, "-5 %"),
        ("pago_max_meses_mora", 0, "ninguno"),
        ("pago_max_meses_mora", 1, "1 mes"),
        ("pago_max_meses_mora", 3, "3 meses"),
        ("business_age_months", 24, "24 meses"),
        ("otra", 0.5, "0.50"),
    ],
)
def test_display_value(feature, value, expected):
    assert display_value(feature, value) == expected
