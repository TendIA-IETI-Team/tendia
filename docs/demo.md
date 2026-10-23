# Guion de la demo (TND-082)

Duración: 7 minutos. Necesitas `docker compose up --build` corriendo, el portal en el portátil y la app en un celular con Expo Go.

| Min  | Quién      | Qué se muestra                                                                                                                | Mensaje                                                      |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 0:00 | Sarria     | El problema: menos del 15 % de las microempresas acceden a crédito formal y el gota a gota cobra entre 382 % y 666 % al año   | Las tiendas venden todos los días, pero el sistema no las ve |
| 1:00 | Juan       | App con el celular `300 000 0002`: pedir $3.000.000 para surtir (T1) y autorizar datáfono y proveedor en lenguaje simple (T2) | Consentimiento por fuente, revocable                         |
| 2:00 | Juan       | Espera (T4/T6) → Puntaje TendIA con su escala y explicación (T7)                                                              | No es DataCrédito; TendIA no presta                          |
| 3:00 | Juan       | Justificar enero: "Obras en la calle" (T8) → el puntaje se recalcula                                                          | El tendero puede contar su historia                          |
| 3:45 | Juan       | Enviar al Banco Demo Popular (T9): ahora ve quién revisa                                                                      | El tendero decide con quién compartir                        |
| 4:15 | Cristian   | Portal: ingreso con MFA, bandeja con sugerencia por política (A1)                                                             | Riesgo explicado en segundos, no en 15 días                  |
| 5:00 | Villadiego | Detalle: qué pesó, enero resaltado, puntaje antes y después; model card                                                       | Modelo interpretable y auditable (SARC)                      |
| 5:45 | Cristian   | Pedir garantía FNG (A2) → el tendero responde (T10) → aceptar (A3)                                                            | Flujo completo hasta la aprobación                           |
| 6:30 | Andersson  | CI en verde, pruebas, `/docs` de la API pública y consumo por aliado                                                          | Listo para integrarse como score-as-a-service                |

## Respaldo

- Si falla el internet, todo corre local con Docker.
- Graba el flujo completo el día anterior por si algo falla en vivo.
- El celular `300 000 0003` muestra un rechazo con consejos para mejorar; úsalo si preguntan qué pasa cuando no se aprueba.
