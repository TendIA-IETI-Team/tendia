"""Entrena el scorecard baseline y lo compara con un modelo de boosting (TND-043, TND-046).

Uso: uv run python -m tendia_scoring.train
Genera tendia_scoring/model/scorecard-v1.json con cortes, WoE, coeficientes y métricas.
"""

from __future__ import annotations

import json
from datetime import date

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, roc_curve

from .features import FEATURES, compute_features
from .scorecard import Scorecard, fit_bins, woe_matrix
from .synthetic import generate_dataset

MODEL_VERSION = "scorecard-v1"
OOT_COHORTS = 6  # los últimos 6 meses de cohortes se reservan para validación fuera de tiempo


def ks_stat(y: np.ndarray, p: np.ndarray) -> float:
    fpr, tpr, _ = roc_curve(y, p)
    return float(np.max(tpr - fpr))


def evaluate(y: np.ndarray, p: np.ndarray) -> dict:
    auc = float(roc_auc_score(y, p))
    return {
        "auc": round(auc, 4),
        "gini": round(2 * auc - 1, 4),
        "ks": round(ks_stat(y, p), 4),
        "n": int(len(y)),
        "default_rate": round(float(y.mean()), 4),
    }


def main() -> None:
    data = generate_dataset()
    cohorts = sorted({d.cohort for d in data})
    oot_start = cohorts[-OOT_COHORTS]

    rows, labels, is_oot = [], [], []
    for d in data:
        fr = compute_features(d.request)
        if not fr.quality.sufficient:
            continue
        rows.append(fr.values)
        labels.append(d.defaulted)
        is_oot.append(d.cohort >= oot_start)
    y = np.array(labels)
    oot = np.array(is_oot)
    train_rows = [r for r, o in zip(rows, oot, strict=True) if not o]
    test_rows = [r for r, o in zip(rows, oot, strict=True) if o]
    y_train, y_test = y[~oot], y[oot]

    bins = {f: fit_bins(np.array([r[f] for r in train_rows]), y_train) for f in FEATURES}
    x_train = woe_matrix(train_rows, bins)
    x_test = woe_matrix(test_rows, bins)
    lr = LogisticRegression(C=1.0, max_iter=1000)
    lr.fit(x_train, y_train)

    raw_train = np.array([[r[f] for f in FEATURES] for r in train_rows])
    raw_test = np.array([[r[f] for f in FEATURES] for r in test_rows])
    gb = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, random_state=7)
    gb.fit(raw_train, y_train)

    baseline_oot = evaluate(y_test, lr.predict_proba(x_test)[:, 1])
    challenger_oot = evaluate(y_test, gb.predict_proba(raw_test)[:, 1])
    metrics = {
        "trained_on": date.today().isoformat(),
        "data": "sintéticos (tendia_scoring.synthetic, semilla 20261023)",
        "target": "mora > 30 días dentro de los 90 días siguientes",
        "oot_from_cohort": oot_start,
        "train": evaluate(y_train, lr.predict_proba(x_train)[:, 1]),
        "oot": baseline_oot,
        "challenger_gradient_boosting_oot": challenger_oot,
        "challenger_adopted": challenger_oot["gini"] > baseline_oot["gini"] + 0.02,
    }

    model = Scorecard(
        version=MODEL_VERSION,
        intercept=float(lr.intercept_[0]),
        coefficients={f: float(c) for f, c in zip(FEATURES, lr.coef_[0], strict=True)},
        bins=bins,
        metrics=metrics,
    )
    model.save()
    print(json.dumps(metrics, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
