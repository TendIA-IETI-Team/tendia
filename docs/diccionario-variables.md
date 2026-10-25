# Variable objetivo y diccionario de variables (TND-040)

Qué predice el modelo `tendia-v2`, con qué variables, de qué fuente sale cada una y si el tendero la reporta. El código que calcula las variables es el mismo para entrenar y para servir (`services/scoring/tendia_scoring/features.py` y `pagos.py`).

## Variable objetivo

|                                        | Definición                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objetivo de negocio**                | Que el tendero **no pague 90 días o más** una obligación de crédito en los 12 meses siguientes al puntaje (mora ≥ 90 días, la definición de incumplimiento del SARC de la Superfinanciera para microcrédito y crédito productivo).                                                                                   |
| **Ventana de observación**             | Los 12 meses cerrados antes de la solicitud (`VENTANA_MESES = 12`). Mínimo 6 meses de ventas y 3 de relación con el proveedor; con menos, el puntaje no se calcula y la app pide completar datos (T5).                                                                                                               |
| **Ventana de desempeño**               | 12 meses después del puntaje.                                                                                                                                                                                                                                                                                        |
| **Etiqueta con la que se entrenó hoy** | No hay datos abiertos con mora a 90 días de tenderos colombianos, así que cada componente usa la mejor etiqueta disponible: **pagos**, incumplimiento del mes siguiente en UCI #350 (tarjetas, 30.000 créditos reales); **negocio**, mora mayor a 30 días en 90 días en los datos sintéticos calibrados con EMICRON. |
| **Plan para cerrar la brecha**         | Con el primer aliado o distribuidor del piloto, reetiquetar con su historia real de mora ≥ 90 días y recalibrar el intercepto y las franjas (ver [model-card.md](model-card.md#riesgos-y-límites)).                                                                                                                  |

Una mora corta es una señal temprana de la larga, y ordena a los negocios de forma parecida. Por eso los puntajes se pueden usar como ranking desde hoy, pero las probabilidades absolutas se deben recalibrar con datos del piloto antes de usarlas para provisiones.

## Variables del puntaje

**Auto-reportada** quiere decir que el tendero la escribe o la cuenta (app, Tendi, WhatsApp o foto del cuaderno), en vez de venir de un tercero. Esos datos pesan menos: el datáfono y Open Finance tienen prioridad sobre lo declarado (`SOURCE_PRIORITY`), y una diferencia de más del 50 % entre lo declarado y lo registrado genera la alerta `ventas_declaradas_no_coinciden`.

### Componente de negocio (peso 0,5)

| Variable              | Qué mide                  | Cálculo                                                         | Fuente                              | Auto-reportada                          |
| --------------------- | ------------------------- | --------------------------------------------------------------- | ----------------------------------- | --------------------------------------- |
| `avg_sales`           | Ventas promedio al mes    | Promedio de las ventas mensuales de la ventana                  | Datáfono > Open Finance > declarado | Solo si no hay datáfono ni Open Finance |
| `sales_cv`            | Estabilidad de las ventas | Desviación estándar / promedio, sin los meses justificados (T8) | Igual que `avg_sales`               | Igual                                   |
| `sales_trend`         | Tendencia reciente        | (promedio últimos 3 meses − 3 anteriores) / 3 anteriores        | Igual                               | Igual                                   |
| `low_months_ratio`    | Meses muy flojos          | Proporción de meses por debajo de la mitad de la mediana        | Igual                               | Igual                                   |
| `purchases_to_sales`  | Compras frente a ventas   | Compras al proveedor / ventas, en los meses que coinciden       | Distribuidor + ventas               | No                                      |
| `business_age_months` | Antigüedad                | Meses desde que abrió el negocio                                | Lo cuenta el tendero (perfil)       | **Sí**                                  |

### Componente de pagos (peso 1,0)

| Variable                 | Qué mide                      | Cálculo                                        | Fuente       | Auto-reportada |
| ------------------------ | ----------------------------- | ---------------------------------------------- | ------------ | -------------- |
| `pago_meses_al_dia`      | Puntualidad                   | Proporción de meses sin facturas atrasadas     | Distribuidor | No             |
| `pago_max_meses_mora`    | Peor atraso                   | Máximo de meses en mora (días de retraso / 30) | Distribuidor | No             |
| `pago_proporcion_pagada` | Cuánto paga de lo que le fían | Pagado / facturado el mes anterior             | Distribuidor | No             |
| `pago_uso_cupo`          | Uso del cupo                  | Compras / cupo del proveedor                   | Distribuidor | No             |
| `pago_tendencia_compras` | Cómo vienen sus compras       | Tendencia de las compras de 6 meses            | Distribuidor | No             |

Cada variable se agrupa en tramos y se transforma con WoE (weight of evidence). El aporte en puntos de cada una se explica en [model-card.md](model-card.md#explicabilidad).

## Indicadores del negocio (no entran al puntaje)

Contexto para el analista en el portal (TND-042). Se calculan con el mismo código que las variables, pero el modelo no los usa.

| Indicador                  | Qué mide                | Cálculo                                            | Fuente                |
| -------------------------- | ----------------------- | -------------------------------------------------- | --------------------- |
| `avg_ticket`               | Ticket promedio         | Ventas con datáfono / número de transacciones      | Datáfono              |
| `repurchase_regularity`    | Regularidad de recompra | Meses con compras al proveedor / meses de relación | Distribuidor          |
| `days_between_purchases`   | Frecuencia de recompra  | 30 × meses / facturas del proveedor                | Distribuidor          |
| `sales_per_peso_purchased` | Rotación                | Ventas / compras al proveedor                      | Ventas + distribuidor |
| `seasonality`              | Estacionalidad          | 1 − (mes más flojo / mediana)                      | Ventas                |

## Datos que no usa el modelo

Género, edad, ubicación exacta, cédula y celular. EMICRON trae el sexo del propietario: se usa solo para medir sesgo, nunca como variable.

## Calidad de datos

| Código                           | Cuándo                                            | Efecto                                     |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| `pocas_ventas`                   | Menos de 6 meses de ventas                        | No hay puntaje; la app pide completar (T5) |
| `pocos_pagos_proveedor`          | Menos de 3 meses con el distribuidor              | No hay puntaje; la app pide completar (T5) |
| `falta_antiguedad`               | El tendero no dijo la antigüedad                  | No hay puntaje hasta que la diga           |
| `ventas_declaradas_no_coinciden` | Lo declarado difiere más de 50 % de lo registrado | Alerta para el analista                    |
| `compras_mayores_que_ventas`     | Compras > 120 % de las ventas                     | Alerta para el analista                    |
| `compras_muy_bajas`              | Compras < 30 % de las ventas                      | Alerta para el analista                    |
