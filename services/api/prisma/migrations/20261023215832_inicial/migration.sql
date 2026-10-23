-- CreateEnum
CREATE TYPE "FuenteTipo" AS ENUM ('DATAFONO', 'DISTRIBUIDOR', 'OPEN_FINANCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('BORRADOR', 'DATOS_INCOMPLETOS', 'SCORE_LISTO', 'ENVIADA', 'GARANTIA_SOLICITADA', 'GARANTIA_ENVIADA', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ANALISTA', 'ADMIN_ALIADO');

-- CreateEnum
CREATE TYPE "TipoAliado" AS ENUM ('BANCO', 'FINTECH', 'MICROFINANCIERA', 'DISTRIBUIDOR');

-- CreateEnum
CREATE TYPE "TipoGarantia" AS ENUM ('FNG', 'CODEUDOR', 'OTRA');

-- CreateEnum
CREATE TYPE "EstadoGarantia" AS ENUM ('SOLICITADA', 'ENVIADA', 'ACEPTADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "Tendero" (
    "id" TEXT NOT NULL,
    "celularHash" TEXT NOT NULL,
    "celularCifrado" TEXT NOT NULL,
    "nombre" TEXT,
    "cedulaCifrada" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tendero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCodigo" (
    "id" TEXT NOT NULL,
    "celularHash" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCodigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Negocio" (
    "id" TEXT NOT NULL,
    "tenderoId" TEXT NOT NULL,
    "nombre" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'tienda',
    "barrio" TEXT,
    "ciudad" TEXT NOT NULL DEFAULT 'Bogotá',
    "antiguedadMeses" INTEGER,
    "ventasMensualesDeclaradas" INTEGER,
    "perfilSimulado" TEXT,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consentimiento" (
    "id" TEXT NOT NULL,
    "tenderoId" TEXT NOT NULL,
    "fuente" "FuenteTipo" NOT NULL,
    "proveedor" TEXT NOT NULL,
    "versionTexto" TEXT NOT NULL,
    "otorgadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadoEn" TIMESTAMP(3),

    CONSTRAINT "Consentimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatoMensual" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "fuente" "FuenteTipo" NOT NULL,
    "mes" TEXT NOT NULL,
    "ventas" INTEGER,
    "compras" INTEGER,
    "facturas" INTEGER,
    "pagadasATiempo" INTEGER,
    "diasRetrasoPromedio" DOUBLE PRECISION,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatoMensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aliado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tipo" "TipoAliado" NOT NULL,

    CONSTRAINT "Aliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'ANALISTA',
    "totpSecreto" TEXT,
    "mfaActivo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Politica" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "scoreMinAprobar" INTEGER NOT NULL DEFAULT 60,
    "scoreMinConGarantia" INTEGER NOT NULL DEFAULT 45,
    "montoMaximo" INTEGER NOT NULL DEFAULT 5000000,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Politica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitud" (
    "id" TEXT NOT NULL,
    "tenderoId" TEXT NOT NULL,
    "aliadoId" TEXT,
    "monto" INTEGER NOT NULL,
    "destino" TEXT NOT NULL,
    "plazoMeses" INTEGER NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'BORRADOR',
    "calidadDatos" JSONB,
    "notaDecision" TEXT,
    "decididaEn" TIMESTAMP(3),
    "decididaPor" TEXT,
    "enviadaEn" TIMESTAMP(3),
    "satisfaccion" INTEGER,
    "comentarioSatisfaccion" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "probabilidadIncumplimiento" DOUBLE PRECISION NOT NULL,
    "nivel" TEXT NOT NULL,
    "modeloVersion" TEXT NOT NULL,
    "contribuciones" JSONB NOT NULL,
    "calidadDatos" JSONB NOT NULL,
    "explicacion" JSONB NOT NULL,
    "explicacionFuente" TEXT NOT NULL,
    "conVariaciones" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variacion" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garantia" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "tipo" "TipoGarantia" NOT NULL,
    "notaAliado" TEXT,
    "respuesta" TEXT,
    "estado" "EstadoGarantia" NOT NULL DEFAULT 'SOLICITADA',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Garantia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadaEn" TIMESTAMP(3),
    "ultimoUso" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumoApi" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "estado" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumoApi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "aliadoId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalle" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tendero_celularHash_key" ON "Tendero"("celularHash");

-- CreateIndex
CREATE INDEX "OtpCodigo_celularHash_creadoEn_idx" ON "OtpCodigo"("celularHash", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_tenderoId_key" ON "Negocio"("tenderoId");

-- CreateIndex
CREATE INDEX "Consentimiento_tenderoId_fuente_idx" ON "Consentimiento"("tenderoId", "fuente");

-- CreateIndex
CREATE UNIQUE INDEX "DatoMensual_negocioId_fuente_mes_key" ON "DatoMensual"("negocioId", "fuente", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "Aliado_slug_key" ON "Aliado"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Politica_aliadoId_key" ON "Politica"("aliadoId");

-- CreateIndex
CREATE INDEX "Solicitud_aliadoId_estado_idx" ON "Solicitud"("aliadoId", "estado");

-- CreateIndex
CREATE INDEX "Solicitud_tenderoId_idx" ON "Solicitud"("tenderoId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_solicitudId_version_key" ON "Score"("solicitudId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Variacion_solicitudId_mes_key" ON "Variacion"("solicitudId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "Garantia_solicitudId_key" ON "Garantia"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefijo_key" ON "ApiKey"("prefijo");

-- CreateIndex
CREATE INDEX "ConsumoApi_aliadoId_creadoEn_idx" ON "ConsumoApi"("aliadoId", "creadoEn");

-- CreateIndex
CREATE INDEX "Auditoria_aliadoId_creadoEn_idx" ON "Auditoria"("aliadoId", "creadoEn");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_tenderoId_fkey" FOREIGN KEY ("tenderoId") REFERENCES "Tendero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consentimiento" ADD CONSTRAINT "Consentimiento_tenderoId_fkey" FOREIGN KEY ("tenderoId") REFERENCES "Tendero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatoMensual" ADD CONSTRAINT "DatoMensual_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Politica" ADD CONSTRAINT "Politica_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_tenderoId_fkey" FOREIGN KEY ("tenderoId") REFERENCES "Tendero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variacion" ADD CONSTRAINT "Variacion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garantia" ADD CONSTRAINT "Garantia_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoApi" ADD CONSTRAINT "ConsumoApi_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoApi" ADD CONSTRAINT "ConsumoApi_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
