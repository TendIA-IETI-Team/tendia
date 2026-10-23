"""Scorecard de regresión logística sobre WoE (TND-043).

El modelo se guarda como JSON legible (cortes, WoE y coeficientes), no como pickle:
cualquiera puede auditarlo y cargarlo no ejecuta código.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .features import FEATURE_LABELS, FEATURES, display_value
from .schemas import Contribution, Level

# Escala del Puntaje TendIA (0-100): 50 puntos = odds 9:1 (10 % de incumplimiento),
# cada vez que se duplican las odds de pagar se suman 10 puntos.
BASE_POINTS = 50.0
BASE_ODDS = 9.0
PDO = 10.0
FACTOR = PDO / math.log(2)

# Cortes calibrados con la distribución del modelo v1 (acumulados ~18/45/80/96 %).
# Tasas de incumplimiento por nivel en docs/model-card.md.
LEVELS = [
    (0, "En construcción"),
    (30, "Básico"),
    (45, "Bueno"),
    (60, "Muy bueno"),
    (72, "Excelente"),
]

DEFAULT_MODEL_PATH = Path(__file__).parent / "model" / "scorecard-v1.json"


def level_for(score: int) -> Level:
    idx = 0
    for i, (threshold, _) in enumerate(LEVELS):
        if score >= threshold:
            idx = i
    return Level(index=idx, name=LEVELS[idx][1])


def points_from_pd(pd: float) -> float:
    pd = min(max(pd, 1e-6), 1 - 1e-6)
    odds_good = (1 - pd) / pd
    return BASE_POINTS + FACTOR * (math.log(odds_good) - math.log(BASE_ODDS))


@dataclass
class FeatureBins:
    edges: list[float]  # cortes internos, len = n_bins - 1
    woe: list[float]  # len = n_bins
    mean_woe: float

    def bin_index(self, value: float) -> int:
        return int(np.searchsorted(self.edges, value, side="right"))

    def woe_for(self, value: float) -> float:
        return self.woe[self.bin_index(value)]


@dataclass
class Scorecard:
    version: str
    intercept: float
    coefficients: dict[str, float]
    bins: dict[str, FeatureBins]
    metrics: dict

    # --- inferencia -------------------------------------------------------
    def logit(self, values: dict[str, float]) -> float:
        return self.intercept + sum(
            self.coefficients[f] * self.bins[f].woe_for(values[f]) for f in FEATURES
        )

    def probability_default(self, values: dict[str, float]) -> float:
        return 1.0 / (1.0 + math.exp(-self.logit(values)))

    def score(self, values: dict[str, float]) -> int:
        return int(round(min(100.0, max(0.0, points_from_pd(self.probability_default(values))))))

    def contributions(self, values: dict[str, float]) -> list[Contribution]:
        """Puntos de cada variable frente a un negocio promedio (positivo = sube el score)."""
        out = []
        for f in FEATURES:
            b = self.bins[f]
            pts = -FACTOR * self.coefficients[f] * (b.woe_for(values[f]) - b.mean_woe)
            out.append(
                Contribution(
                    feature=f,
                    label=FEATURE_LABELS[f],
                    value=round(values[f], 4),
                    display_value=display_value(f, values[f]),
                    points=round(pts, 2),
                )
            )
        return out

    # --- persistencia -----------------------------------------------------
    def to_json(self) -> dict:
        return {
            "version": self.version,
            "intercept": self.intercept,
            "coefficients": self.coefficients,
            "bins": {
                f: {"edges": b.edges, "woe": b.woe, "mean_woe": b.mean_woe}
                for f, b in self.bins.items()
            },
            "metrics": self.metrics,
        }

    @classmethod
    def from_json(cls, data: dict) -> Scorecard:
        return cls(
            version=data["version"],
            intercept=float(data["intercept"]),
            coefficients={k: float(v) for k, v in data["coefficients"].items()},
            bins={
                f: FeatureBins(edges=list(b["edges"]), woe=list(b["woe"]), mean_woe=b["mean_woe"])
                for f, b in data["bins"].items()
            },
            metrics=data.get("metrics", {}),
        )

    @classmethod
    def load(cls, path: Path = DEFAULT_MODEL_PATH) -> Scorecard:
        return cls.from_json(json.loads(Path(path).read_text(encoding="utf-8")))

    def save(self, path: Path = DEFAULT_MODEL_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_json(), indent=2, ensure_ascii=False), encoding="utf-8")


# --- entrenamiento ---------------------------------------------------------
def fit_bins(x: np.ndarray, y: np.ndarray, n_bins: int = 5) -> FeatureBins:
    """Cortes por cuantiles y WoE = ln(%buenos / %malos) con suavizado de 0.5."""
    qs = np.unique(np.quantile(x, np.linspace(0, 1, n_bins + 1)[1:-1]))
    edges = [float(q) for q in qs]
    idx = np.searchsorted(edges, x, side="right")
    goods_total = float((y == 0).sum())
    bads_total = float((y == 1).sum())
    woe = []
    for b in range(len(edges) + 1):
        mask = idx == b
        goods = float(((y == 0) & mask).sum()) + 0.5
        bads = float(((y == 1) & mask).sum()) + 0.5
        woe.append(math.log((goods / goods_total) / (bads / bads_total)))
    mean_woe = float(np.mean([woe[i] for i in idx]))
    return FeatureBins(edges=edges, woe=woe, mean_woe=mean_woe)


def woe_matrix(rows: list[dict[str, float]], bins: dict[str, FeatureBins]) -> np.ndarray:
    return np.array([[bins[f].woe_for(r[f]) for f in FEATURES] for r in rows])
