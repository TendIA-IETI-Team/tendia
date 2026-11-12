# Diseño de TendIA

Documentación de análisis y diseño del MVP. Los diagramas están en Mermaid, así que GitHub los muestra sin herramientas extra y se actualizan junto con el código.

## Análisis

| Documento                                               | De qué trata                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| [Contexto](../contexto.md)                              | Problema, actores, sistemas externos, restricciones y alcance      |
| [Requerimientos](../requerimientos.md)                  | Funcionales por actor, no funcionales medibles y reglas de negocio |
| [Datos de entrada y salida](../datos-entrada-salida.md) | Qué entra, qué sale, con qué formato y cómo se protege             |
| [Planificación](../planificacion.md)                    | Sprints, épicas, equipo, riesgos y modelo financiero               |

## Diseño

| Documento                                              | De qué trata                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| [C4: contexto, contenedores y componentes](c4.md)      | Los tres niveles del modelo C4 para la API y el scoring                 |
| [Infraestructura](infraestructura.md)                  | Vercel, Supabase, el camino del código a producción y el ambiente local |
| [Diagrama de clases](clases.md)                        | Servicios de la API, la interfaz `Conector` y el modelo del scoring     |
| [Diagrama entidad-relación](er.md)                     | Las 21 tablas con sus campos, llaves y reglas                           |
| [Modelo de datos](../data-model.md)                    | Estados de una solicitud y decisiones de protección de datos            |
| [ADR-002 Arquitectura](../adr/ADR-002-arquitectura.md) | Por qué esta división y las alternativas descartadas                    |

## Evolución y defensa de la arquitectura

| Documento                                                           | De qué trata                                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Plan de actualización de infraestructura](plan-infraestructura.md) | Cuatro fases con disparador, costo y criterio de éxito, hasta AWS                                    |
| [Monolito modular sin estado](monolito-sin-estado.md)               | Por qué es la decisión correcta, cómo se prueba en el código, qué la rompería y preguntas frecuentes |
