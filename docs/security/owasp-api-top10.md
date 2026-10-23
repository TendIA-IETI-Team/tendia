# Revisión OWASP API Security Top 10 (2023)

Revisión inicial del MVP, 23 oct 2026 (TND-072). Dependabot y CodeQL están activos en `.github/`.

| Riesgo                                          | Estado    | Cómo se mitiga                                                                                                                                | Acción pendiente                               |
| ----------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| API1 Autorización a nivel de objeto             | Mitigado  | Toda consulta filtra por `tenderoId` o `aliadoId` del token; un objeto ajeno responde 404. Probado en e2e                                     | —                                              |
| API2 Autenticación rota                         | Mitigado  | OTP con hash, vencimiento, límite de intentos y de envíos; MFA obligatorio para analistas; bcrypt; hash señuelo contra enumeración de correos | Rotación de `JWT_SECRET` documentada en deploy |
| API3 Autorización a nivel de propiedad          | Mitigado  | DTOs con `whitelist` y `forbidNonWhitelisted`; las respuestas se arman a mano, sin hashes ni secretos                                         | —                                              |
| API4 Consumo de recursos sin límite             | Parcial   | Rate limit global (120/min) y de autenticación (10/min); tamaño de arreglos acotado; timeouts a scoring (10 s) y Claude (20 s)                | Límite por llave de API según plan             |
| API5 Autorización a nivel de función            | Mitigado  | Guard global y `@Roles`; las rutas de admin exigen `ADMIN_ALIADO`. Probado en e2e                                                             | —                                              |
| API6 Acceso sin restricción a flujos de negocio | Parcial   | Una solicitud abierta por tendero; transiciones de estado validadas                                                                           | Detección de abuso de OTP por IP               |
| API7 SSRF                                       | No aplica | La API no consulta URLs que envíe el usuario                                                                                                  | Revisar al integrar conectores reales          |
| API8 Mala configuración de seguridad            | Mitigado  | Helmet, CORS con lista blanca, `OTP_DEV_MODE` prohibido en producción, contenedores sin root                                                  | Encabezados CSP en el portal                   |
| API9 Inventario inadecuado                      | Mitigado  | OpenAPI en `/docs`; contrato `/score` versionado (v1) con prueba de contrato                                                                  | Publicar el OpenAPI por versión                |
| API10 Consumo inseguro de APIs                  | Parcial   | La respuesta de Claude se valida con esquema y frases prohibidas, con plantilla de respaldo; los conectores son simulados                     | Validar el esquema de los conectores reales    |

## Hallazgos para seguimiento

1. El portal guarda el token en `sessionStorage`. Es aceptable en el MVP; en producción conviene una cookie `HttpOnly` con un BFF.
2. Las llaves de API no expiran solas. Agregar fecha de expiración opcional.
3. Falta un escaneo de secretos en CI además del de GitHub (push protection).
