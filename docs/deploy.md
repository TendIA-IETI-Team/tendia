# Ambientes y despliegue

| Ambiente | Base de datos                      | API, scoring y portal                                                        | App                   |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------- | --------------------- |
| Local    | `docker compose` (Postgres 16)     | `docker compose up --build`                                                  | Expo Go o emulador    |
| Dev      | Proyecto Supabase `tendia-dev`     | Local contra la base dev                                                     | Expo Go               |
| Staging  | Proyecto Supabase `tendia-staging` | Vercel, proyecto `tendia-app` ([`vercel.json`](../vercel.json)), plan gratis | Build interno con EAS |

Ningún secreto vive en el repo: van en GitHub Secrets, en las variables del proyecto de Vercel o en `.env` locales (ignorados por git).

## Cómo está armado en Vercel

Un solo proyecto con [Vercel Services](https://vercel.com/docs/services). Los tres servicios se construyen por separado y se despliegan juntos, así que el portal, la API y el scoring de un despliegue siempre son de la misma versión.

| Servicio  | Carpeta            | Ruta pública                   | Notas                                                                                         |
| --------- | ------------------ | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `portal`  | `apps/portal`      | `/`                            | Llama a la API en `/api`, en el mismo dominio: no necesita CORS                               |
| `api`     | `services/api`     | `/api/*` (el prefijo se quita) | NestJS como una Vercel Function; el build corre `prisma migrate deploy`                       |
| `scoring` | `services/scoring` | **ninguna**                    | FastAPI privado. La API lo alcanza por el _binding_ `SCORING_URL`; Internet no puede llamarlo |

- URL: https://tendia-app.vercel.app (portal), https://tendia-app.vercel.app/api/docs (OpenAPI), https://tendia-app.vercel.app/api/health.
- Las funciones de Vercel aceptan cuerpos de hasta 4,5 MB, por eso las fotos y los PDF van hasta 3 MB (unos 4 MB en base64).
- El scoring solo instala lo que usa en ejecución; scikit-learn, scipy, pandas y xlrd están en el grupo `train` de `pyproject.toml`.
- El seed de demostración corre al arrancar la API (`SEED_ON_START=true`) y es idempotente. Nunca corre con `APP_ENV=production`.

## Configurar staging (una sola vez)

1. **Supabase:** en el proyecto `tendia-staging` → _Connect_, copia la cadena _Session pooler_ (puerto 5432). La de _Transaction pooler_ es la misma con el puerto 6543.
2. **Vercel:** importa el repositorio (o `vercel link`) con el nombre `tendia-app` y la raíz del repo como directorio. Vercel lee `vercel.json` y crea los tres servicios. Para que despliegue solo al fusionar a `main`, la app de Vercel debe estar instalada en la organización de GitHub.
3. **Variables del proyecto** (Production y Preview):
   - `DATABASE_URL`: _Transaction pooler_ (`:6543`) con `?pgbouncer=true&connection_limit=1`. Las funciones abren muchas conexiones cortas y el pooler de transacciones las reparte.
   - `DIRECT_URL`: _Session pooler_ (`:5432`). Solo la usa el build para `prisma migrate deploy`, que no funciona a través del pooler de transacciones.
   - `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.
   - `DATA_ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Guárdala también en un gestor de contraseñas: perderla deja ilegibles los datos cifrados.
   - `APP_ENV=staging`, `OTP_DEV_MODE=true`, `SEED_ON_START=true`.
   - `PORTAL_URL=https://tendia-app.vercel.app` (base de los enlaces de invitación), `PUBLIC_API_URL=https://tendia-app.vercel.app/api` (firma del webhook de WhatsApp), `CORS_ORIGINS=https://tendia-app.vercel.app`.
   - `NEXT_PUBLIC_API_URL=/api` para el portal.
   - Opcionales: `ANTHROPIC_API_KEY` (explicación, Tendi y cuaderno con IA), `SENTRY_DSN` (DSN del proyecto Node.js), `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN` (OTP con **Twilio Verify**, sin comprar número, y avisos por WhatsApp). `TWILIO_VERIFY_SERVICE_SID` es opcional: si falta, la API crea el servicio "TendIA".
   - `SCORING_URL` **no** se configura: la inyecta el binding de `vercel.json`.
4. **Migraciones:** el build de la API las aplica con `DIRECT_URL`. La migración `bitacora_inmutable_y_rls` crea el rol `tendia_aliado`, activa RLS en todas las tablas y el trigger que impide editar la bitácora. Se probó como en Supabase: un usuario sin superusuario con `CREATEROLE`, en una base nueva y con el rol ya creado por otro. Si el usuario no puede usar el rol, la API lo avisa en el log y sigue con el aislamiento de la aplicación.
5. **WhatsApp:** en Twilio → Messaging → _Try it out_ → WhatsApp sandbox, _When a message comes in_ = `POST https://tendia-app.vercel.app/api/whatsapp/webhook`. Cada celular se une al sandbox enviando el código `join …` que muestra Twilio. Los avisos de decisión salen del número del sandbox (`TWILIO_WHATSAPP_FROM`, por defecto `whatsapp:+14155238886`) y solo llegan a quien escribió al sandbox en las últimas 24 horas.
6. **App:** `cd apps/mobile && npx eas-cli@latest build --profile preview --platform android` con `EXPO_PUBLIC_API_URL=https://tendia-app.vercel.app/api`.

`OTP_DEV_MODE` queda en `true` en staging: los celulares de demostración (`300 000 0000` a `300 000 0999`) ven el código en pantalla y los reales lo reciben por SMS. En producción debe ser `false`.

## Reiniciar el MFA en staging

En Vercel no hay una consola dentro del servidor, así que el script corre desde tu computador contra la base de staging:

```bash
npx vercel env pull services/api/.env.staging --environment=production
cd services/api && pnpm build
node --env-file=.env.staging dist/scripts/reset-mfa.js <correo>
```

Borra `services/api/.env.staging` al terminar: tiene los secretos de staging.

## Observabilidad (TND-073)

- API y scoring escriben logs JSON (pino y structlog) sin cuerpos de petición, tokens ni celulares. Se ven en Vercel → _Logs_.
- Con `SENTRY_DSN`, los errores 5xx y los fallos al arrancar llegan a Sentry etiquetados con la versión (`RELEASE`, o `VERCEL_GIT_COMMIT_SHA` en Vercel) y `APP_ENV`. Un filtro global de Nest los reporta: los 4xx son respuestas esperadas y no se envían.
- Sentry no recibe datos personales: sin encabezados (salvo user-agent y content-type), cuerpos, cookies, usuario ni datos de consultas (Ley 1581).
- `/api/health` responde la versión desplegada (`release`) y si la base y el scoring responden.

## Rotar secretos

- `JWT_SECRET`: cambiarlo cierra todas las sesiones; no afecta datos.
- `DATA_ENCRYPTION_KEY`: **no se puede rotar sin migrar los datos**. Requiere un script que descifre con la llave vieja y cifre con la nueva.
