# apps/portal

Portal del aliado (Next.js + Tailwind con `@tendia/tokens`).

| Ruta                | Pantalla                                                                 | Historia         |
| ------------------- | ------------------------------------------------------------------------ | ---------------- |
| `/login`            | Correo, contraseña y MFA (enrolamiento con QR la primera vez)            | TND-011          |
| `/bandeja`          | A1: solicitudes con puntaje, factores y sugerencia por política          | TND-060          |
| `/solicitudes/[id]` | A1-A4: score explicado, ventas, pagos, aprobar, pedir o evaluar garantía | TND-062, TND-063 |
| `/politica`         | Política de riesgo (solo administrador)                                  | TND-061          |
| `/integraciones`    | Llaves de API y consumo de los últimos 30 días                           | TND-013, TND-065 |
| `/auditoria`        | Bitácora de accesos (solo administrador)                                 | TND-022          |

```bash
pnpm dev                 # http://localhost:3000 (NEXT_PUBLIC_API_URL, por defecto http://localhost:4000)
pnpm test                # unitarias
pnpm test:e2e            # Playwright contra docker compose
```
