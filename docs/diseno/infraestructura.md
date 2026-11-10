# Diagrama de infraestructura

Dónde corre cada pieza hoy, cómo llega el código hasta allá y cómo se corre en local. La evolución prevista está en el [plan de actualización de infraestructura](plan-infraestructura.md) y la operación en [deploy.md](../deploy.md).

## Staging y producción del MVP

Un solo proyecto de Vercel (`tendia-app`, plan Hobby) con Vercel Services y una base Postgres en Supabase.

```mermaid
flowchart TB
  usuarios["📱 Tendero · 🖥️ Analista · 🏦 Core del aliado"]
  twilio["Twilio<br/><small>Verify y WhatsApp</small>"]

  subgraph vercel["Vercel · proyecto tendia-app · https://tendia-app.vercel.app"]
    edge["Red de borde de Vercel<br/><small>TLS, CDN y tabla de rutas<br/>de vercel.json</small>"]
    subgraph servicios["Vercel Services · un despliegue atómico"]
      portal["portal<br/><small>Next.js · ruta /</small>"]
      appweb["app<br/><small>Export web de Expo, estático<br/>ruta /app</small>"]
      api["api<br/><small>Contenedor de Dockerfile.api<br/>ruta /api, el prefijo se quita<br/>migra la base al arrancar</small>"]
      scoring["scoring<br/><small>FastAPI · privado<br/>sin ruta pública</small>"]
    end
  end

  subgraph supabase["Supabase · Postgres 16"]
    pooler6543["Transaction pooler :6543<br/><small>DATABASE_URL de la API</small>"]
    pooler5432["Session pooler :5432<br/><small>DIRECT_URL para migraciones</small>"]
    pg[("Postgres<br/><small>RLS en las 22 tablas</small>")]
  end

  claude["Claude API"]
  sentry["Sentry"]

  usuarios -- HTTPS --> edge
  twilio -- "Webhook firmado /api/whatsapp/webhook" --> edge
  edge -- "/" --> portal
  edge -- "/app" --> appweb
  edge -- "/api/*" --> api
  api -- "binding SCORING_URL" --> scoring
  api --> pooler6543 --> pg
  api -. "prisma migrate deploy" .-> pooler5432 --> pg
  api --> claude
  api --> twilio
  api -.-> sentry
  scoring -.-> sentry
```

| Pieza         | Dónde                      | Cómo se construye                                        | Variables principales                                                                                                         |
| ------------- | -------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| portal        | Vercel, Next.js            | `pnpm install --filter @tendia/portal...` y `pnpm build` | `NEXT_PUBLIC_API_URL=/api`                                                                                                    |
| app           | Vercel, archivos estáticos | `npx expo export -p web` con `EXPO_BASE_URL=/app`        | `EXPO_PUBLIC_API_URL=/api`                                                                                                    |
| api           | Vercel, contenedor         | `Dockerfile.api` en la raíz, Node 22 y Prisma 6.1        | `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `TWILIO_*`, `SENTRY_DSN`, `PORT=4000` |
| scoring       | Vercel, FastAPI            | `uv` con solo las dependencias de ejecución              | `SENTRY_DSN`                                                                                                                  |
| Base de datos | Supabase                   | Migraciones de Prisma                                    | —                                                                                                                             |

Los secretos viven como variables cifradas del proyecto de Vercel; nunca en archivos ni en el repositorio (`.vercelignore` excluye todo `.env`).

## Del código a producción

```mermaid
flowchart LR
  dev["👩‍💻 Rama feature/TND-XXX"] --> pr["Pull request"]
  pr --> ci["GitHub Actions<br/><small>changes → scoring, tokens,<br/>api, portal, mobile → ci-ok</small>"]
  pr --> codeql["CodeQL y Dependabot"]
  pr --> preview["Vercel Preview<br/><small>los cuatro servicios,<br/>URL propia y protegida</small>"]
  ci --> review{"Revisión<br/>y ci-ok"}
  review -- "Fusión a main" --> prod["Vercel Production<br/><small>tendia-app.vercel.app</small>"]
  prod --> health["/api/health<br/><small>db, scoring y release<br/>con el commit desplegado</small>"]
```

- CI corre solo las piezas que cambiaron y el check `ci-ok` es obligatorio para fusionar.
- Cada PR tiene su propio despliegue de vista previa con los cuatro servicios sincronizados.
- Cada fusión a `main` despliega sola. Volver atrás es promover el despliegue anterior en Vercel, porque los cuatro servicios se publican juntos.

## Desarrollo local

```mermaid
flowchart LR
  subgraph compose["docker compose up"]
    db[("db<br/>Postgres 16.6 :5432")]
    scoring["scoring<br/>:8000"]
    api["api<br/>Dockerfile.api :4000"]
    portal["portal<br/>:3000"]
  end
  expo["App con Expo<br/>npx expo start"]
  portal --> api
  expo --> api
  api --> db
  api --> scoring
```

La API usa la misma imagen en local y en Vercel. Sin llaves de Claude o Twilio, la app funciona con plantillas y códigos de demostración.
