"""Modelo TendIA v2: dos scorecards WoE + regresión logística combinados (TND-043).

- Componente "pagos": relación de crédito con el proveedor. Entrenado con 30.000 créditos reales
  (UCI #350).
- Componente "negocio": ventas y su estabilidad. Entrenado con datos sintéticos calibrados con la
  distribución real de ventas de EMICRON 2024 (no existe un dataset público que una ventas de
  tiendas con incumplimiento).

Ambos aportan en log-odds de pago, de forma aditiva, así la explicación es exacta:
    ln(odds de pagar) = L0 + Σ_c peso_c · Σ_j −coef_j · (WoE_j − WoE promedio_j)
    Puntaje = A + B · ln(odds de pagar), recortado a 0-1000.

El modelo se guarda como JSON legible: cualquiera puede auditarlo y cargarlo no ejecuta código.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from .features import FEATURE_LABELS, display_value
from .schemas import Band, ComponentScore, Contribution

# Escala 0-1000: 500 puntos ≈ 20 % de incumplimiento y 650 ≈ 8 %. Cada ~99 puntos se duplican
# las odds de pagar. Las franjas siguen la prueba con doña Gloria: bajo, medio y bueno.
ESCALA_A = 303.0
ESCALA_B = 142.0
FRANJAS = [
    ("bajo", "Bajo", 0, 499),
    ("medio", "Medio", 500, 649),
    ("bueno", "Bueno", 650, 1000),
]

DEFAULT_MODEL_PATH = Path(__file__).parent / "model" / "tendia-v2.json"

ETIQUETAS_COMPONENTE = {
    "pagos": "Cómo le pagas a tu proveedor",
    "negocio": "Cómo se mueven tus ventas",
}


def band_for(score: int) -> Band:
    for code, name, lo, hi in FRANJAS:
        if lo <= score <= hi:
            return Band(code=code, name=name, min_score=lo, max_score=hi)
    raise ValueError(score)


def points_from_odds(ln_odds_good: float) -> float:
    return ESCALA_A + ESCALA_B * ln_odds_good


def ln_odds_from_pd(pd: float) -> float:
    pd = min(max(pd, 1e-6), 1 - 1e-6)
    return math.log((1 - pd) / pd)


@dataclass
class FeatureBins:
    edges: list[float]  # cortes internos, len = n_bins - 1
    woe: list[float]  # len = n_bins
    mean_woe: float

    def woe_for(self, value: float) -> float:
        return self.woe[int(np.searchsorted(self.edges, value, side="right"))]


@dataclass
class Componente:
    nombre: str  # "pagos" | "negocio"
    variables: list[str]
    intercept: float
    coefficients: dict[str, float]
    bins: dict[str, FeatureBins]
    peso: float
    entrenado_con: str
    metrics: dict = field(default_factory=dict)

    def ln_odds(self, values: dict[str, float]) -> dict[str, float]:
        """Aporte de cada variable al ln(odds de pagar), centrado en el negocio promedio."""
        return {
            f: -self.peso
            * self.coefficients[f]
            * (self.bins[f].woe_for(values[f]) - self.bins[f].mean_woe)
            for f in self.variables
        }

    def to_json(self) -> dict:
        return {
            "nombre": self.nombre,
            "variables": self.variables,
            "intercept": self.intercept,
            "coefficients": self.coefficients,
            "bins": {
                f: {"edges": b.edges, "woe": b.woe, "mean_woe": b.mean_woe}
                for f, b in self.bins.items()
            },
            "peso": self.peso,
            "entrenado_con": self.entrenado_con,
            "metrics": self.metrics,
        }

    @classmethod
    def from_json(cls, d: dict) -> Componente:
        return cls(
            nombre=d["nombre"],
            variables=list(d["variables"]),
            intercept=float(d["intercept"]),
            coefficients={k: float(v) for k, v in d["coefficients"].items()},
            bins={
                f: FeatureBins(edges=list(b["edges"]), woe=list(b["woe"]), mean_woe=b["mean_woe"])
                for f, b in d["bins"].items()
            },
            peso=float(d["peso"]),
            entrenado_con=d["entrenado_con"],
            metrics=d.get("metrics", {}),
        )


@dataclass
class ModeloTendIA:
    version: str
    l0: float  # ln(odds de pagar) del negocio promedio, calibrado
    componentes: list[Componente]
    segmentacion: dict
    metrics: dict

    def contribuciones_ln_odds(self, values: dict[str, float]) -> dict[str, tuple[str, float]]:
        out: dict[str, tuple[str, float]] = {}
        for c in self.componentes:
            for f, v in c.ln_odds(values).items():
                out[f] = (c.nombre, v)
        return out

    def ln_odds_good(self, values: dict[str, float]) -> float:
        return self.l0 + sum(v for _, v in self.contribuciones_ln_odds(values).values())

    def probability_default(self, values: dict[str, float]) -> float:
        return 1.0 / (1.0 + math.exp(self.ln_odds_good(values)))

    def score(self, values: dict[str, float]) -> int:
        return int(round(min(1000.0, max(0.0, points_from_odds(self.ln_odds_good(values))))))

    def contributions(self, values: dict[str, float]) -> list[Contribution]:
        """Puntos de cada variable frente a un negocio promedio (positivo = sube el puntaje)."""
        return [
            Contribution(
                feature=f,
                component=comp,
                label=FEATURE_LABELS[f],
                value=round(values[f], 4),
                display_value=display_value(f, values[f]),
                points=round(ESCALA_B * v, 1),
            )
            for f, (comp, v) in self.contribuciones_ln_odds(values).items()
        ]

    def components(self, contribs: list[Contribution]) -> list[ComponentScore]:
        return [
            ComponentScore(
                name=c.nombre,
                label=ETIQUETAS_COMPONENTE[c.nombre],
                points=round(sum(x.points for x in contribs if x.component == c.nombre), 1),
                trained_on=c.entrenado_con,
            )
            for c in self.componentes
        ]

    # --- persistencia -----------------------------------------------------
    def to_json(self) -> dict:
        return {
            "version": self.version,
            "escala": {"A": ESCALA_A, "B": ESCALA_B, "franjas": FRANJAS},
            "l0": self.l0,
            "componentes": [c.to_json() for c in self.componentes],
            "segmentacion": self.segmentacion,
            "metrics": self.metrics,
        }

    @classmethod
    def from_json(cls, d: dict) -> ModeloTendIA:
        return cls(
            version=d["version"],
            l0=float(d["l0"]),
            componentes=[Componente.from_json(c) for c in d["componentes"]],
            segmentacion=d["segmentacion"],
            metrics=d.get("metrics", {}),
        )

    @classmethod
    def load(cls, path: Path = DEFAULT_MODEL_PATH) -> ModeloTendIA:
        return cls.from_json(json.loads(Path(path).read_text(encoding="utf-8")))

    def save(self, path: Path = DEFAULT_MODEL_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_json(), indent=1, ensure_ascii=False), encoding="utf-8")


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


def woe_matrix(
    rows: list[dict[str, float]], bins: dict[str, FeatureBins], variables: list[str]
) -> np.ndarray:
    return np.array([[bins[f].woe_for(r[f]) for f in variables] for r in rows])
