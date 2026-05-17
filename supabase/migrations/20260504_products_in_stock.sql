-- Migration: add in_stock denormalised boolean to dentago_products
--
-- Rationale: checking stock per-query via dentago_supplier_products join is
-- correct for accuracy, but having an indexed boolean on the product itself
-- allows fast filtered searches and avoids a join on every listing page.
--
-- Maintenance strategy:
--   The column is updated by a Postgres function that is called:
--     (a) via a trigger on INSERT/UPDATE to dentago_supplier_products
--     (b) via the Vercel cron that refreshes Dental Sky prices
--
-- The column can lag by at most one cron period (currently 12h). For the
-- OOS-substitution feature, this is acceptable — the substitutes API
-- re-checks live supplier stock and only returns truly in-stock items.

-- 1. Add the column (nullable so existing rows are unaffected initially)
ALTER TABLE dentago_products
  ADD COLUMN IF NOT EXISTS in_stock BOOLEAN;

-- 2. Back-fill: a product is in stock if any linked supplier row has stock = true
UPDATE dentago_products p
SET in_stock = EXISTS (
  SELECT 1
  FROM dentago_supplier_products sp
  WHERE sp.product_id = p.id
    AND sp.stock = TRUE
);

-- 3. Default new rows to FALSE (explicit intent, ingestion must set it)
ALTER TABLE dentago_products
  ALTER COLUMN in_stock SET DEFAULT FALSE;

-- 4. Add index so substitution queries can filter quickly on in_stock = TRUE
CREATE INDEX IF NOT EXISTS idx_dentago_products_in_stock
  ON dentago_products (in_stock, category);

-- 5. Trigger function: keep in_stock in sync when supplier stock changes
CREATE OR REPLACE FUNCTION refresh_product_in_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dentago_products
  SET in_stock = EXISTS (
    SELECT 1
    FROM dentago_supplier_products sp
    WHERE sp.product_id = NEW.product_id
      AND sp.stock = TRUE
  )
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

-- 6. Attach trigger to dentago_supplier_products
DROP TRIGGER IF EXISTS trg_refresh_product_in_stock ON dentago_supplier_products;
CREATE TRIGGER trg_refresh_product_in_stock
  AFTER INSERT OR UPDATE OF stock ON dentago_supplier_products
  FOR EACH ROW EXECUTE FUNCTION refresh_product_in_stock();
