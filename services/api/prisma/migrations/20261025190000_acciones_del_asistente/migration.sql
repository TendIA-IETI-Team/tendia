-- Acciones que el asistente guardó en cada turno (evita registrar dos veces lo mismo).
ALTER TABLE "MensajeAsistente" ADD COLUMN "acciones" JSONB;
