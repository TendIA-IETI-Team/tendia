-- TND-022: la bitácora de auditoría no se puede editar ni borrar desde la aplicación.
-- (TRUNCATE exige ser dueño de la tabla: solo lo usan las pruebas sobre su base propia.)
CREATE OR REPLACE FUNCTION auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_inmutable
  BEFORE UPDATE OR DELETE ON "Auditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();

-- TND-012: Row Level Security.
-- 1) Todas las tablas con RLS activo. El dueño (el usuario de la API y de las migraciones) no se ve
--    afectado; los roles sin política, como anon y authenticated de Supabase, no leen nada.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 2) El portal del aliado lee con el rol tendia_aliado y la variable app.aliado_id de la transacción.
--    Aunque una consulta olvide filtrar por aliado, Postgres solo devuelve las filas de ese aliado.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tendia_aliado') THEN
    CREATE ROLE tendia_aliado NOLOGIN;
  END IF;
  -- Quien crea el rol puede otorgárselo. Si el rol ya existía y no se puede, la migración sigue: la
  -- API lo detecta al arrancar y el portal sigue aislado por el filtro de la aplicación.
  BEGIN
    EXECUTE format('GRANT tendia_aliado TO %I', current_user);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE WARNING 'No se pudo otorgar tendia_aliado a %', current_user;
  END;
END $$;
GRANT USAGE ON SCHEMA public TO tendia_aliado;
GRANT SELECT ON "Solicitud", "Score", "Variacion", "Garantia", "Adjunto", "Tendero", "Negocio",
  "DatoMensual", "Politica" TO tendia_aliado;

CREATE POLICY aliado_solicitudes ON "Solicitud" FOR SELECT TO tendia_aliado
  USING (
    "aliadoId" = current_setting('app.aliado_id', true)
    AND "estado" IN ('ENVIADA', 'GARANTIA_SOLICITADA', 'GARANTIA_ENVIADA', 'APROBADA', 'RECHAZADA')
  );
CREATE POLICY aliado_scores ON "Score" FOR SELECT TO tendia_aliado
  USING (EXISTS (SELECT 1 FROM "Solicitud" s WHERE s."id" = "Score"."solicitudId"));
CREATE POLICY aliado_variaciones ON "Variacion" FOR SELECT TO tendia_aliado
  USING (EXISTS (SELECT 1 FROM "Solicitud" s WHERE s."id" = "Variacion"."solicitudId"));
CREATE POLICY aliado_garantias ON "Garantia" FOR SELECT TO tendia_aliado
  USING (EXISTS (SELECT 1 FROM "Solicitud" s WHERE s."id" = "Garantia"."solicitudId"));
CREATE POLICY aliado_adjuntos ON "Adjunto" FOR SELECT TO tendia_aliado
  USING (EXISTS (SELECT 1 FROM "Solicitud" s WHERE s."id" = "Adjunto"."solicitudId"));
CREATE POLICY aliado_tenderos ON "Tendero" FOR SELECT TO tendia_aliado
  USING (EXISTS (SELECT 1 FROM "Solicitud" s WHERE s."tenderoId" = "Tendero"."id"));
CREATE POLICY aliado_negocios ON "Negocio" FOR SELECT TO tendia_aliado
  USING (EXISTS (SELECT 1 FROM "Solicitud" s WHERE s."tenderoId" = "Negocio"."tenderoId"));
CREATE POLICY aliado_datos ON "DatoMensual" FOR SELECT TO tendia_aliado
  USING (EXISTS (SELECT 1 FROM "Negocio" n WHERE n."id" = "DatoMensual"."negocioId"));
CREATE POLICY aliado_politica ON "Politica" FOR SELECT TO tendia_aliado
  USING ("aliadoId" = current_setting('app.aliado_id', true));
