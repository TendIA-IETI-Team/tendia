# Diagrama de clases

Nivel 4 del [modelo C4](c4.md): las clases principales con los nombres que tienen en el código. Las entidades persistentes (Tendero, Solicitud, Score…) son modelos de Prisma y están en el [diagrama entidad-relación](er.md).

## API: dominio de la solicitud

```mermaid
classDiagram
  direction LR

  class SolicitudesService {
    +crear(tenderoId, CrearSolicitudDto)
    +evaluar(tenderoId, id)
    +justificar(tenderoId, id, VariacionDto)
    +quitarVariacion(tenderoId, id, mes)
    +enviar(tenderoId, id, aliadoId)
    +responderGarantia(tenderoId, id, RespuestaGarantiaDto)
    +satisfaccion(tenderoId, id, SatisfaccionDto)
    +cancelar(tenderoId, id)
    +vista(solicitud, tasas)
  }
  class EvaluacionService {
    +fuentesConsentidas(tenderoId) FuenteTipo[]
    +recolectar(negocio, fuentes)
    +construirRequest(solicitud, negocio, version) ScoreRequest
    +calcular(solicitud, negocio, version) ScoreResponse
  }
  class TenderoService {
    +perfil(tenderoId)
    +actualizarNegocio(tenderoId, NegocioDto)
    +ventasManuales(tenderoId, meses)
    +autorizar(tenderoId, ConsentimientoDto)
    +revocar(tenderoId, consentimientoId)
  }
  class AliadoService {
    +bandeja(actor, estado)
    +detalle(actor, id)
    +decidir(actor, id, DecisionDto)
    +evaluarGarantia(actor, id, EvaluarGarantiaDto)
    +guardarPolitica(actor, PoliticaDto)
    +crearApiKey(actor, CrearApiKeyDto)
    +invitar(actor, InvitacionDto)
    +auditoria(actor)
  }
  class ConectoresService {
    +porFuente(fuente) Conector
    +catalogo()
  }
  class Conector {
    <<interface>>
    +fuente FuenteTipo
    +proveedores string[]
    +simulado boolean
    +autorizar(negocio, proveedor) referencia
    +recolectar(negocio, meses, hasta) RegistroMensual[]
    +estado() EstadoConector
  }
  class ConectorSimulado {
    <<abstract>>
    +autorizar(negocio, proveedor)
    +estado()
  }
  class DatafonoSimulado
  class DistribuidorSimulado
  class OpenFinanceSimulado
  class ScoringClient {
    +score(ScoreRequest, requestId) ScoreResponse
    +scoreRaw(body, requestId)
    +referencias() Referencias
    +health() boolean
  }
  class ExplicacionService {
    +explicar(ScoreResponse) Explicacion
    +esSegura(Explicacion) boolean
    +plantilla(ScoreResponse) Explicacion
  }
  class NotificadorService {
    +cambioDeEstado(solicitudId)
  }
  class AuditService {
    +log(AuditEntry)
  }
  class PrismaService {
    +onModuleInit()
    +onModuleDestroy()
  }

  SolicitudesService --> EvaluacionService
  SolicitudesService --> ExplicacionService
  SolicitudesService --> AuditService
  EvaluacionService --> ConectoresService
  EvaluacionService --> ScoringClient
  ConectoresService o-- Conector
  Conector <|.. ConectorSimulado
  ConectorSimulado <|-- DatafonoSimulado
  ConectorSimulado <|-- DistribuidorSimulado
  ConectorSimulado <|-- OpenFinanceSimulado
  TenderoService --> ConectoresService
  TenderoService --> AuditService
  AliadoService --> NotificadorService
  AliadoService --> AuditService
  SolicitudesService ..> PrismaService
  AliadoService ..> PrismaService
  TenderoService ..> PrismaService
```

Un conector real (Bold, Treinta, Belvo) implementa `Conector` y se registra en `ConectoresService`; nada más cambia.

## API: identidad, asistente y API pública

```mermaid
classDiagram
  direction LR

  class AuthService {
    +requestOtp(celular)
    +verifyOtp(celular, codigo) accessToken
    +loginAliado(email, password) mfaToken
    +verifyMfa(mfaToken, codigo) accessToken
    +verInvitacion(token)
    +aceptarInvitacion(token, password)
  }
  class OtpSender {
    +canal(celular) CanalOtp
    +enviar(celular)
    +verificar(celular, codigo) boolean
  }
  class AuthGuard {
    <<CanActivate>>
    +canActivate(contexto) boolean
  }
  class ApiKeyGuard {
    <<CanActivate>>
    +canActivate(contexto) boolean
  }
  class PublicApiController {
    +score(req, body)
  }
  class AsistenteService {
    +historial(tenderoId, limite)
    +responder(tenderoId, texto, canal) RespuestaAsistente
    +herramientas(tenderoId, canal, acciones)
    +conReglas(tenderoId, texto, canal)
  }
  class RegistrosService {
    +registrarVenta(tenderoId, monto, canal, fecha)
    +registrarFiado(tenderoId, cliente, monto, canal)
    +pagarFiado(tenderoId, opciones)
  }
  class CuadernoService {
    +leer(tenderoId, imagenBase64, tipo, canal)
    +pendiente(tenderoId)
    +confirmar(tenderoId, id, corregido)
    +descartar(tenderoId, id)
  }
  class Anthropic {
    <<externo>>
  }

  AuthService --> OtpSender
  PublicApiController ..> ApiKeyGuard : protegido por
  PublicApiController --> ScoringClient
  PublicApiController --> ExplicacionService
  AsistenteService --> RegistrosService
  AsistenteService --> Anthropic
  CuadernoService --> RegistrosService
  CuadernoService --> Anthropic
  ExplicacionService --> Anthropic
  class ScoringClient
  class ExplicacionService
```

`AuthGuard` es global: toda ruta exige un JWT con el rol correcto salvo las marcadas `@Public()`. La API pública usa `ApiKeyGuard` con la llave en `x-api-key`.

## Scoring

```mermaid
classDiagram
  direction LR

  class ScoreRequest {
    +business Business
    +sales SalesMonth[]
    +distributor DistributorMonth[]
    +adjustments Adjustment[]
  }
  class ScoreResponse {
    +contract_version
    +model_version
    +score int
    +band Band
    +probability_default float
    +components ComponentScore[]
    +contributions Contribution[]
    +segment Segment
    +indicators Indicators
    +data_quality DataQuality
  }
  class FeatureResult {
    +values dict
    +quality DataQuality
    +adjusted_months str[]
  }
  class ModeloTendIA {
    +version str
    +componentes Componente[]
    +segmentacion dict
    +score(values) int
    +probability_default(values) float
    +contributions(values) Contribution[]
    +components(contribs) ComponentScore[]
    +load(path)$ ModeloTendIA
  }
  class Componente {
    +nombre str
    +variables str[]
    +intercept float
    +coefficients dict
    +bins dict~str, FeatureBins~
    +peso float
    +ln_odds(values) dict
  }
  class FeatureBins {
    +edges float[]
    +woe float[]
    +woe_for(value) float
  }
  class MesPago {
    +facturado float
    +pagado float
    +meses_mora int
    +cupo float
  }

  ScoreRequest ..> FeatureResult : compute_features()
  ScoreRequest ..> MesPago : historial_pagos()
  FeatureResult ..> ModeloTendIA : values
  ModeloTendIA *-- Componente : pagos y negocio
  Componente *-- FeatureBins
  ModeloTendIA ..> ScoreResponse
```

Cada `Componente` es un scorecard WoE con regresión logística. El puntaje es la suma de los puntos de cada variable, así que las contribuciones explican el resultado exacto.
