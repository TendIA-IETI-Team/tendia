<p align="center">
  <img src="docs/brand/tendia-logo.png" alt="TendIA" width="112">
</p>

<h1 align="center">TendIA</h1>

<p align="center">
  <b>Crédito basado en tu negocio, no en tu pasado bancario.</b><br>
  Un Puntaje TendIA de 0 a 1000, explicado en lenguaje sencillo, para las tiendas de barrio de Colombia.
</p>

<p align="center">
  <a href="https://tendia-landing.vercel.app"><img alt="Conoce TendIA" src="https://img.shields.io/badge/Conoce%20TendIA-F38B54?style=for-the-badge&logo=vercel&logoColor=white"></a>
  <a href="https://tendia-app.vercel.app/app"><img alt="Abrir la app del tendero" src="https://img.shields.io/badge/App%20del%20tendero-362D7C?style=for-the-badge&logo=expo&logoColor=white"></a>
  <a href="https://tendia-app.vercel.app"><img alt="Abrir el portal del aliado" src="https://img.shields.io/badge/Portal%20del%20aliado-362D7C?style=for-the-badge&logo=nextdotjs&logoColor=white"></a>
  <a href="https://tendia-app.vercel.app/api/docs"><img alt="Ver la API" src="https://img.shields.io/badge/API%20pública-1F1A4D?style=for-the-badge&logo=swagger&logoColor=white"></a>
</p>

<p align="center">
  <a href="https://github.com/TendIA-IETI-Team/tendia/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/TendIA-IETI-Team/tendia/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Modelo" src="https://img.shields.io/badge/modelo-tendia--v2%20·%20AUC%200%2C741-F38B54">
  <img alt="Datos reales" src="https://img.shields.io/badge/datos-UCI%20·%20DANE%20·%20Superfinanciera-F38B54">
</p>

<p align="center">
  <img alt="Expo" src="https://img.shields.io/badge/Expo%20SDK-58-000020?logo=expo&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.162-009688?logo=fastapi&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/Postgres-16%20%2B%20RLS-4169E1?logo=postgresql&logoColor=white">
  <img alt="Claude" src="https://img.shields.io/badge/IA-Claude-D97757?logo=anthropic&logoColor=white">
  <img alt="Twilio" src="https://img.shields.io/badge/Twilio-Verify%20%2B%20WhatsApp-F22F46?logo=twilio&logoColor=white">
  <img alt="Sentry" src="https://img.shields.io/badge/Sentry-errores-362D57?logo=sentry&logoColor=white">
</p>

<p align="center">
  <a href="#-pruébalo-ya">Pruébalo</a> ·
  <a href="#-así-se-ve">Capturas</a> ·
  <a href="#-recorridos-completos">Recorridos</a> ·
  <a href="#-cómo-funciona">Arquitectura</a> ·
  <a href="#-modelo-y-datos-reales">Modelo</a> ·
  <a href="#-modelo-de-negocio">Negocio</a> ·
  <a href="#-inteligencia-artificial">IA</a> ·
  <a href="#-seguridad-y-ley-1581">Seguridad</a> ·
  <a href="#-correr-en-local">Local</a> ·
  <a href="#-estado-y-próximos-pasos">Estado</a> ·
  <a href="#-documentación">Docs</a>
</p>

<table align="center">
  <tr>
    <td align="center" width="25%"><h2>9,6 %</h2><sub>de las tiendas de Bogotá que pidieron crédito acudió al <b>gota a gota</b> (EMICRON 2024)</sub></td>
    <td align="center" width="25%"><h2>0 – 1000</h2><sub>Puntaje TendIA con cada factor <b>explicado</b> en palabras sencillas</sub></td>
    <td align="center" width="25%"><h2>AUC 0,741</h2><sub>con <b>30.000 créditos reales</b>, en un modelo que se explica variable por variable</sub></td>
    <td align="center" width="25%"><h2>Mes 5</h2><sub><b>punto de equilibrio</b> con 10 entidades que pagan desde el mes 1</sub></td>
  </tr>
</table>

---

## 🏪 El problema

Una tienda de barrio vende todos los días, pero el sistema financiero no la ve: no tiene historial bancario ni estados financieros, y lleva las cuentas en un cuaderno. Según la **Encuesta de Micronegocios del DANE (EMICRON 2024)**, de las tiendas de Bogotá que pidieron crédito, **el 9,6 % acudió al gota a gota**, que cobra entre 382 % y 666 % al año.

**TendIA** convierte la actividad real de la tienda (ventas con datáfono, pagos al distribuidor, lo que el tendero anota en su cuaderno) en un **Puntaje TendIA de 0 a 1000 explicado**. El tendero lo ve, puede justificarlo y decide con qué entidad compartirlo.

> [!IMPORTANT]
> TendIA **no presta dinero** ni es una central de riesgo. Vende la evaluación de riesgo a bancos, fintechs, microfinancieras y distribuidores (B2B2C), y **el tendero nunca paga**.

```mermaid
flowchart LR
  d["🧾 Ventas con datáfono<br>🚚 Pagos al distribuidor<br>📒 Cuaderno y Tendi"] --> p(("⭐ Puntaje<br>0 – 1000"))
  p --> t["🏪 El tendero lo entiende,<br>lo justifica y decide<br>con quién compartirlo"]
  t --> e["🏦 La entidad decide<br>en minutos, con la razón<br>de cada punto"]
```

Diseñado con tenderos reales: la primera prueba, con doña Gloria en Kennedy, cambió cinco niveles por tres franjas y "auto-reportado" por "lo que tú nos cuentas" ([prueba de usabilidad](docs/usabilidad.md)).

| Para el tendero                                                                           | Para la entidad (aliado)                                                                  |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Entra con su celular y un código por SMS                                                  | Portal con MFA obligatorio, roles y equipo                                                |
| Autoriza cada fuente con palabras sencillas, y la revoca cuando quiera                    | Bandeja con puntaje, franja y sugerencia según su política de riesgo                      |
| Ve su puntaje sobre 1000, qué le suma y qué le resta                                      | Explicación variable por variable (SARC), indicadores del negocio y tasa real del mercado |
| Justifica un mes malo con una foto, y el puntaje se recalcula                             | Evidencias y documentos de garantía adjuntos                                              |
| Anota ventas y fiados hablando con **Tendi** (app o WhatsApp) o con una foto del cuaderno | API pública con llaves, consumo por mes y bitácora de accesos                             |
| Recibe el aviso cuando la entidad decide                                                  | Satisfacción de sus tenderos en un tablero                                                |

## 🚀 Pruébalo ya

| Qué                                     | Dónde                                                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Página de TendIA** (empieza aquí)     | https://tendia-landing.vercel.app: qué es TendIA y enlaces a la app, al portal y a la API                                                                       |
| **Portal del aliado**                   | https://tendia-app.vercel.app                                                                                                                                   |
| **API pública y documentación OpenAPI** | https://tendia-app.vercel.app/api/docs                                                                                                                          |
| Salud de la API (versión desplegada)    | https://tendia-app.vercel.app/api/health                                                                                                                        |
| Motor de scoring                        | Servicio **privado** en Vercel: solo la API lo llama                                                                                                            |
| **App del tendero**                     | https://tendia-app.vercel.app/app (versión web, ábrela desde el celular). En Expo Go o un build de EAS: `EXPO_PUBLIC_API_URL=https://tendia-app.vercel.app/api` |

**Cuentas de demostración** (staging y local, contraseña `TendIA-demo-2026!`):

| Cuenta                  | Rol                                  | Qué puede hacer                                               |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------- |
| `admin@bancodemo.co`    | Administrador del Banco Demo Popular | Todo: solicitudes, política, llaves de API, equipo, auditoría |
| `analista@bancodemo.co` | Analista del Banco Demo Popular      | Revisar y decidir solicitudes                                 |
| `admin@microdemo.co`    | Administrador de Microcrédito Demo   | Ver que no accede a las solicitudes del banco                 |
| `admin@tendia.co`       | Equipo TendIA                        | Alta de aliados, bitácora de cualquier tendero y satisfacción |

El primer ingreso pide escanear un QR con Google Authenticator o similar. Si la cuenta ya lo tenía activado y no tienes el código, reinícialo: `docker compose exec api node dist/scripts/reset-mfa.js <correo>` (en staging, desde tu computador con las variables de Vercel: ver [docs/deploy.md](docs/deploy.md#reiniciar-el-mfa-en-staging)).

**Celulares de demostración** para la app. Ven el código en pantalla aunque Twilio esté configurado, porque nadie es dueño de esos números:

| Celular                         | Perfil simulado                             | Para mostrar                                |
| ------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `300 000 0001`                  | Buen negocio                                | Puntaje alto y aprobación                   |
| `300 000 0002`                  | Caída fuerte en enero                       | Justificar una variación con evidencia (T8) |
| `300 000 0003`                  | Negocio riesgoso                            | Rechazo con consejos para mejorar           |
| `300 000 0004`                  | Negocio nuevo                               | Datos incompletos → completar a mano (T5)   |
| `300 000 0005` a `300 000 0999` | Negocio simulado distinto pero reproducible | Pruebas automáticas y demos                 |

Con tu propio celular, el código llega por SMS de verdad (Twilio Verify). En una cuenta de prueba de Twilio, solo a números verificados en la consola.

## 📸 Así se ve

> Capturas tomadas de la aplicación corriendo con Docker, con Claude real y datos sembrados por la API.

### App del tendero

<table>
  <tr>
    <td align="center"><img src="docs/img/app-ingreso.png" width="200" alt="Ingreso con OTP"><br><sub><b>Ingreso</b> · celular y código</sub></td>
    <td align="center"><img src="docs/img/app-inicio.png" width="200" alt="Inicio"><br><sub><b>Inicio</b> · su solicitud, su puntaje y Tendi a un toque</sub></td>
    <td align="center"><img src="docs/img/app-puntaje.png" width="200" alt="Puntaje TendIA"><br><sub><b>T7</b> · Puntaje sobre 1000 con su franja</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/img/app-tendi.png" width="200" alt="Chat con Tendi"><br><sub><b>Tendi</b> · asistente con Claude</sub></td>
    <td align="center"><img src="docs/img/app-cuaderno.png" width="200" alt="Mi cuaderno"><br><sub><b>Mi cuaderno</b> · foto, a mano o con Tendi</sub></td>
    <td align="center"><img src="docs/img/app-completar.png" width="200" alt="Completar información"><br><sub><b>T5</b> · día normal y día flojo</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/img/app-aviso-decision.png" width="200" alt="Aviso de decisión"><br><sub><b>T11</b> · aviso de la decisión</sub></td>
    <td align="center"><img src="docs/img/app-aprobado.png" width="200" alt="Crédito aprobado"><br><sub><b>T12</b> · aprobado con monto, plazo y tasa</sub></td>
    <td align="center"><img src="docs/img/app-rechazo.png" width="200" alt="Rechazo con consejos"><br><sub><b>T13</b> · rechazo con consejos</sub></td>
  </tr>
</table>

<details>
<summary><b>Leer el cuaderno con una foto</b> (Claude con visión)</summary>
<br>
<img src="docs/img/cuaderno-ejemplo.jpg" width="300" alt="Hoja de cuaderno">

Claude leyó esta hoja así, y nada se guardó hasta que el tendero confirmó:

| Fecha  | Ventas   | Fiados            |
| ------ | -------- | ----------------- |
| 20 oct | $285.000 | —                 |
| 21 oct | $310.000 | doña Rosa $15.000 |
| 22 oct | $198.000 | —                 |
| 23 oct | $342.000 | don Pedro $20.000 |
| 24 oct | $401.000 | —                 |

</details>

### Portal del aliado

<p align="center"><img src="docs/img/portal-bandeja.png" alt="Bandeja de solicitudes" width="900"><br><sub><b>A1</b> · Bandeja con puntaje, franja, segmento, factores principales y sugerencia según la política</sub></p>

<p align="center"><img src="docs/img/portal-detalle.png" alt="Detalle de una solicitud" width="900"><br><sub><b>A2</b> · Qué pesó en el puntaje, explicación con IA y condiciones de aprobación con la tasa real del mercado</sub></p>

<details>
<summary><b>Ver la solicitud completa</b>: variación con evidencia, indicadores, segmento DANE, tasas de la Superfinanciera y pagos al proveedor</summary>
<p align="center"><img src="docs/img/portal-detalle-completo.png" alt="Detalle completo" width="800"></p>
</details>

<table>
  <tr>
    <td><img src="docs/img/portal-garantia.png" alt="Evaluar garantía"><br><sub><b>A3</b> · Garantía con el documento que adjuntó el tendero</sub></td>
    <td><img src="docs/img/portal-admin-bitacora.png" alt="Bitácora por tendero"><br><sub><b>Equipo TendIA</b> · quién vio los datos de un tendero, cuándo y para qué</sub></td>
  </tr>
  <tr>
    <td><img src="docs/img/portal-equipo.png" alt="Equipo"><br><sub><b>Equipo</b> · invitar analistas por correo</sub></td>
    <td><img src="docs/img/portal-satisfaccion.png" alt="Satisfacción"><br><sub><b>Satisfacción</b> · calificación de los tenderos</sub></td>
  </tr>
  <tr>
    <td><img src="docs/img/portal-integraciones.png" alt="API y consumo"><br><sub><b>API y consumo</b> · llaves y consultas por mes</sub></td>
    <td><img src="docs/img/portal-mfa-qr.png" alt="MFA"><br><sub><b>MFA</b> · enrolamiento obligatorio en el primer ingreso</sub></td>
  </tr>
  <tr>
    <td><img src="docs/img/portal-politica.png" alt="Política de riesgo"><br><sub><b>Política de riesgo</b> · puntajes mínimos y monto máximo de cada entidad</sub></td>
    <td><img src="docs/img/portal-login.png" alt="Ingreso al portal"><br><sub><b>Ingreso</b> · correo y contraseña, luego el código de la app de autenticación</sub></td>
  </tr>
</table>

## 🎬 Recorridos completos

> Grabados con Claude en Chrome sobre la aplicación corriendo en local (Docker y Expo web), con Claude real, datos sembrados y los celulares de demostración. Cada recorrido es una de las pruebas de punta a punta que hicimos por rol.

### App del tendero

<table>
  <tr>
    <td align="center" valign="top"><img src="docs/img/gifs/app-solicitud.gif" width="230" alt="Solicitar un crédito"><br><sub><b>Solicitud</b> · código en pantalla, monto, fuentes autorizadas, puntaje explicado por Claude y envío al banco</sub></td>
    <td align="center" valign="top"><img src="docs/img/gifs/app-tendi-cuaderno.gif" width="230" alt="Tendi y cuaderno"><br><sub><b>Tendi y cuaderno</b> · botón 💬 Tendi, una venta y un fiado por chat, y Claude lee la foto del cuaderno</sub></td>
    <td align="center" valign="top"><img src="docs/img/gifs/app-justificar.gif" width="230" alt="Justificar un mes malo"><br><sub><b>T8</b> · enero justificado con foto: el puntaje sube 20 puntos</sub></td>
  </tr>
  <tr>
    <td align="center" valign="top"><img src="docs/img/gifs/app-garantia.gif" width="230" alt="Garantía y aprobación"><br><sub><b>T10 a T12</b> · responde la garantía con un PDF, recibe la aprobación y califica</sub></td>
    <td align="center" valign="top"><img src="docs/img/gifs/app-datos-incompletos.gif" width="230" alt="Datos incompletos"><br><sub><b>T5</b> · faltan pagos al proveedor: la app lleva a autorizarlos y calcula el puntaje</sub></td>
    <td></td>
  </tr>
</table>

### Portal del aliado

<p align="center"><img src="docs/img/gifs/portal-analista.gif" width="900" alt="Analista"><br><sub><b>Analista</b> · ingreso con verificación en dos pasos, bandeja, detalle con explicación de IA, pide garantía FNG, revisa el PDF del tendero y aprueba</sub></p>

<p align="center"><img src="docs/img/gifs/portal-admin-banco.gif" width="900" alt="Administrador del banco"><br><sub><b>Administrador del banco</b> · la política rechaza un valor inválido y se guarda, crea y revoca una llave de API, y la auditoría lo registra todo</sub></p>

<p align="center"><img src="docs/img/gifs/portal-alta-aliado.gif" width="900" alt="Alta de un aliado"><br><sub><b>Equipo TendIA</b> · da de alta una fintech; su administradora abre la invitación, crea su contraseña, escanea el QR y entra a su bandeja vacía</sub></p>

## 🧭 Cómo funciona

```mermaid
flowchart LR
  subgraph Clientes
    app[📱 App del tendero<br>Expo]
    wa[💬 WhatsApp]
    portal[🖥️ Portal del aliado<br>Next.js]
    core[🏦 Core del aliado]
  end
  subgraph TendIA en Vercel
    api[API TendIA<br>NestJS]
    scoring[Scoring privado<br>FastAPI]
  end
  db[(Postgres en Supabase<br>RLS + cifrado)]
  app --> api
  wa -- webhook firmado --> api
  portal --> api
  core -- x-api-key --> api
  api --> db
  api --> scoring
  api --> claude[Claude API<br>explicación, Tendi, cuaderno]
  api --> twilio[Twilio<br>Verify + WhatsApp]
  api --> conectores[Conectores<br>datáfono, distribuidor, Open Finance]
  api -.-> sentry[Sentry]
  scoring -.-> sentry
```

| Pieza                                  | Qué es                                                                                                 | Stack                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| [`apps/mobile`](apps/mobile)           | App del tendero (T1 a T13), Tendi y Mi cuaderno                                                        | Expo SDK 58, Expo Router, TypeScript |
| [`apps/portal`](apps/portal)           | Portal del aliado (A1 a A4), política, API, equipo, satisfacción, auditoría y administración de TendIA | Next.js 16, Tailwind                 |
| [`services/api`](services/api)         | Identidad, consentimientos, solicitudes, conectores, asistente, WhatsApp y API pública                 | NestJS 11, Prisma, Postgres          |
| [`services/scoring`](services/scoring) | Motor interpretable (dos scorecards WoE), segmentación y referencias de mercado                        | Python 3.12, FastAPI, scikit-learn   |
| [`packages/tokens`](packages/tokens)   | Paleta y tipografía de marca, con pruebas de contraste WCAG                                            | TypeScript                           |
| [`docs`](docs)                         | ADR, modelo de datos, model card, datos, plan de pruebas, legal, seguridad                             | Markdown                             |

La API es un **monolito modular sin estado**: un solo proceso con 14 módulos que no guarda nada en memoria, así que escala agregando instancias. El scoring ya es un servicio aparte. Los diagramas C4, de infraestructura, de clases y entidad-relación están en [docs/diseno](docs/diseno/README.md), junto con el [plan de crecimiento de la infraestructura](docs/diseno/plan-infraestructura.md) y [por qué un monolito](docs/diseno/monolito-sin-estado.md).

### El recorrido de una solicitud

```mermaid
sequenceDiagram
  autonumber
  actor T as Tendero
  participant A as API
  participant S as Scoring
  actor B as Analista del banco
  T->>A: Pide $3.000.000 (T1) y autoriza fuentes (T2)
  A->>A: Conectores traen 12 meses de ventas y pagos
  A->>S: /score (contrato v2)
  S-->>A: Puntaje 0-1000, franja, factores, segmento, indicadores
  A-->>T: Puntaje explicado con IA (T7)
  T->>A: Justifica enero con una foto (T8): puntaje v2
  T->>A: Comparte con el Banco Demo Popular (T9)
  B->>A: Revisa en el portal con MFA (A1) y pide garantía (A2)
  A-->>T: Aviso en la app y por WhatsApp
  T->>A: Responde y adjunta el PDF (T10)
  B->>A: Acepta con monto, plazo y tasa (A3, A4)
  A-->>T: Aprobado: detalle del crédito (T12) y pregunta de satisfacción
```

## 📊 Modelo y datos reales

El modelo `tendia-v2` es un **scorecard interpretable** (WoE + regresión logística) con dos componentes, en una escala **0-1000 con tres franjas**:

<p align="center">
  <img alt="Bajo: 0 a 499" src="https://img.shields.io/badge/Bajo-0%20–%20499-8C84C9?style=for-the-badge">
  <img alt="Medio: 500 a 649" src="https://img.shields.io/badge/Medio-500%20–%20649-5B4FB0?style=for-the-badge">
  <img alt="Bueno: 650 a 1000" src="https://img.shields.io/badge/Bueno-650%20–%201000-362D7C?style=for-the-badge">
</p>

Las franjas van en una rampa de índigo: el naranja nunca significa "malo", y un puntaje bajo se presenta como "En construcción", con consejos para subir ([marca](docs/brand.md)).

| Componente                                    | Peso | Entrenado con                                                                                              | Holdout                   |
| --------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Pagos al proveedor**                        | 1,0  | [UCI #350](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients): 30.000 créditos reales | **AUC 0,741 · Gini 0,48** |
| **Negocio** (ventas, estabilidad, antigüedad) | 0,5  | Sintéticos calibrados con [EMICRON 2024 (DANE)](https://microdatos.dane.gov.co/index.php/catalog/875)      | AUC 0,734 (sintético)     |

- **Segmentación real:** KMeans sobre **20.488 micronegocios de comercio** de EMICRON (consolidada, tradicional, joven, subsistencia), con cifras reales de cada segmento: ventas típicas, cuántos pidieron crédito, cuántos acudieron al gota a gota.
- **Tasas reales:** **5.992 créditos productivos** a tiendas de Bogotá de la [Superfinanciera](https://www.datos.gov.co/d/w9zh-vetq) (p25 48,8 %, mediana 61,9 %, p75 65,5 % E.A.), por entidad. El analista las ve al aprobar y el tendero en su puntaje.
- **Indicadores del negocio:** ticket promedio, regularidad de recompra, días entre compras, rotación y estacionalidad. Contexto para el analista; no cambian el puntaje.
- **Explicable por diseño:** cada variable aporta puntos frente a un negocio promedio y la suma es exacta. Un stacking de LR+HGB+RF ganó 0,04 de Gini y no se adoptó, porque no se explica variable por variable (SARC).

Detalle en la [model card](docs/model-card.md), el [diccionario de variables](docs/diccionario-variables.md) y las [fuentes de datos](docs/datos.md).

## 💼 Modelo de negocio

La entidad paga; **el tendero nunca paga**. Las cifras salen del modelo financiero a 36 meses ([planificación](docs/planificacion.md#modelo-financiero)).

| Concepto                 | Valor                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| Plan mensual por entidad | **$1.800.000** con 500 puntajes incluidos                           |
| Puntaje adicional        | **$3.500**                                                          |
| Costo de cada puntaje    | $1.075; el 89 % son datos externos y la IA cuesta $115              |
| Margen por cliente       | ~70 % desde el primer cliente                                       |
| Clientes                 | 10 entidades en el mes 1 y ~47 en el mes 36                         |
| Punto de equilibrio      | **Mes 5**                                                           |
| En tres años             | ~$2.281 millones de ingresos y ~$545 millones de utilidad operativa |
| Inversión que pedimos    | **$60 millones** de capital semilla y aporte de los socios          |

```mermaid
---
config:
  xyChart:
    height: 320
  themeVariables:
    xyChart:
      plotColorPalette: "#362D7C, #F38B54"
---
xychart-beta
  title "Ingresos (barras) y gastos (línea) por trimestre"
  x-axis ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"]
  y-axis "Millones de pesos" 0 --> 400
  bar [78, 89, 102, 117, 139, 158, 181, 206, 246, 280, 320, 365]
  line [84, 88, 91, 96, 127, 132, 139, 146, 193, 202, 213, 226]
```

Los gastos saltan al empezar el año 2 y el año 3 porque crecen la nómina (de $13,2 a $19,8 millones al mes en el año 2), el mercadeo y la infraestructura; aun así, desde el mes 5 los ingresos van por encima. La caja nunca baja de ~$39,7 millones (mes 5).

Clientes objetivo: cooperativas, microfinancieras, distribuidores que fían, fintechs y bancos. Usan el portal o la API pública.

## 🤖 Inteligencia artificial

TendIA usa **Claude** (Anthropic) en tres lugares. Ninguno calcula ni cambia el puntaje, y todos tienen un plan B sin IA.

| Dónde                              | Qué hace                                                                                                           | Sin `ANTHROPIC_API_KEY`                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| **Explicación del puntaje**        | Pone los factores del modelo en palabras sencillas; se valida contra frases prohibidas ("aprobado", "DataCrédito") | Plantilla                                  |
| **Tendi**, en la app y en WhatsApp | Con _tool use_ anota ventas y fiados, marca pagos, cuenta cómo va la solicitud y explica términos como "FNG"       | Intérprete de reglas ("hoy vendí 350 mil") |
| **Mi cuaderno**                    | Lee la foto de la hoja del cuaderno (visión + salida estructurada); el tendero confirma o corrige antes de guardar | Anotar a mano o con Tendi                  |

Tendi recuerda lo que ya anotó en cada turno, así que no repite registros al leer la conversación, y recibe cada mensaje de otro día con su fecha para no confundir "hoy". En la app se abre desde el inicio o con el botón **💬 Tendi** de la esquina inferior derecha en el puntaje, el seguimiento, el cuaderno, los datos que faltan y las autorizaciones. El webhook de WhatsApp valida la firma `X-Twilio-Signature`. Decisiones en [ADR-003](docs/adr/ADR-003-asistente-ia.md).

## 🔐 Seguridad y Ley 1581

- **Consentimiento por fuente** con versión del texto, fecha, finalidad y referencia del conector. Revocarlo **borra** los datos de esa fuente.
- **Celular y cédula cifrados** (AES-256-GCM) con HMAC para buscarlos sin descifrar.
- **MFA obligatorio** para analistas, bloqueo tras 5 intentos e invitaciones de un solo uso.
- **Aislamiento por aliado en dos capas:** la API filtra por el aliado del token y **Postgres lo impone con Row Level Security**, de modo que una consulta que olvide el filtro tampoco ve filas de otro aliado.
- **Bitácora inmutable:** cada lectura guarda quién, cuándo y **para qué**. Un trigger rechaza ediciones y borrados, y el equipo TendIA la consulta por tendero.
- **Sentry sin datos personales:** sin cuerpos, encabezados sensibles, cookies ni usuarios.
- **Revisión OWASP API Top 10** en [docs/security](docs/security/owasp-api-top10.md). `pnpm audit` está limpio.

## 💻 Correr en local

Requisitos: Docker Desktop.

```bash
docker compose up --build
```

| Qué                         | Dónde                                        |
| --------------------------- | -------------------------------------------- |
| Portal del aliado           | http://localhost:3000                        |
| API + documentación OpenAPI | http://localhost:4000/docs                   |
| Scoring                     | http://localhost:8000/docs                   |
| Postgres                    | `localhost:55432` (usuario y clave `tendia`) |

App del tendero: `cd apps/mobile && npm install && npx expo start` (Expo Go en el celular o `w` para web). En un celular físico, crea `apps/mobile/.env` con `EXPO_PUBLIC_API_URL=http://<IP de tu computador>:4000`.

<details>
<summary><b>Probar con tus servicios reales</b>: Claude, SMS, WhatsApp y Sentry</summary>
<br>

Copia [`.env.example`](.env.example) como `.env` en la raíz y **quita el `#`** de las líneas que llenes (las comentadas no se leen). `docker compose` lo carga en la API.

| Servicio     | Variables                                      | Cómo probarlo                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude**   | `ANTHROPIC_API_KEY`                            | La explicación dice "IA generativa"; en la app, **Hablar con Tendi** → "hoy vendí 350 mil" → **Mi cuaderno** muestra la venta; **Tomar foto** lee una hoja del cuaderno                                                                                                                                                                                                |
| **SMS**      | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`      | Entra con tu celular real: **Twilio Verify** envía el código sin que compres un número. En una cuenta de prueba, solo a números verificados. Los celulares de demostración siguen viendo el código en pantalla                                                                                                                                                         |
| **WhatsApp** | Las mismas + `PUBLIC_API_URL`                  | `ngrok http 4000`, pon la URL en `PUBLIC_API_URL` y en Twilio → Messaging → _Try it out_ → WhatsApp sandbox configura _When a message comes in_ = `https://<túnel>/whatsapp/webhook` (POST). Únete al sandbox desde un celular registrado como tendero y escribe "hoy vendí 200 mil" o manda la foto del cuaderno. Las decisiones de la entidad también llegan por ahí |
| **Sentry**   | `SENTRY_DSN` (el DSN del proyecto **Node.js**) | En local solo la API lee `.env`. Un error 500 llega a Sentry con `release=local`; los 4xx no se envían                                                                                                                                                                                                                                                                 |

</details>

<details>
<summary><b>Desarrollo sin Docker</b>: cada pieza en su terminal</summary>
<br>

Requisitos: Node 22.13+, pnpm 9, Python 3.12+ con [uv](https://docs.astral.sh/uv/).

```bash
pnpm install                                   # portal, API y tokens
docker compose up -d db                        # solo Postgres
cp services/api/.env.example services/api/.env
pnpm --filter @tendia/api exec prisma migrate deploy
cd services/scoring && uv sync && uv run uvicorn tendia_scoring.app:app --port 8000   # terminal 1
pnpm --filter @tendia/api dev                  # terminal 2
pnpm --filter @tendia/portal dev               # terminal 3
cd apps/mobile && npm install && npx expo start  # terminal 4
```

</details>

### Pruebas

| Pieza   | Comando                                                                                                                   | Qué cubre                                                                                                     | Resultado              |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Scoring | `cd services/scoring && uv sync --group train && uv run pytest`                                                           | Variables, scorecard, indicadores, contrato `/score` v2                                                       | **45 pruebas · 91 %**  |
| API     | `pnpm --filter @tendia/api test`                                                                                          | Flujo T1 → T13, aislamiento y RLS, Ley 1581, invitaciones, adjuntos, asistente, OTP con Twilio Verify, Sentry | **108 pruebas · 90 %** |
| Portal  | `pnpm --filter @tendia/portal test` y `test:e2e`                                                                          | Formatos y flujo feliz con Playwright (MFA → aprobar con la tasa del mercado)                                 | ✅                     |
| App     | `npm run lint && npx tsc --noEmit` en `apps/mobile`; [`.maestro/flujo-feliz.yaml`](apps/mobile/.maestro/flujo-feliz.yaml) | Tipos, lint y flujo feliz con Maestro                                                                         | ✅                     |
| Tokens  | `pnpm --filter @tendia/tokens test`                                                                                       | Contraste WCAG AA de la paleta                                                                                | ✅                     |

Las pruebas de la API necesitan Postgres (`tendia_test`) y el scoring corriendo. Detalle en el [plan de pruebas](docs/test-plan.md).

## ☁️ Despliegue

Un solo proyecto de Vercel (`tendia-app`, plan gratis) con [Vercel Services](https://vercel.com/docs/services): [`vercel.json`](vercel.json) define los cuatro servicios, que se construyen y despliegan juntos, y cada fusión a `main` despliega solo. La API corre en un contenedor con el mismo `Dockerfile.api` de `docker compose` y aplica las migraciones de Prisma al arrancar.

| Servicio      | Tipo                                       | URL                                 |
| ------------- | ------------------------------------------ | ----------------------------------- |
| `portal`      | Next.js                                    | https://tendia-app.vercel.app       |
| `app`         | App del tendero en web (Expo, estática)    | https://tendia-app.vercel.app/app   |
| `api`         | NestJS en contenedor (`Dockerfile.api`)    | https://tendia-app.vercel.app/api   |
| `scoring`     | FastAPI **privado**: sin ruta pública      | Solo la API lo llama, por _binding_ |
| Base de datos | Supabase (Postgres administrado, _pooler_) | `DATABASE_URL` y `DIRECT_URL`       |

Variables, migraciones, Sentry con la versión del commit (`VERCEL_GIT_COMMIT_SHA`), Twilio y WhatsApp en [docs/deploy.md](docs/deploy.md).

## 🗂️ Estructura del repositorio

```text
tendia/
├── apps/
│   ├── mobile/          App del tendero (Expo), también publicada en web en /app
│   └── portal/          Portal del aliado (Next.js)
├── services/
│   ├── api/             API TendIA (NestJS + Prisma): única puerta a los datos
│   └── scoring/         Motor de scoring (FastAPI): scorecard, segmentos y referencias
├── packages/tokens/     Paleta y tipografía compartidas, con pruebas de contraste
├── docs/                Análisis, diseño, ADR, modelo, legal y seguridad
├── Dockerfile.api       Imagen de la API, igual en local y en Vercel
├── docker-compose.yml   Todo el sistema en local
└── vercel.json          Los cuatro servicios del despliegue
```

## 🚦 Estado y próximos pasos

| Qué                                                  | Estado                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Flujo completo T1 a T13 y A1 a A4                    | ✅ En línea en Vercel                                                                       |
| Modelo con datos reales (UCI, DANE, Superfinanciera) | ✅ Pagos al proveedor con datos reales; el componente de negocio, con sintéticos calibrados |
| IA (explicación, Tendi, cuaderno) y WhatsApp         | ✅ Con respaldo sin IA                                                                      |
| Conectores de datáfono, distribuidor y Open Finance  | 🟡 Simulados con distribuciones de EMICRON                                                  |
| Twilio                                               | 🟡 Cuenta de prueba: SMS solo a números verificados                                         |

```mermaid
timeline
  title Cómo llegamos aquí (2026)
  23 oct : v0.1 · flujo completo del tendero y del aliado
  25 oct : MVP con datos reales, IA, RLS y Twilio Verify
  28 oct : alta de aliados y recorridos por rol
  4 nov : despliegue en Vercel · release v1.0.0
  10 nov : la app del tendero en la web, en /app
```

Lo que sigue: convenios con proveedores de datos (Bold, Treinta, distribuidores), un piloto con 10 entidades que pagan desde el mes 1, validar el modelo con los pagos reales de esos créditos y entrar al sandbox de la Superfinanciera.

## 📚 Documentación

**¿Por dónde empiezo?**

| Si eres…                        | Lee primero                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🎓 **Jurado o profesor**        | [Contexto](docs/contexto.md) → [Requerimientos](docs/requerimientos.md) → [Diseño (C4, clases, ER)](docs/diseno/README.md) → [Por qué un monolito sin estado](docs/diseno/monolito-sin-estado.md) |
| 💼 **Inversionista o entidad**  | [Modelo de negocio](#-modelo-de-negocio) → [Planificación y modelo financiero](docs/planificacion.md) → [Model card](docs/model-card.md)                                                          |
| 🛠️ **Desarrollador**            | [Correr en local](#-correr-en-local) → [ADR-002 Arquitectura](docs/adr/ADR-002-arquitectura.md) → [Modelo de datos](docs/data-model.md) → [Plan de pruebas](docs/test-plan.md)                    |
| 🔐 **Seguridad o cumplimiento** | [OWASP API Top 10](docs/security/owasp-api-top10.md) → [Política de datos](docs/legal/politica-tratamiento-datos.md) → [Aviso de privacidad](docs/legal/aviso-privacidad.md)                      |

<details>
<summary><b>Todos los documentos</b></summary>
<br>

| Documento                                                                                                                           | De qué trata                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Contexto](docs/contexto.md) · [Requerimientos](docs/requerimientos.md) · [Datos de entrada y salida](docs/datos-entrada-salida.md) | Problema, actores, requerimientos y qué entra y sale                                 |
| [Planificación](docs/planificacion.md)                                                                                              | Sprints, épicas, riesgos y modelo financiero a 36 meses                              |
| [Diseño](docs/diseno/README.md)                                                                                                     | C4 (contexto, contenedores, componentes), infraestructura, clases y entidad-relación |
| [Plan de infraestructura](docs/diseno/plan-infraestructura.md) · [Monolito sin estado](docs/diseno/monolito-sin-estado.md)          | Cómo crece la infraestructura y por qué la API es un monolito modular                |
| [ADR-001 Autenticación](docs/adr/ADR-001-autenticacion.md)                                                                          | JWT propios, OTP con Twilio Verify, MFA, invitaciones y roles                        |
| [ADR-002 Arquitectura](docs/adr/ADR-002-arquitectura.md)                                                                            | C4 nivel 2 y por qué esta división                                                   |
| [ADR-003 Asistente de IA](docs/adr/ADR-003-asistente-ia.md)                                                                         | Tendi, WhatsApp y lectura del cuaderno                                               |
| [Modelo de datos](docs/data-model.md)                                                                                               | Diagrama entidad-relación, estados y protección de datos                             |
| [Model card](docs/model-card.md) · [Diccionario de variables](docs/diccionario-variables.md) · [Datos](docs/datos.md)               | Cómo se entrena, con qué, qué tan bien funciona y sus límites                        |
| [Plan de pruebas](docs/test-plan.md) · [Prueba de usabilidad](docs/usabilidad.md)                                                   | Pirámide, cobertura, casos que no se pueden romper y validación con tenderos         |
| [OWASP API Top 10](docs/security/owasp-api-top10.md)                                                                                | Revisión de seguridad                                                                |
| [Política de datos](docs/legal/politica-tratamiento-datos.md) · [Aviso de privacidad](docs/legal/aviso-privacidad.md)               | Ley 1581                                                                             |
| [Despliegue](docs/deploy.md) · [Marca](docs/brand.md)                                                                               | Ambientes, secretos, observabilidad y paleta                                         |

</details>

## 🤝 Cómo trabajamos

- Ramas `feature/TND-XXX-descripcion`, [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) y PR obligatorio a `main` con al menos una aprobación.
- [CI](.github/workflows/ci.yml) corre solo las piezas que cambiaron; el check `ci-ok` es obligatorio para fusionar. Dependabot propone las actualizaciones.
- La Definition of Done está en la plantilla de PR. La planeación está en Jira: 26 épicas, 108 historias y 314 subtareas en cinco sprints ([planificación](docs/planificacion.md)); en GitHub, el trabajo técnico se sigue con los issues `TND-XXX`.

## 👥 Equipo

<table align="center">
  <tr>
    <td align="center" width="16%"><a href="https://github.com/AnderssonProgramming"><img src="https://github.com/AnderssonProgramming.png?size=120" width="80" alt="Andersson David Sánchez Méndez"><br><sub><b>Andersson David Sánchez Méndez</b></sub></a><br><sub>QA & Data/ML Lead</sub></td>
    <td align="center" width="16%"><a href="https://github.com/cris-eci"><img src="https://github.com/cris-eci.png?size=120" width="80" alt="Cristian Santiago Pedraza Rodríguez"><br><sub><b>Cristian Santiago Pedraza Rodríguez</b></sub></a><br><sub>Backend Developer</sub></td>
    <td align="center" width="16%"><a href="https://github.com/Krayangel"><img src="https://github.com/Krayangel.png?size=120" width="80" alt="David Santiago Villadiego Médicis"><br><sub><b>David Santiago Villadiego Médicis</b></sub></a><br><sub>Data Scientist</sub></td>
    <td align="center" width="16%"><a href="https://github.com/DASarria"><img src="https://github.com/DASarria.png?size=120" width="80" alt="David Stiven Sarria Arcila"><br><sub><b>David Stiven Sarria Arcila</b></sub></a><br><sub>Product & Business Strategy</sub></td>
    <td align="center" width="16%"><a href="https://github.com/juanLozano-2004"><img src="https://github.com/juanLozano-2004.png?size=120" width="80" alt="Juan Esteban Lozano Cárdenas"><br><sub><b>Juan Esteban Lozano Cárdenas</b></sub></a><br><sub>UX/UI & Wireframes</sub></td>
    <td align="center" width="16%"><a href="https://github.com/RaquelSAyala"><img src="https://github.com/RaquelSAyala.png?size=120" width="80" alt="Raquel Iveth Selma Ayala"><br><sub><b>Raquel Iveth Selma Ayala</b></sub></a><br><sub>Documentation & QA</sub></td>
  </tr>
</table>

<p align="center"><sub><a href="https://tendia-landing.vercel.app">tendia-landing.vercel.app</a> · Proyecto de IETI · Escuela Colombiana de Ingeniería Julio Garavito · 2026</sub></p>
