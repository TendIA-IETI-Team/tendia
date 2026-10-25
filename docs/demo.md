# Guion de la demo (TND-082)

Duración: **5 minutos 45 segundos**, con 15 segundos de margen para preguntas rápidas. Se puede hacer en staging (sin instalar nada) o en local con `docker compose up --build`.

| Ambiente         | Portal                             | API y documentación                  | App                                                               |
| ---------------- | ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Staging (Render) | https://tendia-portal.onrender.com | https://tendia-api.onrender.com/docs | Expo Go con `EXPO_PUBLIC_API_URL=https://tendia-api.onrender.com` |
| Local            | http://localhost:3000              | http://localhost:4000/docs           | Expo Go o `npm run web` en `apps/mobile`                          |

**Datos de demo en staging:** con `SEED_ON_START=true` (en `render.yaml`), la API carga al arrancar los aliados Banco Demo Popular y Microcrédito Demo, sus analistas y el usuario `admin@tendia.co`. Los celulares `300 000 0001` a `300 000 0004` tienen perfiles fijos y ven el código en pantalla aunque Twilio esté configurado. Si los servicios están en el plan gratis de Render, se duermen tras 15 minutos sin uso: abre el portal y `/health` 2 minutos antes de empezar.

## Flujo feliz y de garantía

| Min  | Quién      | Qué se muestra                                                                                                                                                         | Mensaje                                                      |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 0:00 | Sarria     | El problema: menos del 15 % de las microempresas acceden a crédito formal; el 9,6 % de las tiendas de Bogotá que pidieron crédito acudió al gota a gota (EMICRON 2024) | Las tiendas venden todos los días, pero el sistema no las ve |
| 0:40 | Juan       | App con `300 000 0002`: pedir $3.000.000 (T1) y autorizar datáfono y proveedor (T2)                                                                                    | Consentimiento por fuente, con finalidad, revocable          |
| 1:20 | Juan       | Puntaje sobre 1000 con su franja, segmento real del DANE y tasa de referencia de la Superfinanciera (T7)                                                               | No es DataCrédito; TendIA no presta                          |
| 1:50 | Juan       | Justificar enero con "Obras en la calle" y una foto como evidencia (T8): el puntaje se recalcula                                                                       | El tendero cuenta su historia y la respalda                  |
| 2:20 | Villadiego | "Hablar con Tendi": "hoy vendí 350 mil y le fié 20 mil a don Pedro". Luego "Mi cuaderno", foto de una hoja: Claude la lee y se confirma                                | IA generativa útil para el tendero, sin teclear              |
| 3:00 | Juan       | Enviar al Banco Demo Popular (T9)                                                                                                                                      | El tendero decide con quién compartir                        |
| 3:15 | Cristian   | Portal con MFA: bandeja con recomendación según la política (A1)                                                                                                       | Riesgo explicado en segundos, no en 15 días                  |
| 3:45 | Villadiego | Detalle: qué pesó, enero resaltado con su evidencia, indicadores, tasa de mercado; model card                                                                          | Modelo interpretable y auditable (SARC)                      |
| 4:20 | Cristian   | Pedir garantía (A2). En la app aparece el aviso; el tendero responde y adjunta el PDF (T10). Aceptar con plazo y tasa (A3, A4)                                         | Flujo completo hasta la aprobación                           |
| 5:00 | Andersson  | `admin@tendia.co`: bitácora del tendero con quién vio sus datos y para qué; CI en verde y `/docs` de la API pública                                                    | Habeas data demostrable y listo para integrarse              |
| 5:45 | —          | Cierre                                                                                                                                                                 |                                                              |

## Respaldo

- Si falla internet, todo corre local con Docker.
- Graba el flujo completo el día anterior por si algo falla en vivo.
- `300 000 0003` muestra un rechazo con consejos para mejorar; úsalo si preguntan qué pasa cuando no se aprueba.
- Sin `ANTHROPIC_API_KEY`, Tendi responde con reglas y la explicación usa una plantilla: la demo no se cae.
- Las pruebas automáticas reinician el MFA de `admin@bancodemo.co`. Si el código no funciona, `docker compose exec api node dist/scripts/reset-mfa.js admin@bancodemo.co` y escanea el QR de nuevo.
