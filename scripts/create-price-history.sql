-- dentago_price_history: time-series record of every price observation per
-- (supplier, product, sku). Written by the cron routes on every refresh tick.
--
-- We only INSERT rows when (price, stock) actually changes vs the latest row
-- for that (supplier_id, product_id) pair. This keeps the table size linear
-- with real price movement, not with cron frequency.

-- Existing version of this table only had (supplier_id, sku, price, stock, captured_at)
-- with no product_id link. We drop and recreate so the cron routes can write
-- product_id directly (lets us render history on a product page without an extra join).
DROP TABLE IF EXISTS dentago_price_history CASCADE;

CREATE TABLE IF NOT EXISTS dentago_price_history (
  id           bigserial   PRIMARY KEY,
  supplier_id  integer     NOT NULL REFERENCES dentago_suppliers(id) ON DELETE CASCADE,
  product_id   integer     NOT NULL REFERENCES dentago_products(id) ON DELETE CASCADE,
  sku          text,
  price        numeric     NOT NULL,
  stock        boolean     NOT NULL DEFAULT true,
  source       text        NOT NULL,               -- 'cron' | 'scrape' | 'manual'
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_history_lookup
  ON dentago_price_history (product_id, supplier_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS price_history_recorded_at
  ON dentago_price_history (recorded_at DESC);

CREATE INDEX IF NOT EXISTS price_history_supplier_recorded_at
  ON dentago_price_history (supplier_id, recorded_at DESC);

-- RLS enabled; no policies for anon/authenticated (cron/API use service_role and bypass RLS).
-- Optional: supabase/migrations/20260430140000_harden_rls.sql adds FORCE ROW LEVEL SECURITY.
ALTER TABLE dentago_price_history ENABLE ROW LEVEL SECURITY;
