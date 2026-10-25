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
   - Opcionales:
     - `ANTHROPIC_API_KEY`: explicación del puntaje, asistente Tendi y lectura del cuaderno con IA.
     - `SENTRY_DSN` en `tendia-api` (DSN del proyecto Node.js) y en `tendia-scoring` (DSN del proyecto Python). `RELEASE` no hace falta: ambos usan `RENDER_GIT_COMMIT`, el commit que Render desplegó.
     - `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN`: OTP por SMS con **Twilio Verify** (sin comprar número) y avisos por WhatsApp. `TWILIO_FROM` ya no se usa. `TWILIO_VERIFY_SERVICE_SID` es opcional: si falta, la API crea el servicio "TendIA".
     - `PUBLIC_API_URL`: URL pública de `tendia-api` (`https://tendia-api.onrender.com`), para validar la firma del webhook de WhatsApp.
   - `OTP_DEV_MODE` queda en `true` en staging: los celulares de demostración (`300 000 0000` a `300 000 0999`) ven el código en pantalla y los reales lo reciben por SMS. En producción debe ser `false`.
   - `PORTAL_URL` ya viene en `render.yaml` (`https://tendia-portal.onrender.com`): es la base de los enlaces de invitación a analistas.
   - WhatsApp: en Twilio → Messaging → _Try it out_ → WhatsApp sandbox, _When a message comes in_ = `POST https://tendia-api.onrender.com/whatsapp/webhook`. Cada celular se une al sandbox enviando el código `join …` que muestra Twilio. Los avisos de decisión salen del número del sandbox (`TWILIO_WHATSAPP_FROM`, por defecto `whatsapp:+14155238886`) y solo llegan a quien escribió al sandbox en las últimas 24 horas.
3. **Migraciones:** la imagen de la API corre `prisma migrate deploy` al arrancar. La migración `bitacora_inmutable_y_rls` crea el rol `tendia_aliado`, activa RLS en todas las tablas y el trigger que impide editar la bitácora. Se probó como en Supabase: un usuario sin superusuario con `CREATEROLE`, en una base nueva y con el rol ya creado por otro. Si el usuario no puede usar el rol, la API lo avisa en el log y sigue con el aislamiento de la aplicación.
4. **App:** `cd apps/mobile && npx eas-cli@latest build --profile preview --platform android` con `EXPO_PUBLIC_API_URL` apuntando a la API de staging.

## Observabilidad (TND-073)

- API y scoring escriben logs JSON (pino y structlog) sin cuerpos de petición, tokens ni celulares.
- Con `SENTRY_DSN`, los errores 5xx y los fallos al arrancar llegan a Sentry etiquetados con la versión (`RELEASE`, o `RENDER_GIT_COMMIT` en Render) y `APP_ENV`. Un filtro global de Nest los reporta: los 4xx son respuestas esperadas y no se envían.
- Sentry no recibe datos personales: sin encabezados (salvo user-agent y content-type), cuerpos, cookies, usuario ni datos de consultas (Ley 1581).
- `/health` de la API y del scoring responde la versión desplegada (`release`).

## Rotar secretos

- `JWT_SECRET`: cambiarlo cierra todas las sesiones; no afecta datos.
- `DATA_ENCRYPTION_KEY`: **no se puede rotar sin migrar los datos**. Requiere un script que descifre con la llave vieja y cifre con la nueva.
