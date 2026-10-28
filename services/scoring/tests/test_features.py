import pytest
from pydantic import ValidationError

from tendia_scoring.features import (
    FEATURES,
    _monthly_sales,
    _shape_series,
    compute_features,
    display_value,
)
from tendia_scoring.schemas import Adjustment, SalesMonth, ScoreRequest
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


def _con_ventas(req: ScoreRequest, ventas: list[tuple[str, float, str]]) -> ScoreRequest:
    req = req.model_copy(deep=True)
    req.sales = [SalesMonth(month=m, amount=a, source=f) for m, a, f in ventas]
    return req


# Caso real de la prueba en el navegador: 4 meses de datáfono (solo tarjeta) y el total
# declarado de 6 meses en T5, que sube. Mezclados mes a mes parecían una caída de 44 %.
DECLARADO = [
    ("2026-04", 5_100_000),
    ("2026-05", 5_400_000),
    ("2026-06", 5_600_000),
    ("2026-07", 6_000_000),
    ("2026-08", 5_900_000),
    ("2026-09", 6_200_000),
]
DATAFONO = [
    ("2026-06", 2_448_000),
    ("2026-07", 2_150_000),
    ("2026-08", 2_632_000),
    ("2026-09", 2_417_000),
]


def test_mixed_sources_do_not_invent_a_drop(good_request):
    req = _con_ventas(
        good_request,
        [(m, a, "declarado") for m, a in DECLARADO] + [(m, a, "datafono") for m, a in DATAFONO],
    )
    v = compute_features(req).values
    assert v["sales_trend"] == pytest.approx((6_033_333 - 5_366_667) / 5_366_667, rel=1e-4)
    assert v["sales_cv"] < 0.1
    assert v["low_months_ratio"] == 0
    # El promedio sigue usando la fuente prioritaria de cada mes.
    assert v["avg_sales"] == pytest.approx((5_100_000 + 5_400_000 + 2_411_750 * 4) / 6, rel=1e-4)


def test_shape_uses_the_source_with_most_months(good_request):
    # El tendero solo llenó los 2 meses que faltaban: manda el datáfono, que tiene 4.
    req = _con_ventas(
        good_request,
        [(m, a, "declarado") for m, a in DECLARADO[:2]] + [(m, a, "datafono") for m, a in DATAFONO],
    )
    sales, _ = _monthly_sales(req)
    assert list(_shape_series(req, sales)) == [m for m, _ in DATAFONO]
    assert compute_features(req).values["sales_trend"] == 0.0  # 4 meses no alcanzan para tendencia


def test_shape_falls_back_to_the_mix_with_few_months_per_source(good_request):
    meses = [m for m, _ in DECLARADO]
    fuentes = ["datafono", "datafono", "open_finance", "open_finance", "declarado", "declarado"]
    req = _con_ventas(
        good_request, [(m, 1_000_000.0, f) for m, f in zip(meses, fuentes, strict=True)]
    )
    sales, _ = _monthly_sales(req)
    assert _shape_series(req, sales) == sales


def test_single_source_shape_is_the_same_series(good_request):
    # Paridad con el entrenamiento, donde todas las ventas son de datáfono.
    sales, _ = _monthly_sales(good_request)
    assert _shape_series(good_request, sales) == sales


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
