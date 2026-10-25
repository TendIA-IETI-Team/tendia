# Model card: tendia-v2

> **Qué es real y qué no.** El componente de pagos se entrena con **30.000 créditos reales** (UCI #350). La segmentación y las referencias de mercado salen de **microdatos oficiales colombianos** (DANE EMICRON 2024 y Superfinanciera). El componente de negocio todavía se entrena con datos **sintéticos calibrados** con EMICRON, porque no existe un dataset abierto de tenderos con su historia de pago. Las métricas de cada parte se reportan por separado, sin mezclarlas.

|                  |                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Modelo           | Dos scorecards (WoE + regresión logística) sumados en ln-odds, más una segmentación KMeans                                                 |
| Versión          | `tendia-v2` (contrato `/score` v2), entrenado el 25 oct 2026                                                                               |
| Archivo          | [`services/scoring/tendia_scoring/model/tendia-v2.json`](../services/scoring/tendia_scoring/model/tendia-v2.json): JSON legible, no pickle |
| Objetivo         | Incumplimiento: mora del mes siguiente (UCI) y mora mayor a 30 días en 90 días (sintéticos)                                                |
| Uso previsto     | Apoyar, no reemplazar, la decisión de crédito de un analista para tiendas de barrio en Bogotá                                              |
| Fuera de alcance | Decisiones automáticas sin humano; segmentos distintos de tiendas y minimercados                                                           |
| Fuentes          | [docs/datos.md](datos.md)                                                                                                                  |

## Cómo se arma el puntaje

```
ln_odds_buen_pago = l0 + Σ_componentes peso_c · Σ_variables −coef · (WoE − WoE promedio)
puntaje           = 303 + 142 · ln_odds_buen_pago      (recortado a 0-1000)
```

`l0 = ln(9)`: un negocio promedio tiene 10 % de probabilidad de incumplir y queda en 615 puntos. Cada componente solo suma si hay datos para él; sin historia de pago con el distribuidor el puntaje se basa en el negocio.

| Componente | Peso | Variables                                                                                              | Entrenado con                          |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `pagos`    | 1,0  | meses al día, máximo de meses en mora, proporción pagada, uso del cupo, tendencia de compras (6 meses) | UCI #350, 30.000 créditos reales       |
| `negocio`  | 0,5  | ventas promedio, inestabilidad, tendencia, meses flojos, compras/ventas, antigüedad                    | Sintéticos calibrados con EMICRON 2024 |

El distribuidor da exactamente lo que UCI mide para una tarjeta: factura del mes, lo que se pagó y el cupo. Por eso el componente de pagos se puede entrenar con datos reales y aplicar a los tenderos con la misma definición de variable.

## Desempeño

| Parte                       | Datos                 | Muestra                       | AUC           | Gini      | KS    |
| --------------------------- | --------------------- | ----------------------------- | ------------- | --------- | ----- |
| **Pagos (scorecard)**       | **UCI, reales**       | **holdout 30 % (9.000)**      | **0,741**     | **0,482** | 0,407 |
| Pagos (scorecard)           | UCI, reales           | validación cruzada 5 pliegues | 0,743 ± 0,007 |           |       |
| Retador: stacking LR+HGB+RF | UCI, reales           | holdout 30 %                  | 0,763         | 0,526     | 0,418 |
| Negocio (scorecard)         | Sintéticos calibrados | fuera de tiempo (3.000)       | 0,734         | 0,468     | 0,365 |
| Combinado                   | Sintéticos            | 12.000                        | 0,746         | 0,492     | 0,377 |

El retador de stacking gana 0,04 de Gini pero **no se adopta** (TND-046): no se puede explicar variable por variable, y el tendero y el analista tienen que ver por qué salió su puntaje (requisito SARC de la Superfinanciera).

## Franjas (0-1000)

En la prueba de usabilidad doña Gloria entendió mejor tres franjas con color que cinco niveles; la escala 0-1000 se acompaña siempre del nombre de la franja para no confundirla con DataCrédito.

| Franja | Puntaje  | Incumplimiento esperado | Negocios (sintéticos) | Incumplimiento observado (sintéticos) |
| ------ | -------- | ----------------------- | --------------------- | ------------------------------------- |
| Bajo   | 0-499    | más de 20 %             | 24 %                  | 32 %                                  |
| Medio  | 500-649  | 8 % a 20 %              | 24 %                  | 15 %                                  |
| Bueno  | 650-1000 | menos de 8 %            | 52 %                  | 6 %                                   |

La política por defecto de un aliado aprueba desde 650 y pide garantía entre 500 y 649.

## Segmentación (datos reales)

KMeans (k = 4) sobre 20.488 micronegocios de comercio de EMICRON 2024 (ventas, antigüedad, registros, pagos digitales, local fijo; las binarias pesan la mitad). Cada segmento muestra estadísticas reales, no del modelo:

| Segmento     | Negocios | Ventas típicas/mes | Antigüedad típica | Pidió crédito | Acudió al gota a gota |
| ------------ | -------- | ------------------ | ----------------- | ------------- | --------------------- |
| Consolidada  | 22,9 %   | $7.500.000         | 12 años           | 25,2 %        | 4,0 %                 |
| Tradicional  | 31,9 %   | $1.400.000         | 14 años           | 13,8 %        | 5,1 %                 |
| Joven        | 26,3 %   | $2.700.000         | 2,4 años          | 17,7 %        | 2,7 %                 |
| Subsistencia | 18,8 %   | $600.000           | 2 años            | 8,8 %         | 2,4 %                 |

El segmento contextualiza; **no entra al puntaje**.

## Explicabilidad

Cada variable aporta `142 · peso_c · −coef · (WoE − WoE promedio)` puntos frente a un negocio promedio, y la respuesta dice de qué componente viene. La suma de los aportes más la base da el puntaje: la explicación es exacta. La IA generativa (Claude) solo pone esos aportes en palabras sencillas; nunca calcula ni cambia el puntaje, y si no está disponible se usa una plantilla.

## Riesgos y límites

- **Transferencia de dominio:** UCI son tarjetas de crédito en Taiwán (2005). La definición de variable es la misma, pero la relación con la mora puede cambiar en tenderos de Bogotá. El primer piloto con un distribuidor debe recalibrar con su historia real.
- **Componente de negocio sintético:** las distribuciones vienen de EMICRON, pero la relación ventas → mora es un supuesto. Por eso pesa la mitad.
- **Sesgo:** el modelo no usa género, edad ni ubicación exacta. EMICRON trae sexo del propietario: con datos reales hay que medir si alguna variable actúa como sustituto.
- **Variaciones justificadas:** el tendero puede excluir meses de la estabilidad. El aliado ve los dos puntajes y el motivo.
- **Deriva:** recalcular las métricas cada trimestre; reentrenar si el Gini baja más de 0,05.

Reentrenar: `cd services/scoring && uv run python -m tendia_scoring.datos.preparar && uv run python -m tendia_scoring.train`.
