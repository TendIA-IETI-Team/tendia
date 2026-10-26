import math

import numpy as np

from tendia_scoring.features import FEATURES, compute_features
from tendia_scoring.scorecard import (
    ESCALA_A,
    ESCALA_B,
    ModeloTendIA,
    band_for,
    fit_bins,
    ln_odds_from_pd,
    points_from_odds,
)
from tendia_scoring.segmentos import Segmentacion, vector


def test_scale_anchors_bands_to_default_rates():
    # 500 ≈ 20 % de incumplimiento y 650 ≈ 8 %
    assert abs(points_from_odds(ln_odds_from_pd(0.20)) - 500) < 2
    assert abs(points_from_odds(ln_odds_from_pd(0.08)) - 650) < 2
    assert ESCALA_A == 303 and ESCALA_B == 142


def test_bands():
    assert band_for(0).code == "bajo"
    assert band_for(499).code == "bajo"
    assert band_for(500).code == "medio"
    assert band_for(650).code == "bueno"
    assert band_for(1000).name == "Bueno"


def test_model_loads_and_ranks_risk(good_request, risky_request):
    m = ModeloTendIA.load()
    good = compute_features(good_request).values
    risky = compute_features(risky_request).values
    assert m.score(good) > m.score(risky)
    assert 0 <= m.probability_default(good) < m.probability_default(risky) <= 1
    assert {c.nombre for c in m.componentes} == {"pagos", "negocio"}


def test_contributions_explain_the_score_exactly(good_request):
    m = ModeloTendIA.load()
    values = compute_features(good_request).values
    contribs = m.contributions(values)
    assert sorted(c.feature for c in contribs) == sorted(FEATURES)
    raw = points_from_odds(m.ln_odds_good(values))
    assert abs(points_from_odds(m.l0) + sum(c.points for c in contribs) - raw) < 1
    comps = m.components(contribs)
    assert abs(sum(c.points for c in comps) - sum(c.points for c in contribs)) < 0.5
    assert math.isclose(m.probability_default(values), 1 / (1 + math.exp(m.ln_odds_good(values))))


def test_model_metrics_are_documented():
    m = ModeloTendIA.load()
    assert m.metrics["pagos"]["holdout_30pct"]["n"] == 9000
    assert m.metrics["pagos"]["holdout_30pct"]["gini"] > 0.4
    assert m.metrics["pagos"]["challenger_adopted"] is False


def test_fit_bins_is_monotonic_on_separable_data():
    x = np.arange(1000, dtype=float)
    y = (x < 200).astype(int)
    b = fit_bins(x, y)
    assert len(b.woe) == len(b.edges) + 1
    assert b.woe[0] < b.woe[-1]


def test_json_round_trip(tmp_path):
    m = ModeloTendIA.load()
    path = tmp_path / "m.json"
    m.save(path)
    again = ModeloTendIA.load(path)
    assert again.l0 == m.l0
    assert again.componentes[0].coefficients == m.componentes[0].coefficients


def test_segmentation_from_real_emicron_data():
    m = ModeloTendIA.load()
    seg = Segmentacion.from_json({k: v for k, v in m.segmentacion.items() if k != "data"})
    assert sorted(seg.codigos) == ["consolidada", "joven", "subsistencia", "tradicional"]
    assert seg.asignar(vector(15_000_000, 200, 1, 1)) == "consolidada"
    assert seg.asignar(vector(400_000, 12, 0, 0)) == "subsistencia"
    d = seg.describir("joven")
    assert d["name"] == "Negocio joven"
    assert 0 <= d["used_loan_sharks"] <= 1
    assert abs(sum(s["share_of_businesses"] for s in seg.estadisticas.values()) - 1) < 0.01
