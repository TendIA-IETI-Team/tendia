"""Entrena el modelo TendIA v2 (TND-041, TND-043, TND-046).

Uso: uv run python -m tendia_scoring.train
- Componente "pagos": scorecard WoE + regresión logística con 30.000 créditos reales (UCI #350),
  validado en un 30 % reservado y con validación cruzada de 5 particiones. Retador: ensamble de
  stacking (regresión logística + gradient boosting + random forest), el modelo que planteó el
  equipo; solo se adopta si supera al scorecard por más de 0,02 de Gini y es explicable.
- Componente "negocio": scorecard sobre datos sintéticos calibrados con EMICRON, validado fuera
  de tiempo.
- Segmentación: k-means sobre micronegocios reales de comercio (EMICRON 2024).
- Calibración: el negocio promedio queda con la probabilidad de incumplimiento objetivo.
Escribe tendia_scoring/model/tendia-v2.json.
"""

from __future__ import annotations

import json
from datetime import date

import numpy as np
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    RandomForestClassifier,
    StackingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, roc_curve
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .datos import uci
from .datos.emicron import micronegocios_comercio
from .features import FEATURES_NEGOCIO, FEATURES_PAGOS, compute_features
from .scorecard import Componente, ModeloTendIA, fit_bins, ln_odds_from_pd, woe_matrix
from .segmentos import entrenar as entrenar_segmentos
from .segmentos import vector
from .synthetic import generate_dataset

MODEL_VERSION = "tendia-v2"
OOT_COHORTS = 6
# Incumplimiento objetivo del negocio promedio. La cartera de microcrédito en mora fue 5,7 % en
# 2022 (Superfinanciera, vía Portafolio); usamos 10 % por prudencia, porque los tenderos sin
# historial crediticio son una población más riesgosa que la cartera ya colocada.
PD_OBJETIVO = 0.10
# El componente de negocio se entrena con datos sintéticos: pesa la mitad que el de pagos.
PESO_NEGOCIO = 0.5


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


def _scorecard(rows, y, variables):
    bins = {f: fit_bins(np.array([r[f] for r in rows]), y) for f in variables}
    lr = LogisticRegression(C=1.0, max_iter=2000).fit(woe_matrix(rows, bins, variables), y)
    return bins, lr


def componente_pagos() -> tuple[Componente, dict]:
    X, y = uci.dataset()
    y = np.array(y)
    idx = np.arange(len(y))
    tr, te = train_test_split(idx, test_size=0.3, stratify=y, random_state=7)
    rows_tr = [X[i] for i in tr]
    rows_te = [X[i] for i in te]
    bins, lr = _scorecard(rows_tr, y[tr], FEATURES_PAGOS)
    p_te = lr.predict_proba(woe_matrix(rows_te, bins, FEATURES_PAGOS))[:, 1]

    cv = []
    for a, b in StratifiedKFold(5, shuffle=True, random_state=7).split(idx, y):
        bb, ll = _scorecard([X[i] for i in a], y[a], FEATURES_PAGOS)
        p = ll.predict_proba(woe_matrix([X[i] for i in b], bb, FEATURES_PAGOS))[:, 1]
        cv.append(roc_auc_score(y[b], p))

    raw = np.array([[r[f] for f in FEATURES_PAGOS] for r in X])
    stack = StackingClassifier(
        estimators=[
            ("lr", make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000))),
            (
                "gb",
                HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, random_state=7),
            ),
            ("rf", RandomForestClassifier(n_estimators=200, min_samples_leaf=20, random_state=7)),
        ],
        final_estimator=LogisticRegression(max_iter=2000),
        cv=5,
    ).fit(raw[tr], y[tr])
    p_stack = stack.predict_proba(raw[te])[:, 1]

    champion = evaluate(y[te], p_te)
    challenger = evaluate(y[te], p_stack)
    gana = challenger["gini"] - champion["gini"] > 0.02
    metrics = {
        "data": "UCI #350 Default of Credit Card Clients (Yeh 2009, CC BY 4.0): 30.000 créditos",
        "holdout_30pct": champion,
        "cv5_auc_mean": round(float(np.mean(cv)), 4),
        "cv5_auc_std": round(float(np.std(cv)), 4),
        "challenger_stacking_holdout": challenger,
        "challenger_adopted": False,
        "challenger_note": (
            "El stacking supera al scorecard por más de 0,02 de Gini, pero no se adopta aún "
            "porque no es explicable variable por variable (requisito SARC)."
            if gana
            else "El stacking no supera al scorecard por más de 0,02 de Gini."
        ),
        "train_default_rate": round(float(y[tr].mean()), 4),
    }
    comp = Componente(
        nombre="pagos",
        variables=FEATURES_PAGOS,
        intercept=float(lr.intercept_[0]),
        coefficients={f: float(c) for f, c in zip(FEATURES_PAGOS, lr.coef_[0], strict=True)},
        bins=bins,
        peso=1.0,
        entrenado_con="Datos reales: 30.000 créditos (UCI #350)",
        metrics=metrics,
    )
    return comp, metrics


def componente_negocio() -> tuple[Componente, dict, list]:
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
    tr_rows = [r for r, o in zip(rows, oot, strict=True) if not o]
    te_rows = [r for r, o in zip(rows, oot, strict=True) if o]
    bins, lr = _scorecard(tr_rows, y[~oot], FEATURES_NEGOCIO)
    p_te = lr.predict_proba(woe_matrix(te_rows, bins, FEATURES_NEGOCIO))[:, 1]
    metrics = {
        "data": "Sintéticos calibrados con EMICRON 2024 (ventas de comercio en Bogotá)",
        "oot_from_cohort": oot_start,
        "oot": evaluate(y[oot], p_te),
    }
    comp = Componente(
        nombre="negocio",
        variables=FEATURES_NEGOCIO,
        intercept=float(lr.intercept_[0]),
        coefficients={f: float(c) for f, c in zip(FEATURES_NEGOCIO, lr.coef_[0], strict=True)},
        bins=bins,
        peso=PESO_NEGOCIO,
        entrenado_con="Datos sintéticos calibrados con EMICRON 2024 (DANE)",
        metrics=metrics,
    )
    return comp, metrics, list(zip(rows, labels, strict=True))


def segmentacion() -> dict:
    df = micronegocios_comercio(area=None)
    X = np.array(
        [
            vector(r.ventas_mes, r.antiguedad_meses, r.lleva_registros, r.pagos_digitales)
            for r in df.itertuples()
        ]
    )
    seg = entrenar_segmentos(
        X,
        df["peso"].to_numpy(),
        {
            "pidio": df["pidio_credito"].to_numpy(),
            "obtuvo": df["obtuvo_credito"].to_numpy(),
            "gota": df["gota_a_gota"].to_numpy(),
        },
    )
    return {
        "data": f"DANE EMICRON 2024, micronegocios de comercio (n = {len(df)})",
        **seg.to_json(),
    }


def main() -> None:
    pagos, m_pagos = componente_pagos()
    negocio, m_negocio, sinteticos = componente_negocio()
    modelo = ModeloTendIA(
        version=MODEL_VERSION,
        l0=ln_odds_from_pd(PD_OBJETIVO),
        componentes=[pagos, negocio],
        segmentacion=segmentacion(),
        metrics={},
    )
    # Coherencia de punta a punta sobre historiales sintéticos completos (no es una métrica real).
    vals = [r for r, _ in sinteticos]
    ys = np.array([lab for _, lab in sinteticos])
    pd_comb = np.array([modelo.probability_default(v) for v in vals])
    scores = np.array([modelo.score(v) for v in vals])
    franjas = {
        "bajo": scores < 500,
        "medio": (scores >= 500) & (scores < 650),
        "bueno": scores >= 650,
    }
    modelo.metrics = {
        "trained_on": date.today().isoformat(),
        "target": "Incumplimiento el mes siguiente (UCI) / mora > 30 días en 90 días (sintéticos)",
        "pd_objetivo_negocio_promedio": PD_OBJETIVO,
        "peso_componente_negocio": PESO_NEGOCIO,
        "pagos": m_pagos,
        "negocio": m_negocio,
        "combinado_sintetico": {
            "nota": "Coherencia sobre historiales sintéticos; no es desempeño real.",
            **evaluate(ys, pd_comb),
            "distribucion_franjas": {k: round(float(m.mean()), 3) for k, m in franjas.items()},
            "incumplimiento_por_franja": {
                k: round(float(ys[m].mean()), 3) if m.any() else None for k, m in franjas.items()
            },
        },
    }
    modelo.save()
    print(json.dumps(modelo.metrics, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
