# Contexto del proyecto

## El problema

En Colombia hay más de 500.000 tiendas de barrio. Venden todos los días, pero menos del 15 % de las microempresas accede a crédito formal: el banco les pide historial crediticio que no tienen y se demora de 5 a 15 días en responder. Quien no consigue crédito termina en el gota a gota, con tasas de 382 % a 666 % efectivo anual, frente a una tasa de usura cercana al 28 %.

El negocio del tendero sí deja rastro: ventas con datáfono, compras fiadas al distribuidor y lo que anota en su cuaderno. Esa información no llega a las entidades que prestan.

## La propuesta

TendIA convierte esos datos del negocio en un **Puntaje TendIA de 0 a 1000**, explicado en palabras sencillas, que el tendero comparte con la entidad que elija. La entidad decide con el puntaje, su propia política de riesgo y, si hace falta, una garantía.

TendIA **no presta dinero**. Es una plataforma B2B2C: la entidad paga la evaluación y el tendero nunca paga.

## Actores

| Actor                              | Quién es                                                                                        | Qué hace en TendIA                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Tendero**                        | Dueño de una tienda de barrio, por ejemplo Doña Patricia (47 años, Bosa, 12 años con su tienda) | Pide crédito, autoriza sus fuentes de datos, ve su puntaje explicado, justifica meses malos, responde garantías, anota ventas con Tendi |
| **Analista del aliado**            | Persona de una cooperativa, microfinanciera, fintech, banco o distribuidor                      | Revisa la bandeja, ve el puntaje variable por variable, aprueba, rechaza o pide garantía                                                |
| **Administrador del aliado**       | Responsable de la entidad en TendIA                                                             | Configura la política de riesgo, invita a su equipo, crea llaves de API, revisa consumo y auditoría                                     |
| **Equipo TendIA** (`ADMIN_TENDIA`) | Operación de TendIA                                                                             | Da de alta aliados, consulta la bitácora de cualquier tendero y la satisfacción global                                                  |
| **Sistema del aliado**             | El core bancario de la entidad                                                                  | Pide puntajes por la API pública con una llave                                                                                          |

## Sistemas externos

| Sistema                                                                           | Para qué                                          | Estado en el MVP                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| Datáfono y libros digitales (Bold, Treinta), distribuidores, Open Finance (Belvo) | Ventas, compras fiadas y pagos del tendero        | Conectores simulados con distribuciones reales de EMICRON 2024 |
| Claude (Anthropic)                                                                | Explicar el puntaje, Tendi y lectura del cuaderno | Real                                                           |
| Twilio Verify y WhatsApp                                                          | Códigos de ingreso y avisos                       | Real, cuenta de prueba                                         |
| Sentry                                                                            | Errores sin datos personales                      | Real                                                           |
| Supabase (Postgres) y Vercel                                                      | Base de datos y hospedaje                         | Real, staging                                                  |

## Restricciones

- **Ley 1581 de 2012 (habeas data):** permiso explícito por fuente y finalidad, que se puede revocar, y bitácora de quién vio qué.
- **SARC de la Superintendencia Financiera:** el modelo de riesgo debe ser explicable y auditable. Por eso es un scorecard y no una caja negra.
- **Usuarios con poca experiencia digital:** letra grande, cuatro pasos, lenguaje de tendero, WhatsApp como canal alterno.
- **Equipo y tiempo:** seis estudiantes y un semestre (cuatro sprints de dos semanas).
- **Costo:** staging en planes gratuitos (Vercel Hobby y Supabase Free).

## Alcance del MVP

**Dentro:** el flujo completo de una solicitud, desde que el tendero la crea hasta la decisión de la entidad (T1 a T13 y A1 a A4); el puntaje con datos reales de entrenamiento; la IA que explica; la API pública; la seguridad y la Ley 1581.

**Fuera:** desembolsar o cobrar créditos, convenios firmados con proveedores de datos (los conectores son simulados), pagos de la suscripción y apps publicadas en las tiendas.

## Supuestos

- Los tenderos usan Android y WhatsApp a diario.
- Las entidades pagan una suscripción mensual más un cobro por puntaje adicional ([modelo financiero](planificacion.md#modelo-financiero)).
- El comportamiento de pago con el distribuidor se parece al de una tarjeta de crédito (factura, pago y cupo), lo que permite entrenar ese componente con UCI ([model card](model-card.md)).

Siguiente: [requerimientos](requerimientos.md) · [datos de entrada y salida](datos-entrada-salida.md) · [diseño](diseno/README.md).
