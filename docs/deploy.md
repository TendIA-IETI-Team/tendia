# Ambientes y despliegue

| Ambiente | Base de datos                      | API, scoring y portal                                     | App                   |
| -------- | ---------------------------------- | --------------------------------------------------------- | --------------------- |
| Local    | `docker compose` (Postgres 16)     | `docker compose up --build`                               | Expo Go o emulador    |
| Dev      | Proyecto Supabase `tendia-dev`     | Local contra la base dev                                  | Expo Go               |
| Staging  | Proyecto Supabase `tendia-staging` | Render (`render.yaml`), se despliega al fusionar a `main` | Build interno con EAS |

Ningún secreto vive en el repo: van en GitHub Secrets, en el panel de Render o en `.env` locales (ignorados por git).

## Configurar staging (una sola vez)

1. **Supabase:** crea los proyectos `tendia-dev` y `tendia-staging`. Copia la cadena de conexión _Session pooler_ de cada uno.
2. **Render:** _New → Blueprint_ con este repo. Render lee `render.yaml` y crea `tendia-scoring` (privado), `tendia-api` y `tendia-portal`. Completa los valores marcados `sync: false`:
   - `DATABASE_URL`: cadena de Supabase staging.
   - `DATA_ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Guárdala también en un gestor de contraseñas: perderla deja ilegibles los datos cifrados.
   - `CORS_ORIGINS`: URL del portal en Render.
   - `NEXT_PUBLIC_API_URL` (portal): URL pública de `tendia-api`.
   - Opcionales: `ANTHROPIC_API_KEY` (explicación, asistente Tendi y lectura del cuaderno con IA), `SENTRY_DSN` y `RELEASE` (en `tendia-api` y `tendia-scoring`), `TWILIO_*` (SMS reales; al configurarlos, pon `OTP_DEV_MODE=false`) y `PUBLIC_API_URL` (URL pública de `tendia-api`, para WhatsApp).
   - WhatsApp: en Twilio, el webhook de mensajes entrantes es `POST <PUBLIC_API_URL>/whatsapp/webhook`.
3. **Migraciones:** la imagen de la API corre `prisma migrate deploy` al arrancar.
4. **App:** `cd apps/mobile && npx eas-cli@latest build --profile preview --platform android` con `EXPO_PUBLIC_API_URL` apuntando a la API de staging.

## Observabilidad (TND-073)

- API y scoring escriben logs JSON (pino y structlog) sin cuerpos de petición, tokens ni celulares.
- Con `SENTRY_DSN`, los errores llegan a Sentry etiquetados con `RELEASE` y `APP_ENV`. En Render, define `RELEASE` con el commit desplegado.

## Rotar secretos

- `JWT_SECRET`: cambiarlo cierra todas las sesiones; no afecta datos.
- `DATA_ENCRYPTION_KEY`: **no se puede rotar sin migrar los datos**. Requiere un script que descifre con la llave vieja y cifre con la nueva.
