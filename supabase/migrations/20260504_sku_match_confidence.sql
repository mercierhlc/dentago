-- ============================================================
-- SKU Match Confidence & Clinical Review Queue
-- ------------------------------------------------------------
-- dentago_supplier_products maps supplier SKUs to canonical
-- dentago_products. This migration adds confidence scoring
-- and a status gate so low-confidence matches go to a manual
-- clinical review queue before appearing in savings comparisons.
--
-- Thresholds (see docs/sku-matching-thresholds.md):
--   match_confidence >= 85  → 'approved'   (shown in search)
--   match_confidence 60–84  → 'pending_review' (review queue)
--   match_confidence < 60   → 'unmatched'  (hidden, separate product)
--   NULL (legacy rows)      → treated as 'approved' in search
--
-- Safety rationale: a wrong SKU match shows clinics fake savings
-- on a different product — at worst this causes a clinical incident
-- (wrong material/specification ordered). The review gate gives a
-- human a chance to catch cross-category or specification errors
-- before they reach clinic staff.
-- ============================================================

-- 1. Add columns to dentago_supplier_products
ALTER TABLE dentago_supplier_products
  ADD COLUMN IF NOT EXISTS match_confidence      numeric(5,2),
  ADD COLUMN IF NOT EXISTS match_status          text
      CHECK (match_status IN ('approved','pending_review','rejected','unmatched')),
  ADD COLUMN IF NOT EXISTS match_method          text,
      -- 'sku_exact'            exact SKU match across suppliers
      -- 'name_fuzzy'           fuzzy name/brand/packsize match
      -- 'manual_import'        manually curated during catalogue import
      -- 'admin_approved'       reviewer approved from queue
  ADD COLUMN IF NOT EXISTS match_notes           text,
  ADD COLUMN IF NOT EXISTS match_reviewed_by     text,
  ADD COLUMN IF NOT EXISTS match_reviewed_at     timestamptz;

-- Index for the review queue API (pending rows, ordered oldest first)
CREATE INDEX IF NOT EXISTS idx_dsp_match_status
  ON dentago_supplier_products (match_status, created_at)
  WHERE match_status = 'pending_review';

-- Index for search filter (exclude non-approved rows quickly)
CREATE INDEX IF NOT EXISTS idx_dsp_approved
  ON dentago_supplier_products (product_id)
  WHERE match_status IS NULL OR match_status = 'approved';

-- 2. sku_match_review_log — full audit trail of every review decision
CREATE TABLE IF NOT EXISTS sku_match_review_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_product_id bigint NOT NULL
      REFERENCES dentago_supplier_products(id) ON DELETE CASCADE,
  product_id      bigint NOT NULL,
  supplier_id     bigint NOT NULL,
  sku             text NOT NULL,

  -- Snapshot of match at time of review
  match_confidence_at_review  numeric(5,2),
  match_method_at_review      text,

  -- Decision
  decision        text NOT NULL CHECK (decision IN ('approved','rejected')),
  reason          text,          -- reviewer's free-text reason
  reviewed_by     text NOT NULL, -- admin email / agent ID
  reviewed_at     timestamptz NOT NULL DEFAULT now(),

  -- Context: what product was matched TO
  canonical_name  text,
  supplier_name   text
);

ALTER TABLE sku_match_review_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_sku_review_log"
  ON sku_match_review_log FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_sku_review_log_sp
  ON sku_match_review_log (supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_sku_review_log_product
  ON sku_match_review_log (product_id);
