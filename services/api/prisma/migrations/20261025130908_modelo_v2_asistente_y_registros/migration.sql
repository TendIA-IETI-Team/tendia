-- AlterTable
ALTER TABLE "DatoMensual" ADD COLUMN     "cupo" INTEGER,
ADD COLUMN     "pagado" INTEGER;

-- AlterTable
ALTER TABLE "Politica" ALTER COLUMN "scoreMinAprobar" SET DEFAULT 650,
ALTER COLUMN "scoreMinConGarantia" SET DEFAULT 500;

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "componentes" JSONB,
ADD COLUMN     "segmento" JSONB;

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "montoAprobado" INTEGER,
ADD COLUMN     "plazoAprobado" INTEGER,
ADD COLUMN     "tasaAprobada" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "VentaDiaria" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "canal" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaDiaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fiado" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "pagadoEn" TIMESTAMP(3),
    "canal" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fiado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeAsistente" (
    "id" TEXT NOT NULL,
    "tenderoId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeAsistente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraccionCuaderno" (
    "id" TEXT NOT NULL,
    "tenderoId" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "canal" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraccionCuaderno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VentaDiaria_negocioId_fecha_key" ON "VentaDiaria"("negocioId", "fecha");

-- CreateIndex
CREATE INDEX "Fiado_negocioId_pagadoEn_idx" ON "Fiado"("negocioId", "pagadoEn");

-- CreateIndex
CREATE INDEX "MensajeAsistente_tenderoId_creadoEn_idx" ON "MensajeAsistente"("tenderoId", "creadoEn");

-- CreateIndex
CREATE INDEX "ExtraccionCuaderno_tenderoId_estado_idx" ON "ExtraccionCuaderno"("tenderoId", "estado");

-- AddForeignKey
ALTER TABLE "VentaDiaria" ADD CONSTRAINT "VentaDiaria_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiado" ADD CONSTRAINT "Fiado_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeAsistente" ADD CONSTRAINT "MensajeAsistente_tenderoId_fkey" FOREIGN KEY ("tenderoId") REFERENCES "Tendero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraccionCuaderno" ADD CONSTRAINT "ExtraccionCuaderno_tenderoId_fkey" FOREIGN KEY ("tenderoId") REFERENCES "Tendero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Datos existentes: el modelo tendia-v2 usa la escala 0-1000 con tres franjas (bajo, medio, bueno).
-- Las políticas en escala 0-100 pasan a 0-1000 conservando su intención.
UPDATE "Politica" SET "scoreMinAprobar" = "scoreMinAprobar" * 10 WHERE "scoreMinAprobar" <= 100;
UPDATE "Politica" SET "scoreMinConGarantia" = "scoreMinConGarantia" * 10 WHERE "scoreMinConGarantia" <= 100;
-- Los puntajes del modelo scorecard-v1 (0-100) se reescalan y reciben franja.
UPDATE "Score" SET "puntaje" = "puntaje" * 10 WHERE "modeloVersion" = 'scorecard-v1';
UPDATE "Score"
  SET "nivel" = CASE WHEN "puntaje" < 500 THEN 'bajo' WHEN "puntaje" < 650 THEN 'medio' ELSE 'bueno' END
  WHERE "modeloVersion" = 'scorecard-v1';
