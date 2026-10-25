import pandas as pd

from tendia_scoring.datos import uci
from tendia_scoring.pagos import MesPago, mora_en_meses, variables_pago


def test_mora_en_meses():
    assert mora_en_meses(0) == 0
    assert mora_en_meses(1) == 1
    assert mora_en_meses(30) == 1
    assert mora_en_meses(31) == 2


def test_pagador_puntual_y_completo():
    meses = [MesPago(facturado=100, pagado=100, meses_mora=0, cupo=400) for _ in range(6)]
    v = variables_pago(meses)
    assert v["pago_meses_al_dia"] == 1
    assert v["pago_max_meses_mora"] == 0
    assert v["pago_proporcion_pagada"] == 1
    assert v["pago_uso_cupo"] == 0.25
    assert v["pago_tendencia_compras"] == 0


def test_sin_datos_de_pago_ni_cupo_usa_aproximaciones():
    meses = [
        MesPago(facturado=100, pagado=None, meses_mora=m, cupo=None) for m in (0, 0, 1, 0, 0, 0)
    ]
    v = variables_pago(meses)
    assert v["pago_proporcion_pagada"] == v["pago_meses_al_dia"]
    assert v["pago_uso_cupo"] == 0.5


def test_fila_uci_se_traduce_al_historial_con_el_proveedor():
    fila = pd.Series(
        {
            "LIMIT_BAL": 1000,
            **{f"PAY_{k}": v for k, v in zip([0, 2, 3, 4, 5, 6], [2, 0, -1, 0, 0, 0], strict=True)},
            **{f"BILL_AMT{k}": 200 for k in range(1, 7)},
            **{f"PAY_AMT{k}": 100 for k in range(1, 7)},
        }
    )
    meses = uci.historial(fila)
    assert len(meses) == 6
    assert meses[-1].meses_mora == 2  # PAY_0 es el mes más reciente
    assert meses[0].pagado is None
    v = variables_pago(meses)
    assert v["pago_meses_al_dia"] == 5 / 6
    assert v["pago_proporcion_pagada"] == 0.5
    assert v["pago_uso_cupo"] == 0.2
