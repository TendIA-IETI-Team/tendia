"""DANE EMICRON 2024: micronegocios de comercio en Bogotá (proxy de tiendas de barrio).

Variables usadas (diccionario: microdatos.dane.gov.co/index.php/catalog/875/data-dictionary):
- GRUPOS12 = 05 "Comercio y reparación de vehículos"; AREA = 11 Bogotá.
- VENTAS_MES_ANTERIOR: ventas o ingresos del mes.
- P3068_*: meses del año anterior en que funcionó el negocio (P3068_TOD = todo el año).
- P3034: meses que lleva trabajando en el negocio.
- P640: registro de cuentas (3 = libreta/cuaderno/excel; 5 = no lleva registros).
- P1764_3/5/6: acepta transferencia, tarjeta débito o crédito (pagos digitales).
- P1765: solicitó crédito el año anterior; P1568: lo obtuvo; P1569: a quién (5 = gota a gota).
"""

from __future__ import annotations

import io
import zipfile

import numpy as np
import pandas as pd

from .fuentes import EMICRON_2024, descargar

LLAVE = ["DIRECTORIO", "SECUENCIA_P", "SECUENCIA_ENCUESTA"]
MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]


def _leer(modulo: str) -> pd.DataFrame:
    z = zipfile.ZipFile(descargar(EMICRON_2024[modulo], f"emicron2024_{modulo}.zip"))
    nombre = next(n for n in z.namelist() if n.lower().endswith(".csv"))
    return pd.read_csv(io.BytesIO(z.read(nombre)), encoding="latin-1", low_memory=False)


def micronegocios_comercio(area: int | None = 11) -> pd.DataFrame:
    """Una fila por micronegocio de comercio con las variables que usa TendIA."""
    ident = _leer("identificacion")
    ventas = _leer("ventas")
    carac = _leer("caracteristicas")
    incl = _leer("inclusion")

    df = ident[LLAVE + ["AREA", "GRUPOS12", "P3034", "F_EXP"]]
    df = df.merge(
        ventas[LLAVE + ["VENTAS_MES_ANTERIOR"] + [f"P3068_{m}" for m in MESES] + ["P3068_TOD"]],
        on=LLAVE,
    )
    df = df.merge(carac[LLAVE + ["P640"]], on=LLAVE)
    df = df.merge(
        incl[LLAVE + ["P1764_3", "P1764_5", "P1764_6", "P1765", "P1568", "P1569"]], on=LLAVE
    )

    df["AREA"] = pd.to_numeric(df["AREA"], errors="coerce")
    df["GRUPOS12"] = pd.to_numeric(df["GRUPOS12"], errors="coerce")
    df = df[df["GRUPOS12"] == 5]
    if area is not None:
        df = df[df["AREA"] == area]

    out = pd.DataFrame(index=df.index)
    out["ventas_mes"] = pd.to_numeric(df["VENTAS_MES_ANTERIOR"], errors="coerce")
    meses = (
        df[[f"P3068_{m}" for m in MESES]].apply(pd.to_numeric, errors="coerce").eq(1).sum(axis=1)
    )
    todo = pd.to_numeric(df["P3068_TOD"], errors="coerce").eq(1)
    out["meses_activos"] = np.where(todo, 12, meses).astype(float)
    out["antiguedad_meses"] = pd.to_numeric(df["P3034"], errors="coerce")
    p640 = pd.to_numeric(df["P640"], errors="coerce")
    out["lleva_registros"] = p640.between(1, 4).astype(float)
    out["usa_cuaderno"] = p640.eq(3).astype(float)
    digital = df[["P1764_3", "P1764_5", "P1764_6"]].apply(pd.to_numeric, errors="coerce").eq(1)
    out["pagos_digitales"] = digital.any(axis=1).astype(float)
    out["pidio_credito"] = pd.to_numeric(df["P1765"], errors="coerce").eq(1).astype(float)
    out["obtuvo_credito"] = pd.to_numeric(df["P1568"], errors="coerce").eq(1).astype(float)
    out["gota_a_gota"] = pd.to_numeric(df["P1569"], errors="coerce").eq(5).astype(float)
    out["peso"] = pd.to_numeric(df["F_EXP"], errors="coerce").fillna(1.0)

    out = out[(out["ventas_mes"] > 0) & out["antiguedad_meses"].notna()]
    out.loc[out["meses_activos"] == 0, "meses_activos"] = 12.0
    return out.reset_index(drop=True)
