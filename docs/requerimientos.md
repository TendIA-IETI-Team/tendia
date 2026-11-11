# Documento de requerimientos

Cada requerimiento apunta a su historia (`TND-XXX`) en los [issues](https://github.com/TendIA-IETI-Team/tendia/issues), agrupadas en las épicas E0 a E8 de GitHub; la planeación por sprints, con las historias de Jira, está en [planificación](planificacion.md). Los códigos T y A son las pantallas de los wireframes: T para el tendero y A para el aliado. Contexto y actores en [contexto.md](contexto.md).

Prioridad MoSCoW: **M** debe, **S** debería, **C** podría.

## Requerimientos funcionales

### Tendero (app y WhatsApp)

| ID    | Requerimiento                                                                                            | Pantalla           | Historia         | Prioridad |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------------ | ---------------- | --------- |
| RF-01 | Ingresar con el celular y un código de un solo uso enviado por SMS                                       | Ingreso            | TND-010          | M         |
| RF-02 | Pedir un crédito con monto, destino y plazo                                                              | T1                 | TND-050          | M         |
| RF-03 | Autorizar cada fuente de datos por separado, en lenguaje simple, con la finalidad y la versión del texto | T2                 | TND-020          | M         |
| RF-04 | Ver y revocar las autorizaciones; al revocar se borran los datos de esa fuente                           | Mis autorizaciones | TND-021          | M         |
| RF-05 | Ver pantallas de espera mientras se traen los datos y se calcula el puntaje                              | T4, T6             | TND-051          | M         |
| RF-06 | Completar a mano la información del negocio cuando faltan datos                                          | T5                 | TND-034          | M         |
| RF-07 | Ver el puntaje sobre 1000, su franja y una explicación en palabras sencillas                             | T7                 | TND-052, TND-053 | M         |
| RF-08 | Justificar un mes malo con un motivo y una foto; el puntaje se recalcula (versión 2)                     | T8                 | TND-045, TND-054 | M         |
| RF-09 | Compartir la solicitud con una entidad y ver quién la revisa                                             | T9                 | TND-055          | M         |
| RF-10 | Responder una solicitud de garantía con un documento                                                     | T10                | TND-056          | M         |
| RF-11 | Ver la decisión: aprobado con monto, plazo y tasa, o rechazado con consejos                              | T11 a T13          | TND-057          | M         |
| RF-12 | Calificar la experiencia al terminar                                                                     | T12                | TND-081          | C         |
| RF-13 | Anotar ventas y fiados conversando con Tendi, en la app o por WhatsApp                                   | Tendi              | ADR-003          | S         |
| RF-14 | Pasar la foto de una hoja del cuaderno; la IA la lee y el tendero confirma antes de guardar              | Mi cuaderno        | TND-035          | C         |

### Aliado (portal y API)

| ID    | Requerimiento                                                                                     | Pantalla         | Historia         | Prioridad |
| ----- | ------------------------------------------------------------------------------------------------- | ---------------- | ---------------- | --------- |
| RF-20 | Ingresar con correo, contraseña y un segundo factor (TOTP con QR)                                 | Login, MFA       | TND-011          | M         |
| RF-21 | Ver la bandeja de solicitudes compartidas con una sugerencia según la política                    | A1               | TND-060          | M         |
| RF-22 | Ver el detalle del puntaje variable por variable, el segmento del negocio y la tasa de referencia | A1               | TND-060          | M         |
| RF-23 | Aprobar, rechazar o pedir garantía (FNG, codeudor u otra)                                         | A2               | TND-062          | M         |
| RF-24 | Revisar el documento de la garantía y cerrar la solicitud                                         | A3, A4           | TND-063          | M         |
| RF-25 | Configurar la política de riesgo: puntaje mínimo para aprobar, para pedir garantía y monto máximo | Política         | TND-061          | M         |
| RF-26 | Invitar analistas con un enlace de un solo uso                                                    | Equipo           | TND-012          | S         |
| RF-27 | Crear y revocar llaves de API y ver el consumo por mes                                            | Integraciones    | TND-013, TND-065 | S         |
| RF-28 | Pedir un puntaje desde el sistema propio por la API pública documentada                           | `POST /v1/score` | TND-064          | S         |
| RF-29 | Consultar la bitácora de accesos de su entidad                                                    | Auditoría        | TND-022          | S         |

### Equipo TendIA

| ID    | Requerimiento                                                       | Historia         | Prioridad |
| ----- | ------------------------------------------------------------------- | ---------------- | --------- |
| RF-30 | Dar de alta un aliado e invitar a su primer administrador           | #93              | S         |
| RF-31 | Consultar la bitácora de cualquier tendero y la satisfacción global | TND-022, TND-081 | S         |

### Motor de scoring

| ID    | Requerimiento                                                                                  | Historia         | Prioridad |
| ----- | ---------------------------------------------------------------------------------------------- | ---------------- | --------- |
| RF-40 | Validar que haya datos suficientes y consistentes entre fuentes antes de calcular              | TND-033          | M         |
| RF-41 | Calcular el puntaje con un scorecard interpretable y devolver la contribución de cada variable | TND-043, TND-044 | M         |
| RF-42 | Excluir de estabilidad y tendencia los meses justificados                                      | TND-045          | M         |
| RF-43 | Ubicar el negocio en un segmento de EMICRON 2024 y dar indicadores (ticket promedio, rotación) | TND-042          | S         |
| RF-44 | Versionar el contrato de `/score`; un cambio sin versión nueva rompe las pruebas               | TND-071          | C         |

## Requerimientos no funcionales

| ID     | Atributo              | Requerimiento                                                                                                                                                                                    | Cómo se verifica                                                                                  |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| RNF-01 | Privacidad (Ley 1581) | Consentimiento por fuente con finalidad y versión del texto; revocar borra los datos; nada se consulta sin consentimiento vigente                                                                | Pruebas e2e de la API, [política de datos](legal/politica-tratamiento-datos.md)                   |
| RNF-02 | Aislamiento           | Un aliado nunca ve solicitudes de otro: filtro en la API y Row Level Security en Postgres                                                                                                        | Pruebas de RLS con el rol `tendia_aliado`                                                         |
| RNF-03 | Auditoría             | Bitácora inmutable (un trigger rechaza `UPDATE` y `DELETE`) con actor, acción y finalidad, sin datos personales                                                                                  | Prueba de integración del trigger                                                                 |
| RNF-04 | Seguridad             | Celular y cédula cifrados con AES-256-GCM; MFA obligatorio en el portal; bloqueo de 15 min tras 5 intentos; OTP de 5 min y 5 intentos; límites por IP (10 por minuto en ingreso, 120 en general) | [OWASP API Top 10](security/owasp-api-top10.md), CodeQL, Dependabot                               |
| RNF-05 | Explicabilidad (SARC) | Cada variable suma o resta puntos y la suma da el puntaje; la IA solo redacta, nunca calcula ni decide                                                                                           | [Model card](model-card.md), pruebas del scorecard                                                |
| RNF-06 | Desempeño del modelo  | AUC de al menos 0,70 en el holdout del componente de pagos (hoy 0,741)                                                                                                                           | `train.py`, model card                                                                            |
| RNF-07 | Tiempo de respuesta   | Puntaje en segundos: el scoring responde en menos de 10 s o la API corta; la IA tiene tiempo límite y cae a una plantilla                                                                        | Timeouts en `scoring.client.ts` y `claude.ts`                                                     |
| RNF-08 | Disponibilidad        | Si Claude o Twilio fallan, la app sigue con plantillas y reglas; `/health` reporta base y scoring                                                                                                | Pruebas del explicador y del notificador                                                          |
| RNF-09 | Usabilidad            | Letra y botones grandes, cuatro pasos y lenguaje de tendero; contraste WCAG AA                                                                                                                   | [Prueba de usabilidad](usabilidad.md), pruebas de contraste de `packages/tokens`                  |
| RNF-10 | Escalabilidad         | API sin estado: se agregan instancias sin cambiar código ([monolito sin estado](diseno/monolito-sin-estado.md))                                                                                  | Diseño, prueba de carga en la fase 1                                                              |
| RNF-11 | Mantenibilidad        | CI obligatorio, cobertura mínima de 70 % en API y scoring (hoy cerca de 90 %), Conventional Commits y PR revisado                                                                                | [Plan de pruebas](test-plan.md), check `ci-ok`                                                    |
| RNF-12 | Observabilidad        | Logs JSON con datos personales ocultos y errores en Sentry con la versión desplegada                                                                                                             | `app.module.ts`, [despliegue](deploy.md)                                                          |
| RNF-13 | Portabilidad          | Las mismas imágenes Docker corren en local, en Vercel y en AWS                                                                                                                                   | `docker-compose.yml`, `Dockerfile.api`, [plan de infraestructura](diseno/plan-infraestructura.md) |

## Reglas de negocio

| ID    | Regla                                                                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RN-01 | Franjas del puntaje: bajo de 0 a 499, medio de 500 a 649 y bueno de 650 a 1000                                                                                                               |
| RN-02 | La sugerencia de la bandeja sale de la política del aliado (por defecto: aprobar desde 650, pedir garantía desde 500, monto máximo de $5.000.000); la decisión final siempre es del analista |
| RN-03 | El puntaje usa una ventana de 12 meses; con menos de 3 meses de una misma fuente de ventas no se calculan estabilidad ni tendencia                                                           |
| RN-04 | Cada mes se justifica una sola vez, con un motivo de 3 a 280 caracteres, y como máximo 12 meses por solicitud                                                                                |
| RN-05 | Adjuntos de hasta 3 MB, solo JPG, PNG, WEBP o PDF, con la firma del archivo verificada                                                                                                       |
| RN-06 | El tendero nunca paga; la entidad paga la suscripción y los puntajes adicionales                                                                                                             |

Los estados por los que pasa una solicitud están en el [modelo de datos](data-model.md#estados-de-una-solicitud).
