-- Canonical product model extensions (§6.2): stable public slug, pack quantity,
-- supplier offer normalisation (supplier_sku mirror, price per unit, last sync, stock status).

-- ── Canonical (dentago_products) ───────────────────────────────────────────
ALTER TABLE public.dentago_products
  ADD COLUMN IF NOT EXISTS canonical_slug text,
  ADD COLUMN IF NOT EXISTS pack_quantity numeric(14, 4),
  ADD COLUMN IF NOT EXISTS pack_unit text;

-- Stable slug: DG- + zero-padded id (replace later with marketing slugs if needed).
UPDATE public.dentago_products
SET canonical_slug = 'DG-' || lpad(id::text, 10, '0')
WHERE canonical_slug IS NULL OR btrim(canonical_slug) = '';

DO $$
BEGIN
  ALTER TABLE public.dentago_products
    ADD CONSTRAINT dentago_products_canonical_slug_key UNIQUE (canonical_slug);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dentago_products_canonical_slug
  ON public.dentago_products (canonical_slug);

-- ── Supplier offer (dentago_supplier_products) ───────────────────────────────
ALTER TABLE public.dentago_supplier_products
  ADD COLUMN IF NOT EXISTS supplier_sku text,
  ADD COLUMN IF NOT EXISTS price_per_unit_ex_vat numeric(14, 6),
  ADD COLUMN IF NOT EXISTS supplier_pack_quantity numeric(14, 4),
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_status text;

DO $$
BEGIN
  ALTER TABLE public.dentago_supplier_products
    ADD CONSTRAINT dentago_supplier_products_stock_status_check
    CHECK (
      stock_status IS NULL
      OR stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'unknown')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.dentago_supplier_products
SET supplier_sku = sku
WHERE supplier_sku IS NULL OR btrim(supplier_sku) = '';

UPDATE public.dentago_supplier_products
SET stock_status = CASE
  WHEN stock IS TRUE THEN 'in_stock'
  ELSE 'out_of_stock'
END
WHERE stock_status IS NULL;

-- Keep supplier_sku aligned with sku (single source of truth: sku).
CREATE OR REPLACE FUNCTION public.dentago_sp_sync_supplier_sku()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.supplier_sku := NEW.sku;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dentago_sp_sync_supplier_sku ON public.dentago_supplier_products;
CREATE TRIGGER trg_dentago_sp_sync_supplier_sku
  BEFORE INSERT OR UPDATE OF sku ON public.dentago_supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION public.dentago_sp_sync_supplier_sku();
