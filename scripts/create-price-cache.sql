-- Run this once in your Supabase SQL editor:
-- https://app.supabase.com/project/wybqjycfpauwlcrqgtfb/sql

CREATE TABLE IF NOT EXISTS price_cache (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid        NOT NULL,
  product_id   text        NOT NULL,
  supplier     text        NOT NULL,
  price        numeric     NOT NULL,
  stock        boolean     NOT NULL DEFAULT true,
  authenticated boolean    NOT NULL DEFAULT true,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,

  CONSTRAINT price_cache_unique UNIQUE (clinic_id, product_id, supplier)
);

-- Index for fast lookups by clinic + product
CREATE INDEX IF NOT EXISTS price_cache_lookup
  ON price_cache (clinic_id, product_id, expires_at);

-- Auto-delete rows older than 24h (keeps the table small)
-- Supabase doesn't have pg_cron by default; rows are cleaned up lazily via expires_at checks.
-- Optional: enable pg_cron and run:
--   SELECT cron.schedule('cleanup-price-cache', '0 * * * *',
--     $$DELETE FROM price_cache WHERE expires_at < now() - interval '24 hours'$$);

-- RLS: tenant isolation for JWT clients; service_role bypasses RLS on the server.
-- Full setup + FORCE RLS: supabase/migrations/20260430140000_harden_rls.sql
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_cache_clinic_isolation" ON price_cache
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT c.id FROM clinic_accounts c WHERE c.auth_user_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT c.id FROM clinic_accounts c WHERE c.auth_user_id = auth.uid())
  );
