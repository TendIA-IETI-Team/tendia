# Datos reales que usa TendIA

TendIA usa tres fuentes abiertas. Los archivos crudos se descargan a `services/scoring/.cache` (ignorado por git) y en el repo solo se versionan los agregados derivados y el modelo entrenado. Ninguna fuente tiene datos personales identificables.

| Fuente                                                                                                                                                                   | Qué trae                                                                                                     | Para qué lo usamos                                                                         | Licencia                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| [UCI #350 Default of Credit Card Clients](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients) (Yeh y Lien, 2009)                                     | 30.000 créditos reales con 6 meses de factura, pago, cupo, estado de mora y si incumplieron el mes siguiente | Entrenar el componente de **pagos** del puntaje                                            | CC BY 4.0                          |
| [DANE, Encuesta de Micronegocios (EMICRON) 2024](https://microdatos.dane.gov.co/index.php/catalog/875) (también en [datos.gov.co](https://www.datos.gov.co/d/7fku-rfe7)) | Microdatos de micronegocios: ventas, antigüedad, registros contables, pagos digitales, crédito y gota a gota | **Segmentación** de negocios, calibración de los datos sintéticos y referencias del sector | Uso libre con cita del DANE        |
| [Superfinanciera, Tasas de interés activas por tipo de crédito](https://www.datos.gov.co/d/w9zh-vetq)                                                                    | Cada semana, créditos desembolsados por entidad, tipo, actividad económica (CIIU) y municipio, con su tasa   | **Tasa de referencia del mercado** que ve el aliado al aprobar y el tendero en su puntaje  | Datos abiertos, uso libre con cita |

## Cómo se procesan

```bash
cd services/scoring
uv run python -m tendia_scoring.datos.preparar   # descarga y genera model/referencias/*.json
uv run python -m tendia_scoring.train            # reentrena y genera model/tendia-v2.json
```

### UCI → componente de pagos

El distribuidor de un tendero reporta cada mes lo mismo que un banco para una tarjeta: lo facturado (`BILL_AMT`), lo pagado (`PAY_AMT`), el cupo (`LIMIT_BAL`) y los meses de atraso (`PAY_0..6`). `datos/uci.py` convierte cada crédito a la misma estructura `MesPago` que usa la API con los datos del distribuidor, y `pagos.py` calcula las cinco variables con el mismo código en entrenamiento y en producción. Holdout 30 %: AUC 0,741.

### EMICRON → segmentos y referencias

`datos/emicron.py` une los módulos de ventas, identificación, características e inclusión financiera por `DIRECTORIO`, `SECUENCIA_P` y `SECUENCIA_ENCUESTA`, y filtra comercio (`GRUPOS12 = 05`). Todos los porcentajes y medianas usan el factor de expansión `F_EXP`.

- **Nacional (20.488 micronegocios de comercio):** KMeans de 4 segmentos (consolidada, tradicional, joven, subsistencia). Ver [model-card.md](model-card.md#segmentación-datos-reales).
- **Bogotá (`AREA = 11`, 570 encuestados, 178.406 negocios representados):** ventas típicas de $3.000.000 al mes (p25 $1,4 M, p75 $5,5 M), 49,5 % anota en cuaderno, 73,9 % acepta pagos digitales. De los que pidieron crédito, 9,6 % acudió al gota a gota. Estas cifras calibran `synthetic.py` y los perfiles simulados de los conectores.

### Superfinanciera → tasas de referencia

`datos/sfc.py` consulta la API Socrata con `tipo_de_cr_dito like '%productivo%'` (la categoría que reemplazó al microcrédito), CIIU 4711 (tiendas y minimercados) y Bogotá (`codigo_municipio = 11001`), de los últimos 12 meses. Calcula percentiles ponderados por número de créditos:

|                                             | p25    | Mediana | p75    |
| ------------------------------------------- | ------ | ------- | ------ |
| Todos (5.992 créditos, ago 2025 - jul 2026) | 48,8 % | 61,9 %  | 65,5 % |

La API usa p25 para la franja buena, la mediana para la media y p75 para la baja. Es una **referencia**, no una oferta: el aliado define la tasa al aprobar.

## Qué sigue siendo sintético y por qué

No existe un dataset abierto que una ventas de tenderos con su historia de pago. Por eso el componente de **negocio** se entrena con datos sintéticos cuyas distribuciones (ventas, estacionalidad, antigüedad, pagos) se calibraron con EMICRON y UCI, y pesa la mitad que el de pagos. Los conectores de datáfono, distribuidor y Open Finance siguen simulados hasta firmar un convenio; los perfiles simulados usan las mismas distribuciones reales.
