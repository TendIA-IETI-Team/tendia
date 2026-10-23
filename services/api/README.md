# services/api

API de TendIA (NestJS + Prisma). Es la única puerta a los datos: autenticación, consentimientos, conectores, solicitudes, decisiones de los aliados, API pública y auditoría.

```bash
cp .env.example .env
pnpm exec prisma migrate deploy     # o migrate dev para crear migraciones
pnpm dev                            # http://localhost:4000/docs
pnpm test                           # unitarias + integración (requiere Postgres tendia_test y scoring)
```

| Módulo                  | Rutas                                                                          | Historias                                    |
| ----------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| `auth`                  | `/auth/tendero/*`, `/auth/aliado/*`                                            | TND-010, TND-011                             |
| `tendero`               | `/me`, `/fuentes`, `/consentimientos`, `/aliados`                              | TND-020, TND-021, TND-034                    |
| `tendero` (solicitudes) | `/solicitudes/*`                                                               | TND-050 a TND-057, TND-081                   |
| `conectores`            | Interfaz `Conector` + datáfono, distribuidor y open finance simulados          | TND-030 a TND-032                            |
| `explicacion`           | Claude API con salida estructurada y plantilla de respaldo                     | TND-053                                      |
| `aliado`                | `/aliado/*`: bandeja, decisión, garantía, política, llaves, consumo, auditoría | TND-012, TND-013, TND-022, TND-060 a TND-065 |
| `public-api`            | `POST /v1/score` con `x-api-key`                                               | TND-064, TND-065                             |

Variables de entorno en [`.env.example`](.env.example); decisiones en [ADR-001](../../docs/adr/ADR-001-autenticacion.md) y [ADR-002](../../docs/adr/ADR-002-arquitectura.md).
