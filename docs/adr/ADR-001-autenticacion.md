# ADR-001: Autenticación de tenderos y analistas

- **Estado:** aceptada (pendiente de revisión del equipo)
- **Fecha:** 2026-10-23
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

- **Tendero:** OTP de 6 dígitos con hash, vigencia de 5 minutos, máximo 5 intentos y 3 códigos cada 10 minutos. Los envía Twilio cuando `TWILIO_*` está configurado; en local y dev, con `OTP_DEV_MODE=true`, el código se devuelve en la respuesta. Producción rechaza ese modo al arrancar.
- **Analista:** bcrypt + TOTP (RFC 6238) **obligatorio**. El primer ingreso fuerza el enrolamiento con QR. El secreto TOTP se guarda cifrado con AES-256-GCM.
- **Roles:** `TENDERO`, `ANALISTA`, `ADMIN_ALIADO`, con un guard global y `@Roles` por ruta. El `aliadoId` sale del token, nunca del cliente.
- **API pública:** llaves `tnd_<prefijo>_<secreto>`. Solo se guarda el hash SHA-256, se muestran una sola vez y se pueden revocar.

## Consecuencias

- Todo el flujo se puede probar sin servicios externos: 7 pruebas e2e cubren OTP, MFA, roles y aislamiento.
- El equipo es responsable de la seguridad de la autenticación. La mitigan rate limiting, hashes, cifrado y la revisión OWASP (TND-072).
- No hay recuperación de cuenta del analista por autoservicio: un administrador del aliado la gestiona.

## Cuándo migrar a Keycloak o Supabase Auth

Migrar cuando se cumpla cualquiera de estas condiciones:

- Un aliado exige SSO corporativo (SAML u OIDC con su directorio).
- Se necesitan más de 3 roles o permisos finos por producto.
- Hay más de 5 aliados en producción y la gestión de usuarios se vuelve operativa.

El contrato con los clientes (Bearer JWT con `sub`, `rol` y `aliadoId`) se mantiene, así que la migración no cambia la app ni el portal.
