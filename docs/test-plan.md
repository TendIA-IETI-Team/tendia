# Plan de pruebas

**Meta:** entregar con confianza. Cada PR corre en CI las pruebas de las piezas que tocó, y no se fusiona si fallan o si la cobertura de API o scoring baja de 70 %.

## Pirámide

| Nivel       | Dónde                                             | Herramienta                                  | Qué valida                                                                                                                                                                      |
| ----------- | ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarias   | `services/scoring/tests`                          | pytest                                       | Variables, validación de suficiencia y consistencia, escala de puntos, WoE                                                                                                      |
| Unitarias   | `services/api/src/**/*.spec.ts`                   | Jest                                         | Cifrado, política, conectores (autorizar, recolectar, estado), IA y asistente (cliente simulado), OTP con Twilio Verify (fetch simulado), avisos por WhatsApp, filtro de Sentry |
| Unitarias   | `apps/portal/src/**/*.test.ts`, `packages/tokens` | Vitest, `node:test`                          | Formatos y contraste WCAG de la paleta                                                                                                                                          |
| Integración | `services/api/test/flujo.e2e-spec.ts`             | Jest + Supertest + Postgres + scoring reales | Flujo T1 → T13, aislamiento entre aliados y tenderos, revocación (Ley 1581), API pública y consumo                                                                              |
| Integración | `services/api/test/asistente.e2e-spec.ts`         | Jest + Supertest                             | Tendi por la app y WhatsApp (firma de Twilio), cuaderno con foto                                                                                                                |
| Integración | `services/api/test/cierre.e2e-spec.ts`            | Jest + Supertest + Postgres                  | Adjuntos de T8 y T10, aviso de decisión, invitaciones con MFA, **RLS en Postgres**, bitácora inmutable, `ADMIN_TENDIA`, satisfacción, indicadores                               |
| Contrato    | `services/scoring/tests/test_app.py`              | pytest                                       | Campos exactos de la respuesta `/score` v2 (TND-071)                                                                                                                            |
| E2E portal  | `apps/portal/e2e`                                 | Playwright                                   | El analista entra con MFA, revisa una solicitud y la aprueba                                                                                                                    |
| E2E app     | `apps/mobile/.maestro`                            | Maestro                                      | Ingreso con OTP → solicitud → autorización → puntaje → envío                                                                                                                    |
| Usabilidad  | `apps/portal/scripts/recorrido-usabilidad.js`     | Playwright + axe-core + KLM                  | Las 9 tareas de `docs/usabilidad.md`: pasos, tiempo estimado, accesibilidad y objetivos táctiles                                                                                |

## Cobertura actual (25 oct 2026)

| Pieza   | Pruebas                    | Cobertura      |
| ------- | -------------------------- | -------------- |
| Scoring | 41                         | 91 % de líneas |
| API     | 101                        | 90 % de líneas |
| Portal  | 4 unitarias + 1 Playwright | —              |

## Casos que no se pueden romper

1. Un aliado nunca ve solicitudes de otro aliado ni las que el tendero no le envió.
2. Revocar una autorización borra los datos de esa fuente.
3. La explicación de la IA nunca dice que el crédito está aprobado ni lo compara con DataCrédito; si lo hace, se usa la plantilla.
4. Un campo nuevo o eliminado en `/score` hace fallar la prueba de contrato.
5. Un OTP errado o vencido no da acceso; el MFA del analista es obligatorio.
6. Con el rol del portal, Postgres no devuelve filas de otro aliado aunque la consulta no filtre (RLS).
7. Nadie puede editar ni borrar la bitácora; cada lectura queda con su finalidad.
8. Las pruebas nunca mandan SMS reales: usan el rango `300 000 0000` a `300 000 0999`, que fuera de producción siempre ve el código en pantalla.
9. Tendi no vuelve a anotar una venta o un fiado de un mensaje anterior.

## Cómo correr todo localmente

```bash
docker compose up -d db
docker exec tendia-db-1 psql -U tendia -c "CREATE DATABASE tendia_test"
cd services/scoring && uv run pytest && uv run uvicorn tendia_scoring.app:app --port 8000 &
DATABASE_URL=postgresql://tendia:tendia@127.0.0.1:55432/tendia_test pnpm --filter @tendia/api exec prisma migrate deploy
pnpm --filter @tendia/api test
docker compose up -d --build && pnpm --filter @tendia/portal test:e2e
```
