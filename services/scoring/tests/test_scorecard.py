import numpy as np

from tendia_scoring.features import FEATURES, compute_features
from tendia_scoring.scorecard import (
    BASE_POINTS,
    Scorecard,
    fit_bins,
    level_for,
    points_from_pd,
)


def test_points_scale_is_anchored():
    assert round(points_from_pd(0.10), 6) == BASE_POINTS
    # duplicar las odds de pagar suma 10 puntos
    assert round(points_from_pd(1 / 20) - points_from_pd(0.10), 1) == round(10 * np.log2(19 / 9), 1)


def test_levels():
    assert level_for(0).name == "En construcción"
    assert level_for(45).name == "Bueno"
    assert level_for(100).name == "Excelente"


def test_model_loads_and_ranks_risk(good_request, risky_request):
    m = Scorecard.load()
    good = compute_features(good_request).values
    risky = compute_features(risky_request).values
    assert m.score(good) > m.score(risky)
    assert 0 <= m.probability_default(good) < m.probability_default(risky) <= 1


def test_contributions_sum_to_score_difference(good_request):
    m = Scorecard.load()
    values = compute_features(good_request).values
    contribs = m.contributions(values)
    assert [c.feature for c in contribs] == FEATURES
    avg_values_points = points_from_pd(
        1
        / (
            1
            + np.exp(-(m.intercept + sum(m.coefficients[f] * m.bins[f].mean_woe for f in FEATURES)))
        )
    )
    total = sum(c.points for c in contribs)
    assert abs(points_from_pd(m.probability_default(values)) - avg_values_points - total) < 0.1


def test_fit_bins_is_monotonic_on_separable_data():
    x = np.arange(1000, dtype=float)
    y = (x < 200).astype(int)
    b = fit_bins(x, y)
    assert len(b.woe) == len(b.edges) + 1
    assert b.woe[0] < b.woe[-1]


def test_json_round_trip(tmp_path):
    m = Scorecard.load()
    path = tmp_path / "m.json"
    m.save(path)
    again = Scorecard.load(path)
    assert again.coefficients == m.coefficients
    assert again.version == m.version
