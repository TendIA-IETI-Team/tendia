"""Segmentación de negocios entrenada con datos reales de EMICRON 2024 (DANE).

K-means (k=4) sobre los micronegocios de comercio del país, ponderados por su factor de
expansión. Cada tendero se clasifica en el segmento más cercano. Para cada segmento guardamos
estadísticas reales: cuántos pidieron crédito, cuántos lo obtuvieron y cuántos acudieron al
gota a gota. El modelo se guarda como JSON (centroides y escalado), sin pickle.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

VARIABLES = ["log_ventas_mes", "log_antiguedad_meses", "lleva_registros", "pagos_digitales"]
PESO_INVERSO = [1.0, 1.0, 2.0, 2.0]

DESCRIPCIONES = {
    "consolidada": (
        "Tienda consolidada",
        "Ventas altas y muchos años de funcionamiento.",
    ),
    "tradicional": (
        "Tienda tradicional",
        "Ventas modestas y una larga trayectoria en el barrio.",
    ),
    "joven": (
        "Negocio joven",
        "Ventas medias con pocos años de funcionamiento.",
    ),
    "subsistencia": (
        "Negocio de subsistencia",
        "Ventas bajas y pocos años: el negocio cubre lo básico del hogar.",
    ),
}


def vector(ventas_mes: float, antiguedad_meses: float, registros: float, digitales: float):
    return [
        math.log1p(max(ventas_mes, 0.0)),
        math.log1p(max(antiguedad_meses, 0.0)),
        float(registros),
        float(digitales),
    ]


@dataclass
class Segmentacion:
    media: list[float]
    desviacion: list[float]
    centroides: list[list[float]]  # en espacio estandarizado
    codigos: list[str]  # código del segmento de cada centroide
    estadisticas: dict[str, dict]  # por código: datos reales del segmento

    def asignar(self, x: list[float]) -> str:
        z = (np.array(x) - np.array(self.media)) / np.array(self.desviacion)
        d = ((np.array(self.centroides) - z) ** 2).sum(axis=1)
        return self.codigos[int(np.argmin(d))]

    def describir(self, codigo: str) -> dict:
        nombre, descripcion = DESCRIPCIONES[codigo]
        return {
            "code": codigo,
            "name": nombre,
            "description": descripcion,
            **self.estadisticas[codigo],
        }

    def to_json(self) -> dict:
        return self.__dict__

    @classmethod
    def from_json(cls, d: dict) -> Segmentacion:
        return cls(**d)


def entrenar(X: np.ndarray, pesos: np.ndarray, extras: dict[str, np.ndarray], semilla: int = 7):
    """Ajusta k-means y nombra los segmentos según sus centroides en unidades originales."""
    from sklearn.cluster import KMeans

    media = np.average(X, axis=0, weights=pesos)
    desv = np.sqrt(np.average((X - media) ** 2, axis=0, weights=pesos))
    desv[desv == 0] = 1.0
    # Ventas y antigüedad definen el segmento; registros y pagos digitales pesan la mitad
    # (si pesaran igual, el k-means se partiría solo por esas dos variables de sí/no).
    desv = desv * np.array(PESO_INVERSO)
    Z = (X - media) / desv
    km = KMeans(n_clusters=4, n_init=20, random_state=semilla).fit(Z, sample_weight=pesos)
    etiquetas = km.labels_
    orig = km.cluster_centers_ * desv + media  # log-ventas, log-antigüedad, ...

    orden_ventas = np.argsort(orig[:, 0])
    codigos = [""] * 4
    codigos[orden_ventas[-1]] = "consolidada"
    codigos[orden_ventas[0]] = "subsistencia"
    medios = sorted(orden_ventas[1:3], key=lambda i: orig[i, 1])
    codigos[medios[0]] = "joven"
    codigos[medios[1]] = "tradicional"

    estad: dict[str, dict] = {}
    for k in range(4):
        m = etiquetas == k
        w = pesos[m]
        estad[codigos[k]] = {
            "share_of_businesses": round(float(w.sum() / pesos.sum()), 3),
            "median_monthly_sales": round(float(np.expm1(np.median(X[m, 0]))), -3),
            "median_age_months": round(float(np.expm1(np.median(X[m, 1])))),
            "requested_credit": round(float(np.average(extras["pidio"][m], weights=w)), 3),
            "obtained_credit": round(float(np.average(extras["obtuvo"][m], weights=w)), 3),
            "used_loan_sharks": round(float(np.average(extras["gota"][m], weights=w)), 3),
            "n_sample": int(m.sum()),
        }
    return Segmentacion(
        media=media.round(6).tolist(),
        desviacion=desv.round(6).tolist(),
        centroides=km.cluster_centers_.round(6).tolist(),
        codigos=codigos,
        estadisticas=estad,
    )
