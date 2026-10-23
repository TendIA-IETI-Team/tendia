# Modelo de datos

Fuente de verdad: [`services/api/prisma/schema.prisma`](../services/api/prisma/schema.prisma). Las migraciones están en `services/api/prisma/migrations` y corren en limpio con `prisma migrate deploy` sobre un Postgres nuevo, incluido el de un proyecto Supabase.

```mermaid
erDiagram
  Tendero ||--o| Negocio : tiene
  Tendero ||--o{ Consentimiento : otorga
  Tendero ||--o{ Solicitud : crea
  Negocio ||--o{ DatoMensual : acumula
  Aliado ||--o{ Usuario : emplea
  Aliado ||--o| Politica : define
  Aliado ||--o{ Solicitud : revisa
  Aliado ||--o{ ApiKey : emite
  ApiKey ||--o{ ConsumoApi : registra
  Solicitud ||--o{ Score : "v1 original, v2 con variaciones"
  Solicitud ||--o{ Variacion : justifica
  Solicitud ||--o| Garantia : pide

  Tendero { uuid id string celularHash string celularCifrado string cedulaCifrada }
  Negocio { uuid id string nombre int antiguedadMeses int ventasMensualesDeclaradas }
  Consentimiento { uuid id enum fuente string proveedor string versionTexto datetime revocadoEn }
  DatoMensual { string mes enum fuente int ventas int compras int facturas int pagadasATiempo }
  Solicitud { uuid id int monto string destino enum estado json calidadDatos }
  Score { int version int puntaje float probabilidadIncumplimiento json contribuciones json explicacion }
  Variacion { string mes string motivo }
  Garantia { enum tipo string respuesta enum estado }
  Aliado { uuid id string nombre enum tipo }
  Usuario { string email enum rol bool mfaActivo }
  Politica { int scoreMinAprobar int scoreMinConGarantia int montoMaximo }
  ApiKey { string prefijo string hash datetime revocadaEn }
  ConsumoApi { string endpoint int estado datetime creadoEn }
  Auditoria { string actorTipo string accion string entidad datetime creadoEn }
```

## Estados de una solicitud

```mermaid
stateDiagram-v2
  [*] --> BORRADOR: T1 solicitar
  BORRADOR --> DATOS_INCOMPLETOS: evaluar sin datos suficientes
  BORRADOR --> SCORE_LISTO: evaluar
  DATOS_INCOMPLETOS --> SCORE_LISTO: T5 completar y evaluar
  SCORE_LISTO --> SCORE_LISTO: T8 justificar variación (score v2)
  SCORE_LISTO --> ENVIADA: T9 enviar al aliado
  ENVIADA --> APROBADA: A2 aprobar
  ENVIADA --> RECHAZADA: A2 rechazar
  ENVIADA --> GARANTIA_SOLICITADA: A2 pedir garantía
  GARANTIA_SOLICITADA --> GARANTIA_ENVIADA: T10 responder
  GARANTIA_ENVIADA --> APROBADA: A3 aceptar
  GARANTIA_ENVIADA --> RECHAZADA: A4 rechazar
```

## Decisiones de protección de datos

- **Celular:** se guarda cifrado (AES-256-GCM) junto con un HMAC para buscarlo sin descifrarlo. La cédula también se cifra.
- **Consentimiento:** uno por fuente, con versión del texto aceptado. Revocarlo borra los `DatoMensual` de esa fuente.
- **Aliados:** solo ven solicitudes que el tendero les envió (`aliadoId` + estados visibles). Una solicitud de otro aliado responde 404.
- **Auditoría:** guarda IDs y acciones, nunca datos personales.
