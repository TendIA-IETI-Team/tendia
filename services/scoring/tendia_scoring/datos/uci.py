"""UCI #350 "Default of Credit Card Clients" (Yeh, I. 2009. DOI 10.24432/C55S3H, CC BY 4.0).

30.000 créditos reales (Taiwán, abr-sep 2005). Para cada cliente: cupo (LIMIT_BAL), 6 meses de
estado de pago (PAY_0, PAY_2..PAY_6: -2/-1/0 = al día, 1..8 = meses de mora), lo facturado
(BILL_AMT1..6) y lo pagado (PAY_AMT1..6), y si incumplió el mes siguiente.

Esa estructura es la misma relación que tiene un tendero con su distribuidor: compra a crédito
(factura), tiene un cupo, paga a tiempo o con días de mora. Por eso entrenamos con estos datos
reales el componente de comportamiento de pago del modelo.
"""

from __future__ import annotations

import io
import zipfile

import pandas as pd

from ..pagos import MesPago, variables_pago
from .fuentes import UCI_CREDIT_DEFAULT, descargar

# PAY_0 es el mes más reciente (sep) y PAY_6 el más antiguo (abr). PAY_AMTk paga BILL_AMT(k+1).
_ESTADO = ["PAY_6", "PAY_5", "PAY_4", "PAY_3", "PAY_2", "PAY_0"]
_FACTURA = ["BILL_AMT6", "BILL_AMT5", "BILL_AMT4", "BILL_AMT3", "BILL_AMT2", "BILL_AMT1"]
_PAGO = [None, "PAY_AMT5", "PAY_AMT4", "PAY_AMT3", "PAY_AMT2", "PAY_AMT1"]


def cargar() -> pd.DataFrame:
    z = zipfile.ZipFile(descargar(UCI_CREDIT_DEFAULT, "uci350.zip"))
    nombre = next(n for n in z.namelist() if n.endswith(".xls"))
    df = pd.read_excel(io.BytesIO(z.read(nombre)), header=1, engine="xlrd")
    return df.rename(columns={"default payment next month": "DEFAULT"})


def historial(row: pd.Series) -> list[MesPago]:
    """Convierte una fila UCI en 6 meses de relación de crédito con un proveedor."""
    meses = []
    for estado, factura, pago in zip(_ESTADO, _FACTURA, _PAGO, strict=True):
        meses.append(
            MesPago(
                facturado=max(float(row[factura]), 0.0),
                pagado=None if pago is None else max(float(row[pago]), 0.0),
                meses_mora=max(int(row[estado]), 0),
                cupo=float(row["LIMIT_BAL"]),
            )
        )
    return meses


def dataset() -> tuple[list[dict[str, float]], list[int]]:
    df = cargar()
    filas = [variables_pago(historial(r)) for _, r in df.iterrows()]
    return filas, df["DEFAULT"].astype(int).tolist()
