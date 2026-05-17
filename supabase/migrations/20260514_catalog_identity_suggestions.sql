-- Cross-supplier duplicate product candidates (same brand + fuzzy name).
-- Populated by scripts/catalog-identity-agent.ts; reviewed in Supplier Ops → Identity.

CREATE TABLE IF NOT EXISTS catalog_identity_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id_lo bigint NOT NULL REFERENCES dentago_products (id) ON DELETE CASCADE,
  product_id_hi bigint NOT NULL REFERENCES dentago_products (id) ON DELETE CASCADE,
  brand_key text NOT NULL,
  name_similarity numeric(7,4) NOT NULL,
  category_lo text,
  category_hi text,
  confidence_tier text NOT NULL CHECK (confidence_tier IN ('high', 'medium')),
  distinguishing_conflict boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'rejected', 'merged')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  CONSTRAINT catalog_identity_pair_order CHECK (product_id_lo < product_id_hi),
  CONSTRAINT catalog_identity_pair_unique UNIQUE (product_id_lo, product_id_hi)
);

CREATE INDEX IF NOT EXISTS idx_catalog_identity_status_created
  ON catalog_identity_suggestions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_identity_brand
  ON catalog_identity_suggestions (brand_key);

ALTER TABLE catalog_identity_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_catalog_identity_suggestions"
  ON catalog_identity_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);
