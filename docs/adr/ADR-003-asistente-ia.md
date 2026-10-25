# ADR-003: Asistente de IA, WhatsApp y lectura del cuaderno

- **Estado:** aceptada (pendiente de revisión del equipo)
- **Fecha:** 2026-10-25
- **Historias:** TND-035, TND-034, TND-057

## Contexto

En la prueba con doña Gloria, la mitad del tiempo se fue en sacar cuentas del cuaderno para llenar el formulario (T5). EMICRON confirma el patrón: el 49,5 % de las tiendas de Bogotá anota en cuaderno. Para que TendIA tenga datos de ventas reales sin datáfono, el tendero tiene que poder registrar ventas y fiados en segundos, en su propio lenguaje y en el canal que ya usa: WhatsApp.

## Decisión

1. **Asistente "Tendi"** (`services/api/src/asistente`). Usa Claude con _tool use_ mediante el tool runner del SDK de Anthropic: `registrar_venta`, `registrar_fiado`, `marcar_fiado_pagado`, `consultar_resumen` y `consultar_solicitud`. Las herramientas solo escriben en el negocio del tendero autenticado. El modelo nunca calcula ni cambia el puntaje.
2. **Sin IA no se cae**: si no hay `ANTHROPIC_API_KEY`, o Claude falla o se demora, un intérprete de reglas (`interprete.ts`) entiende "hoy vendí 350 mil", "le fié 20 mil a don Pedro", "don Pedro me pagó" y "¿cómo voy?".
3. **Un solo asistente, dos canales**: la app (`POST /asistente/mensajes`) y WhatsApp (`POST /whatsapp/webhook`, Twilio). El webhook valida `X-Twilio-Signature` (HMAC-SHA1 de `PUBLIC_API_URL` + parámetros ordenados) y solo atiende números registrados como tenderos.
4. **Lectura del cuaderno por foto**: Claude con visión devuelve una salida estructurada (Zod) con fechas, ventas y fiados. Nada se guarda sin que el tendero confirme ("SÍ" por WhatsApp o "Guardar" en la app); la foto no se almacena, solo la lectura.
5. **Memoria de lo que ya hizo**: cada respuesta guarda las acciones que ejecutó (`MensajeAsistente.acciones`). Al armar el historial para Claude, cada respuesta anterior lleva "[Ya guardado en ese turno: …]", el contexto incluye el resumen actual de ventas y fiados, y el prompt prohíbe volver a anotar algo de un mensaje anterior. Sin esto, en la prueba con Claude real, Tendi "corrigió" un turno anterior y registró dos veces el mismo fiado.
6. **Avisos de decisión**: cuando la entidad aprueba, rechaza o pide garantía, la app muestra un aviso hasta que el tendero lo ve, y si Twilio está configurado también llega por WhatsApp desde el sandbox (`TWILIO_WHATSAPP_FROM`). Un fallo al avisar nunca tumba la decisión.
7. **Ventas diarias → puntaje**: un mes con 7 o más días registrados se suma como venta mensual declarada. Si el tendero ya escribió el total de ese mes, se respeta el total.

## Consecuencias

- Los datos del cuaderno son declarados: pesan como fuente `MANUAL`, por debajo del datáfono y de Open Finance.
- Mensajes y lecturas son datos personales (Ley 1581): se borran con la cuenta y no se usan para entrenar modelos.
- Costo de IA por mensaje con `effort: low` y máximo 6 iteraciones de herramientas. Medir en piloto.
- Twilio WhatsApp necesita un número aprobado para producción. Para el piloto basta el sandbox.
