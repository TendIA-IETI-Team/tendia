# Prueba de usabilidad del MVP con tenderos (TND-080)

Objetivo: saber dónde se confunden 3 a 5 tenderos antes de la entrega, con el MVP real en un celular. La primera prueba, con doña Gloria (Kennedy), cambió T2, T5, T7 y T9: tres franjas en vez de cinco niveles, "lo que tú nos cuentas" en vez de "auto-reportado", y quién revisa en vez de "en revisión".

## Participantes

| #   | Perfil                                                        | Cómo llegar                           | Celular de prueba               |
| --- | ------------------------------------------------------------- | ------------------------------------- | ------------------------------- |
| 1   | Doña Gloria, tienda en Kennedy, anota en cuaderno (si acepta) | Contacto de la primera prueba         | `300 000 0002` (caída en enero) |
| 2   | Tendero con datáfono                                          | Barrio de algún integrante del equipo | `300 000 0001`                  |
| 3   | Tendero sin datáfono, negocio de menos de 1 año               | Barrio de algún integrante del equipo | `300 000 0004`                  |
| 4-5 | Opcional: minimercado y tienda de un pueblo cercano           | Referidos                             | `300 000 0005` a `300 000 0999` |

Antes de empezar: leer el consentimiento de la prueba, aclarar que **no es un crédito real** y que se puede parar en cualquier momento. No se graba la cara ni se guardan datos reales: solo los celulares de prueba.

## Tareas

Se dice la tarea en voz alta y no se ayuda. Si pasan 2 minutos sin avanzar, se da una pista y se anota.

| #   | Tarea (lo que se le dice)                                                                    | Pantallas          | Éxito                                          |
| --- | -------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------- |
| 1   | "Entra a la app con este celular."                                                           | Ingreso, OTP       | Llega al inicio                                |
| 2   | "Pide 3 millones para surtir la tienda, a 6 meses."                                          | T1                 | Solicitud creada                               |
| 3   | "Deja que TendIA vea tus ventas del datáfono, pero no tu cuenta del banco."                  | T2                 | Solo autoriza datáfono                         |
| 4   | "¿Cómo te fue? ¿Es bueno o malo tu puntaje? ¿Por qué?"                                       | T7                 | Explica la franja y un factor con sus palabras |
| 5   | "En enero vendiste poco por unas obras. Cuéntaselo a TendIA."                                | T8                 | Justifica enero y ve el recálculo              |
| 6   | "Anota con Tendi que hoy vendiste 200 mil y le fiaste 15 mil a doña Rosa."                   | Asistente          | Ambas cosas quedan en "Mi cuaderno"            |
| 7   | "Manda tu solicitud al Banco Demo Popular."                                                  | T9                 | Sabe quién la revisa                           |
| 8   | (El facilitador pide garantía desde el portal.) "Te llegó algo. ¿Qué te piden y qué es eso?" | Aviso, T10         | Explica el FNG o el codeudor como un respaldo  |
| 9   | "Quita el permiso del datáfono."                                                             | Mis autorizaciones | Revoca y entiende que se borran esos datos     |

## Métricas por tarea

- **Completada:** sí, con pista o no.
- **Tiempo:** desde que se dice la tarea hasta el éxito.
- **Dudas:** cada vez que pregunta, duda más de 5 segundos o toca algo equivocado. Anotar la palabra o el botón.
- **Al final:** "Del 1 al 5, ¿qué tan fácil fue?" (la misma pregunta de la app, TND-081) y "¿Se lo recomendarías a otro tendero? ¿Por qué?".

## Plantilla de registro

| Participante | Tarea | Completada | Tiempo | Dudas (textual) | Gravedad (1 a 3) |
| ------------ | ----- | ---------- | ------ | --------------- | ---------------- |
|              |       |            |        |                 |                  |

Gravedad: **1** se recupera sola, **2** necesita pista, **3** abandona.

## Después de la prueba

1. Unir los registros en una tabla y contar cuántos participantes tuvieron cada problema.
2. Cada problema de gravedad 2 o 3, o que le pase a 2 o más personas, se abre como issue con la etiqueta `research`, la pantalla (T1 a T13), la cita textual y la propuesta de cambio.
3. Resumir los hallazgos y los issues creados como comentario en TND-080, y agregar una sección "Validación con usuarios" al README.
