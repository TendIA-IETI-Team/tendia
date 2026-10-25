# Modelo de datos

Fuente de verdad: [`services/api/prisma/schema.prisma`](../services/api/prisma/schema.prisma). Las migraciones están en `services/api/prisma/migrations` y corren en limpio con `prisma migrate deploy` sobre un Postgres nuevo, incluido el de un proyecto Supabase.

```mermaid
erDiagram
  Tendero ||--o| Negocio : tiene
  Tendero ||--o{ Consentimiento : otorga
  Tendero ||--o{ Solicitud : crea
  Tendero ||--o{ MensajeAsistente : conversa
  Tendero ||--o{ ExtraccionCuaderno : fotografia
  Negocio ||--o{ DatoMensual : acumula
  Negocio ||--o{ VentaDiaria : anota
  Negocio ||--o{ Fiado : fia
  Aliado ||--o{ Usuario : emplea
  Aliado ||--o{ Invitacion : invita
  Aliado ||--o| Politica : define
  Aliado ||--o{ Solicitud : revisa
  Aliado ||--o{ ApiKey : emite
  ApiKey ||--o{ ConsumoApi : registra
  Solicitud ||--o{ Score : "v1 original, v2 con variaciones"
  Solicitud ||--o{ Variacion : justifica
  Solicitud ||--o| Garantia : pide
  Solicitud ||--o{ Adjunto : "evidencia T8, documento T10"

  Tendero { uuid id string celularHash string celularCifrado string cedulaCifrada }
  Negocio { uuid id string nombre int antiguedadMeses int ventasMensualesDeclaradas }
  Consentimiento { uuid id enum fuente string proveedor string versionTexto string finalidad string referencia datetime revocadoEn }
  DatoMensual { string mes enum fuente int ventas int transacciones int compras int facturas int pagadasATiempo int pagado int cupo }
  VentaDiaria { string fecha int monto string canal }
  Fiado { string cliente int monto string fecha datetime pagadoEn }
  MensajeAsistente { string rol string contenido string canal json acciones }
  ExtraccionCuaderno { json datos string estado string canal }
  Solicitud { uuid id int monto string destino enum estado json calidadDatos int montoAprobado int plazoAprobado float tasaAprobada enum estadoVisto int satisfaccion }
  Score { int version int puntaje float probabilidadIncumplimiento json segmento json componentes json contribuciones json indicadores json explicacion }
  Adjunto { string proposito string mes string nombre string tipo int tamano bytes datos }
  Variacion { string mes string motivo }
  Garantia { enum tipo string respuesta enum estado }
  Aliado { uuid id string nombre enum tipo }
  Usuario { string email enum rol bool mfaActivo int intentosFallidos datetime bloqueadoHasta }
  Invitacion { string email enum rol string tokenHash datetime expiraEn datetime usadaEn }
  Politica { int scoreMinAprobar int scoreMinConGarantia int montoMaximo }
  ApiKey { string prefijo string hash datetime revocadaEn }
  ConsumoApi { string endpoint int estado datetime creadoEn }
  Auditoria { string actorTipo string accion string entidad string finalidad datetime creadoEn }
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
- **Consentimiento:** guarda además la finalidad y la referencia que devolvió el conector al autorizar (TND-020).
- **Aliados (TND-012):** solo ven solicitudes que el tendero les envió (`aliadoId` + estados visibles). Una solicitud de otro aliado responde 404. Además, **Postgres lo impone con Row Level Security**: el portal lee dentro de una transacción con el rol `tendia_aliado` y `app.aliado_id`, y las políticas de `Solicitud`, `Score`, `Variacion`, `Garantia`, `Adjunto`, `Tendero`, `Negocio`, `DatoMensual` y `Politica` solo devuelven filas de ese aliado, aunque una consulta olvide el filtro. Todas las tablas tienen RLS activo, así que los roles `anon` y `authenticated` de Supabase no leen nada.
- **Roles:** `TENDERO` (app), `ANALISTA` y `ADMIN_ALIADO` (portal de cada aliado) y `ADMIN_TENDIA` (equipo de TendIA, sin aliado: bitácora por tendero y satisfacción global).
- **Auditoría (TND-022):** guarda IDs, acción y **finalidad**, nunca datos personales. Un trigger rechaza `UPDATE` y `DELETE`: nadie la edita desde la aplicación.
- **Adjuntos:** máximo 5 MB, solo JPG, PNG, WEBP o PDF, con la firma del archivo verificada. Se descargan solo con sesión del aliado que recibió la solicitud, y cada descarga queda en la bitácora.
- **Asistente:** `MensajeAsistente.acciones` guarda lo que Tendi anotó en cada turno, para que no lo vuelva a anotar al leer el historial.
