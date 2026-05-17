-- ============================================================
-- Supplier Operations Console — canonical ops + health layer
-- ------------------------------------------------------------
-- v1 model:
--   * Canonical product identity = public.dentago_products (existing).
--   * Supplier offer row       = public.dentago_supplier_products (existing).
--   * Mapping / confidence       = match_* columns + sku_match_* tables (existing).
-- This migration adds: aggregated catalogue stats (view), persisted health
-- rows (cron-updatable), exception queue, reliability snapshot store.
-- ============================================================

-- Idempotent guard: `supplier_ops_catalog_stats` references match_* on
-- dentago_supplier_products (added in 20260504_sku_match_confidence.sql). If
-- that migration was never applied, create the columns here so this file runs.
ALTER TABLE public.dentago_supplier_products
  ADD COLUMN IF NOT EXISTS match_confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS match_status text,
  ADD COLUMN IF NOT EXISTS match_method text,
  ADD COLUMN IF NOT EXISTS match_notes text,
  ADD COLUMN IF NOT EXISTS match_reviewed_by text,
  ADD COLUMN IF NOT EXISTS match_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  ALTER TABLE public.dentago_supplier_products
    ADD CONSTRAINT dentago_supplier_products_match_status_check
    CHECK (
      match_status IS NULL
      OR match_status IN ('approved', 'pending_review', 'rejected', 'unmatched')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_dsp_match_status
  ON public.dentago_supplier_products (match_status, created_at)
  WHERE match_status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_dsp_approved
  ON public.dentago_supplier_products (product_id)
  WHERE match_status IS NULL OR match_status = 'approved';

-- Live aggregates per supplier (read by admin API; cheap to refresh)
CREATE OR REPLACE VIEW public.supplier_ops_catalog_stats AS
SELECT
  dsp.supplier_id,
  count(*)::bigint AS sku_rows,
  count(*) FILTER (WHERE dsp.match_status = 'pending_review')::bigint AS pending_review,
  count(*) FILTER (WHERE dsp.match_status IS NULL OR dsp.match_status = 'approved')::bigint AS mapping_ok,
  count(*) FILTER (WHERE dsp.match_status IN ('rejected', 'unmatched'))::bigint AS mapping_blocked,
  count(*) FILTER (WHERE dsp.price IS NULL OR dsp.price <= 0)::bigint AS missing_price,
  count(*) FILTER (WHERE dsp.updated_at < (now() - interval '14 days'))::bigint AS stale_rows,
  max(dsp.updated_at) AS last_row_update_at
FROM public.dentago_supplier_products dsp
GROUP BY dsp.supplier_id;

-- Persisted health (sync_status / last_error filled by cron or admin tools)
CREATE TABLE IF NOT EXISTS public.supplier_catalog_health (
  supplier_id integer PRIMARY KEY REFERENCES public.dentago_suppliers (id) ON DELETE CASCADE,
  sync_status text NOT NULL DEFAULT 'unknown'
    CHECK (sync_status IN ('ok', 'running', 'failed', 'stale', 'unknown')),
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  supplier_product_count bigint NOT NULL DEFAULT 0,
  pending_review_count bigint NOT NULL DEFAULT 0,
  mapping_ok_count bigint NOT NULL DEFAULT 0,
  mapping_blocked_count bigint NOT NULL DEFAULT 0,
  missing_price_count bigint NOT NULL DEFAULT 0,
  stale_row_count bigint NOT NULL DEFAULT 0,
  last_row_update_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.supplier_catalog_health (
  supplier_id,
  supplier_product_count,
  pending_review_count,
  mapping_ok_count,
  mapping_blocked_count,
  missing_price_count,
  stale_row_count,
  last_row_update_at
)
SELECT
  supplier_id,
  sku_rows,
  pending_review,
  mapping_ok,
  mapping_blocked,
  missing_price,
  stale_rows,
  last_row_update_at
FROM public.supplier_ops_catalog_stats
ON CONFLICT (supplier_id) DO UPDATE SET
  supplier_product_count = EXCLUDED.supplier_product_count,
  pending_review_count = EXCLUDED.pending_review_count,
  mapping_ok_count = EXCLUDED.mapping_ok_count,
  mapping_blocked_count = EXCLUDED.mapping_blocked_count,
  missing_price_count = EXCLUDED.missing_price_count,
  stale_row_count = EXCLUDED.stale_row_count,
  last_row_update_at = EXCLUDED.last_row_update_at,
  updated_at = now();

-- Suppliers with zero supplier_product rows still get a health shell row
INSERT INTO public.supplier_catalog_health (supplier_id, sync_status)
SELECT s.id, 'unknown'
FROM public.dentago_suppliers s
WHERE NOT EXISTS (
  SELECT 1 FROM public.supplier_catalog_health h WHERE h.supplier_id = s.id
);

-- Human exception queue (exception-based ops, not workflow-based)
CREATE TABLE IF NOT EXISTS public.supplier_ops_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'mismatch',
    'sync_failed',
    'supplier_error',
    'missing_price',
    'duplicate_product',
    'mapping_low_confidence',
    'manual'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  supplier_id integer REFERENCES public.dentago_suppliers (id) ON DELETE SET NULL,
  supplier_product_id bigint REFERENCES public.dentago_supplier_products (id) ON DELETE SET NULL,
  product_id integer REFERENCES public.dentago_products (id) ON DELETE SET NULL,
  title text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

CREATE INDEX IF NOT EXISTS idx_supplier_ops_exceptions_open
  ON public.supplier_ops_exceptions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_ops_exceptions_supplier
  ON public.supplier_ops_exceptions (supplier_id);

-- Rolling / periodic supplier scorecard payloads (filled by jobs later)
CREATE TABLE IF NOT EXISTS public.supplier_reliability_snapshots (
  supplier_id integer NOT NULL REFERENCES public.dentago_suppliers (id) ON DELETE CASCADE,
  period_end date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, period_end)
);

-- RLS: no anon/authenticated policies — service_role + PostgREST admin client only
ALTER TABLE public.supplier_catalog_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_catalog_health FORCE ROW LEVEL SECURITY;
CREATE POLICY supplier_catalog_health_service
  ON public.supplier_catalog_health FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.supplier_ops_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ops_exceptions FORCE ROW LEVEL SECURITY;
CREATE POLICY supplier_ops_exceptions_service
  ON public.supplier_ops_exceptions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.supplier_reliability_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_reliability_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY supplier_reliability_snapshots_service
  ON public.supplier_reliability_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
