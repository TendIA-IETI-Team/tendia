# Monolito modular sin estado

La API de TendIA es **un monolito modular sin estado**: un solo proceso de NestJS con módulos separados por responsabilidad, que no guarda nada en memoria ni en disco entre una petición y otra. El motor de scoring ya es un servicio aparte, también sin estado. Este documento explica por qué es la decisión correcta hoy, cómo se demuestra en el código, qué la rompería y cuándo cambiarla. Sirve para responder preguntas sobre la arquitectura.

## Qué significa cada palabra

- **Monolito:** la API se construye, se prueba y se despliega como una unidad, con una sola base de datos.
- **Modular:** por dentro son 14 módulos con fronteras claras (auth, tendero, solicitudes, aliado, admin, API pública, asistente, registros, conectores, scoring, explicación, notificaciones, auditoría y salud). Un módulo usa otro por sus servicios públicos, no por sus tablas.
- **Sin estado:** cualquier instancia puede atender cualquier petición. Si una muere o se agregan diez, nada se pierde, porque todo el estado vive en Postgres.

## La prueba en el código

| Estado que podría quedar en el servidor | Dónde vive en TendIA                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Sesión del usuario                      | JWT firmado que el cliente envía en cada petición (`AuthGuard`); no hay sesiones en el servidor |
| Paso intermedio del MFA                 | JWT de 5 minutos con propósito `mfa`                                                            |
| Códigos de ingreso                      | Tabla `OtpCodigo` (hash, vencimiento, intentos) o Twilio Verify                                 |
| Archivos subidos                        | `Adjunto.datos` en Postgres, no en el disco del contenedor                                      |
| Historial de Tendi                      | `MensajeAsistente`, con lo que ya anotó en `acciones`                                           |
| Lectura del cuaderno pendiente          | `ExtraccionCuaderno`                                                                            |
| Migraciones                             | Corren al arrancar el contenedor (`prisma migrate deploy`), idempotentes                        |
| Configuración y secretos                | Variables de entorno (`config.ts`)                                                              |
| Modelo de riesgo                        | Archivo JSON de solo lectura dentro de la imagen del scoring                                    |

**Lo único en memoria** son los contadores del límite de peticiones (`ThrottlerModule`) y el pool de conexiones de Prisma. Con varias instancias, cada una cuenta por separado: el límite efectivo se multiplica por el número de instancias. La fase 1 del [plan de infraestructura](plan-infraestructura.md) lo mueve a Redis cuando haya más de una.

## Por qué es la decisión correcta hoy

| Razón                       | Dato                                                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La carga es pequeña**     | El modelo financiero proyecta ~32.700 puntajes al mes en el mes 36. Con todo concentrado en horario hábil y un pico de 10 veces, es menos de un puntaje por segundo. Un proceso lo atiende de sobra                                          |
| **El equipo es uno**        | Los microservicios resuelven que muchos equipos desplieguen sin pisarse. Somos seis personas                                                                                                                                                 |
| **La consistencia importa** | Revocar un permiso borra los datos de esa fuente y escribe la bitácora en una sola transacción (Ley 1581). La Row Level Security se activa por transacción con `app.aliado_id`. Repartir eso entre servicios exigiría sagas y compensaciones |
| **Ya es modular**           | El scoring ya está separado y privado. Cada módulo tiene fronteras, así que extraer uno después es barato                                                                                                                                    |
| **Cuesta menos**            | Un despliegue, una base, un pipeline. Hoy corre gratis y en el año 3 cabe en el presupuesto de infraestructura                                                                                                                               |
| **Escala horizontalmente**  | Al no tener estado, crecer es agregar instancias detrás del balanceador, sin cambiar código                                                                                                                                                  |

Es la estrategia _monolith first_ que recomiendan Martin Fowler y Sam Newman: empezar con un monolito bien modularizado y separar cuando haya una razón medible.

## Por qué el scoring sí está aparte

- Otro lenguaje: Python es el estándar para el modelo; la API es TypeScript.
- Otro ciclo de vida: el modelo se reentrena y se versiona sin tocar la API.
- No tiene datos personales ni estado: recibe series mensuales y devuelve el puntaje.
- Es privado: no tiene ruta pública y solo la API lo alcanza por binding. Un contrato versionado (`/score` v2) con pruebas de contrato evita que se rompan entre sí.

## Alternativas descartadas

| Alternativa                                  | Por qué no                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Microservicios desde el inicio               | Más piezas, red y despliegues para una carga que cabe en un proceso; la consistencia de la Ley 1581 se vuelve distribuida    |
| Una función serverless por endpoint          | Arranques en frío y conexiones a la base por función; NestJS pierde su inyección de dependencias y sus guards compartidos    |
| Clientes contra Supabase directamente (BaaS) | El consentimiento, el aislamiento y la auditoría quedarían repartidos en los clientes; la API es la única puerta a los datos |
| Monolito con sesiones en memoria             | Ata cada usuario a una instancia y pierde sesiones al reiniciar                                                              |

## Qué lo rompería y qué haríamos

| Riesgo                                                   | Señal                             | Respuesta                                                                           |
| -------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| Llamadas lentas a la IA o a proveedores ocupan la API    | p95 alto en `/evaluar` o en Tendi | Cola de trabajos y worker (fase 2); ya hay tiempos límite y respaldo con plantillas |
| Demasiadas conexiones a Postgres al escalar              | Errores de conexión               | Transaction pooler de Supabase o RDS Proxy; `connection_limit=1` por instancia      |
| Adjuntos grandes inflan la base                          | Tamaño de la base                 | Mover a S3 con KMS (fase 3)                                                         |
| Límite de peticiones inconsistente con varias instancias | Más instancias que una            | Contadores en Redis (fase 1)                                                        |
| Un módulo crece 10 veces más que el resto                | Métricas por ruta                 | Extraerlo a su propio servicio (fase 4)                                             |

## Preguntas que nos pueden hacer

**¿Un monolito no es una mala práctica?**
No por sí mismo. Lo malo es un monolito sin fronteras. El nuestro es modular, sin estado y con el scoring ya separado. Elegimos la arquitectura por la carga, el equipo y la consistencia, no por moda.

**¿Y si mañana llegan 100 veces más tenderos?**
Al no tener estado, se agregan instancias de la API detrás del balanceador. El cuello de botella sería la base, que se resuelve con el pooler, réplicas de lectura o una instancia más grande. Ninguna de esas cosas exige partir el código.

**¿Qué pasa si se cae el scoring?**
La API responde que el puntaje no está disponible y `/health` lo reporta como degradado; el resto de la app sigue. Al no tener estado, el scoring se reinicia sin perder nada.

**¿Qué pasa si se cae la IA?**
La explicación cae a una plantilla y Tendi a reglas. El puntaje nunca depende de la IA.

**¿Cómo garantizan que un banco no vea datos de otro si todo está en la misma base?**
Con dos capas: la API filtra por aliado y, además, Postgres lo impone con Row Level Security. Aunque una consulta olvide el filtro, la base no devuelve filas ajenas. Hay pruebas automáticas para eso.

**¿Por qué no microservicios para ganar resiliencia?**
Cada servicio nuevo es un punto de falla más y una llamada de red más. Hoy la resiliencia viene de no tener estado, de los tiempos límite y de los respaldos con plantilla.

**¿Por qué Vercel y no AWS desde el inicio?**
Porque es gratis para el MVP, despliega solo desde `main` y crea un ambiente por PR. Pasamos a AWS cuando un banco vigilado lo exija (fase 3), con la misma imagen Docker.

**¿Cuándo dejaría de ser la decisión correcta?**
Cuando un módulo cumpla un criterio medible: crecer 10 veces más que el resto, necesitar otra forma de escalar o tener un equipo propio. Los candidatos son la API pública y Tendi.

**¿No es arriesgado guardar archivos en la base?**
Para el MVP simplifica: un solo respaldo, permisos y RLS en un solo lugar, y la API sigue sin estado. Los archivos están limitados a 3 MB. En la fase 3 pasan a S3 cifrado con llaves propias.

**¿Cómo migran sin reescribir?**
Porque la API ya es un contenedor configurado por variables de entorno. Moverla es cambiar dónde corre la imagen y la cadena de conexión.
