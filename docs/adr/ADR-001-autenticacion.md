# ADR-001: Autenticación de tenderos y analistas

- **Estado:** aceptada (pendiente de revisión del equipo)
- **Fecha:** 2026-10-23, actualizada el 2026-10-25 (Twilio Verify, invitaciones y `ADMIN_TENDIA`)
- **Historia:** TND-003, TND-010, TND-011

## Contexto

Hay dos tipos de usuario con necesidades distintas:

- **Tendero:** entra desde el celular, muchas veces sin correo. Debe entrar con su número y un código por SMS.
- **Analista del aliado:** maneja datos financieros de terceros. Necesita correo, contraseña y un segundo factor obligatorio.

El plan inicial era usar Supabase Auth. Al construir el MVP pesaron tres cosas:

1. Las pruebas automáticas y la demo deben correr sin cuentas externas (`docker compose up`).
2. El aislamiento por aliado y la auditoría ya viven en la API, que es la única puerta a los datos.
3. Supabase Auth con teléfono exige configurar un proveedor de SMS de todas formas.

## Decisión

La **API emite y valida sus propios JWT** (HS256, 12 h para tenderos y 8 h para analistas). Supabase se usa como **Postgres administrado** en dev y staging.

- **Tendero:** OTP de 6 dígitos, vigencia de 5 minutos, máximo 5 intentos y 3 códigos cada 10 minutos (los límites los aplica la API, con cualquier canal).
  - **Con Twilio** (`TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN`): **Twilio Verify** genera, envía y valida el código desde sus propios números, así que **no hay que comprar un número**. La primera vez la API busca o crea en la cuenta un servicio de Verify llamado "TendIA" (o usa `TWILIO_VERIFY_SERVICE_SID`).
  - **En pantalla** (`OTP_DEV_MODE=true`, nunca en producción): la API genera el código, guarda su hash y lo devuelve en la respuesta. Lo usan local, las pruebas y los celulares reservados `300 000 0000` a `300 000 0999` aunque Twilio esté configurado, porque nadie es dueño de esos números.
  - Producción rechaza `OTP_DEV_MODE` al arrancar.
- **Analista:** bcrypt + TOTP (RFC 6238) **obligatorio**. El primer ingreso fuerza el enrolamiento con QR. El secreto TOTP se guarda cifrado con AES-256-GCM.
- **Invitaciones:** el `ADMIN_ALIADO` invita analistas desde el portal. El enlace (`PORTAL_URL/invitacion/<token>`) se usa una vez, vence en 7 días y solo se guarda su hash. El administrador lo envía con su propio correo (botón "Enviar por correo") o lo copia. El invitado crea una contraseña de al menos 12 caracteres con letras y números, y en su primer ingreso enrola el TOTP.
- **Roles:** `TENDERO`, `ANALISTA`, `ADMIN_ALIADO` y `ADMIN_TENDIA` (equipo de TendIA, sin aliado), con un guard global y `@Roles` por ruta. El `aliadoId` sale del token, nunca del cliente. Postgres refuerza el aislamiento con Row Level Security (ver [data-model.md](../data-model.md#decisiones-de-protección-de-datos)).
- **API pública:** llaves `tnd_<prefijo>_<secreto>`. Solo se guarda el hash SHA-256, se muestran una sola vez y se pueden revocar.

## Consecuencias

- Todo el flujo se puede probar sin servicios externos: las pruebas e2e cubren OTP, MFA, invitaciones, roles, aislamiento y RLS.
- Sin un proveedor de correo, la invitación sale del correo del administrador. Con uno (SES, Resend) bastaría enviar el mismo enlace desde la API.
- El equipo es responsable de la seguridad de la autenticación. La mitigan rate limiting, hashes, cifrado y la revisión OWASP (TND-072).
- No hay recuperación de cuenta del analista por autoservicio: un administrador del aliado la gestiona.

## Cuándo migrar a Keycloak o Supabase Auth

Migrar cuando se cumpla cualquiera de estas condiciones:

- Un aliado exige SSO corporativo (SAML u OIDC con su directorio).
- Se necesitan más de 3 roles o permisos finos por producto.
- Hay más de 5 aliados en producción y la gestión de usuarios se vuelve operativa.

El contrato con los clientes (Bearer JWT con `sub`, `rol` y `aliadoId`) se mantiene, así que la migración no cambia la app ni el portal.
