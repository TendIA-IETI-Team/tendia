# Model card: scorecard-v1

> **Todas las métricas de esta página salen de datos sintéticos.** Sirven para validar el pipeline, no para afirmar el desempeño con tenderos reales. No se deben presentar como resultados reales.

|                  |                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modelo           | Regresión logística sobre WoE (scorecard), 8 variables                                                                                           |
| Versión          | `scorecard-v1`, entrenado el 23 oct 2026                                                                                                         |
| Archivo          | [`services/scoring/tendia_scoring/model/scorecard-v1.json`](../services/scoring/tendia_scoring/model/scorecard-v1.json): JSON legible, no pickle |
| Objetivo         | Mora mayor a 30 días dentro de los 90 días siguientes                                                                                            |
| Uso previsto     | Apoyar, no reemplazar, la decisión de crédito de un analista para tiendas de barrio en Bogotá                                                    |
| Fuera de alcance | Decisiones automáticas sin humano; segmentos distintos de tiendas y minimercados                                                                 |

## Variables

| Variable              | Qué mide                                                            | Fuente                        |
| --------------------- | ------------------------------------------------------------------- | ----------------------------- |
| `avg_sales`           | Ventas promedio al mes                                              | Datáfono > banco > declaradas |
| `sales_cv`            | Inestabilidad de ventas (sin meses justificados)                    | Ídem                          |
| `sales_trend`         | Cambio de los últimos 3 meses frente a los 3 anteriores             | Ídem                          |
| `low_months_ratio`    | Proporción de meses con ventas por debajo de la mitad de la mediana | Ídem                          |
| `on_time_ratio`       | Facturas pagadas a tiempo al distribuidor                           | Distribuidor                  |
| `avg_days_late`       | Días promedio de retraso en facturas tardías                        | Distribuidor                  |
| `purchases_to_sales`  | Compras al distribuidor sobre ventas                                | Cruce de fuentes              |
| `business_age_months` | Antigüedad del negocio                                              | Tendero                       |

## Desempeño

Se entrena con las cohortes de ene 2024 a jun 2025, dejando aparte un 20 % al azar de ese periodo (fuera de muestra). La validación fuera de tiempo usa las cohortes de jul a dic 2025.

| Modelo                     | Muestra             | AUC       | Gini      | KS        | n         |
| -------------------------- | ------------------- | --------- | --------- | --------- | --------- |
| Baseline scorecard         | Entrenamiento       | 0,758     | 0,516     | 0,395     | 7.186     |
| Baseline scorecard         | Fuera de muestra    | 0,809     | 0,618     | 0,512     | 1.814     |
| **Baseline scorecard**     | **Fuera de tiempo** | **0,756** | **0,511** | **0,420** | **3.000** |
| Retador: gradient boosting | Fuera de tiempo     | 0,753     | 0,505     | 0,387     | 3.000     |

El retador **no se adopta** (TND-046): no supera al baseline fuera de tiempo y es menos interpretable. Una regla de entrenamiento lo adopta solo si supera al baseline por más de 0,02 de Gini.

## Escala del Puntaje TendIA

50 puntos equivalen a odds de pago de 9:1 (10 % de incumplimiento), y cada vez que se duplican las odds se suman 10 puntos. Rango de 0 a 100.

| Nivel           | Puntaje | Negocios (muestra sintética de 6.000, semilla 99) | Incumplimiento observado |
| --------------- | ------- | ------------------------------------------------- | ------------------------ |
| En construcción | 0-29    | 979                                               | 39,8 %                   |
| Básico          | 30-44   | 1.471                                             | 20,4 %                   |
| Bueno           | 45-59   | 1.852                                             | 9,0 %                    |
| Muy bueno       | 60-71   | 1.508                                             | 3,2 %                    |
| Excelente       | 72-100  | 190                                               | 0,5 %                    |

El incumplimiento baja en cada nivel, así que la escala ordena bien el riesgo.

La escala no se parece a la de DataCrédito (150-950) a propósito: en la prueba de usabilidad, doña Gloria confundió un "720" con su puntaje de DataCrédito.

## Explicabilidad

Cada variable aporta `−(10/ln 2) · coef · (WoE − WoE promedio)` puntos frente a un negocio promedio. La suma de los aportes más la base da el puntaje, así que la explicación es exacta, no aproximada. La IA generativa solo pone esos aportes en palabras sencillas y nunca calcula ni cambia el puntaje.

## Riesgos y límites

- **Datos sintéticos:** el siguiente paso es recalibrar con historia real de un distribuidor aliado.
- **Sesgo:** el modelo no usa género, edad ni ubicación exacta. Hay que medir con datos reales si alguna variable actúa como sustituto de ellas.
- **Variaciones justificadas:** el tendero puede excluir meses de la estabilidad. El aliado ve los dos puntajes y el motivo, y una justificación abusiva queda a la vista.
- **Deriva:** recalcular las métricas fuera de tiempo cada trimestre; reentrenar si el Gini baja más de 0,05.
