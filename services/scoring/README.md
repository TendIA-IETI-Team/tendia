# services/scoring

Motor de scoring de TendIA: convierte series mensuales de ventas y pagos al distribuidor en un **Puntaje TendIA (0-1000)** en tres franjas, con su segmento y con la contribución de cada variable. No guarda estado ni datos personales.

```bash
uv sync
uv run uvicorn tendia_scoring.app:app --port 8000   # http://localhost:8000/docs
uv run pytest                                       # pruebas + cobertura ≥ 70 %
uv run python -m tendia_scoring.datos.preparar      # descarga UCI, EMICRON y Superfinanciera (a .cache)
uv run python -m tendia_scoring.train               # reentrena y regenera model/tendia-v2.json
```

| Archivo | Qué hace |
| --- | --- |
| `schemas.py` | Contrato v2 de `/score` (campos extra → 422) |
| `features.py` | Variables, suficiencia y cruce de fuentes (TND-042, TND-033) |
| `scorecard.py` | WoE + regresión logística, dos componentes, escala 0-1000 y contribuciones (TND-043) |
| `pagos.py` | Variables de historia de pago, iguales para UCI y el distribuidor |
| `segmentos.py` | Segmentación KMeans con EMICRON |
| `datos/` | Descarga y preparación de las fuentes reales ([docs/datos.md](../../docs/datos.md)) |
| `synthetic.py` | Datos sintéticos de tiendas calibrados con EMICRON (TND-041) |
| `train.py` | Entrenamiento, validación fuera de tiempo y retador de boosting (TND-046) |
| `app.py` | `GET /health`, `GET /model`, `GET /referencias`, `POST /score` (TND-044) |

Métricas y límites en [docs/model-card.md](../../docs/model-card.md).
