-- Invitaciones de analistas (TND-011), adjuntos de T8 y T10 (TND-054, TND-056), aviso de cambio
-- de estado (TND-057), finalidad en la bitácora (TND-022) y el rol ADMIN_TENDIA.
-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'ADMIN_TENDIA';

-- AlterTable
ALTER TABLE "Auditoria" ADD COLUMN     "finalidad" TEXT;

-- AlterTable
ALTER TABLE "Consentimiento" ADD COLUMN     "finalidad" TEXT,
ADD COLUMN     "referencia" TEXT;

-- AlterTable
ALTER TABLE "DatoMensual" ADD COLUMN     "transacciones" INTEGER;

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "indicadores" JSONB;

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "estadoVisto" "EstadoSolicitud";

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "aliadoId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Invitacion" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'ANALISTA',
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadaEn" TIMESTAMP(3),
    "creadaPor" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjunto" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "proposito" TEXT NOT NULL,
    "mes" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitacion_tokenHash_key" ON "Invitacion"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitacion_aliadoId_creadaEn_idx" ON "Invitacion"("aliadoId", "creadaEn");

-- CreateIndex
CREATE INDEX "Adjunto_solicitudId_idx" ON "Adjunto"("solicitudId");

-- AddForeignKey
ALTER TABLE "Invitacion" ADD CONSTRAINT "Invitacion_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjunto" ADD CONSTRAINT "Adjunto_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

