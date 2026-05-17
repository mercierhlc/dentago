-- Residual SKU backfill after 20260519_backfill_sku_from_supplier_sku.sql
-- Uses only in-DB, supplier-correct sources (no cross-supplier guessing).
--
-- 1) Past orders: clinics ordered with a specific supplier + product + sku line.
-- 2) Product specs: manufacturer / item codes when labelled in specs JSON.
-- 3) Align supplier_sku from sku when sku is set but supplier_sku is blank (bypasses trigger edge cases).

-- ── 1) Latest non-empty sku per (canonical product_id, supplier_id) from order history ─────────
UPDATE public.dentago_supplier_products dsp
SET sku = oi.sku
FROM (
  SELECT DISTINCT ON (oi.product_id, oi.supplier_id)
    oi.product_id,
    oi.supplier_id,
    btrim(oi.sku::text) AS sku
  FROM public.dentago_order_items oi
  WHERE oi.sku IS NOT NULL
    AND btrim(oi.sku::text) <> ''
  ORDER BY oi.product_id, oi.supplier_id, oi.created_at DESC NULLS LAST, oi.id DESC
) oi
WHERE dsp.product_id = oi.product_id
  AND dsp.supplier_id = oi.supplier_id
  AND (dsp.sku IS NULL OR btrim(dsp.sku::text) = '')
  AND (dsp.supplier_sku IS NULL OR btrim(dsp.supplier_sku::text) = '');

-- ── 2) First matching specs entry per product (label whitelist) ───────────────────────────────────
UPDATE public.dentago_supplier_products dsp
SET sku = sp.spec_sku
FROM (
  SELECT DISTINCT ON (dp.id)
    dp.id AS product_id,
    btrim(elem->>'value') AS spec_sku
  FROM public.dentago_products dp
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(dp.specs::jsonb, '[]'::jsonb)) = 'array'
        THEN COALESCE(dp.specs::jsonb, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) AS elem
  WHERE elem ? 'label'
    AND elem ? 'value'
    AND lower(btrim(elem->>'label')) IN (
      'sku',
      'product sku',
      'item code',
      'item no',
      'item no.',
      'product code',
      'manufacturer code',
      'manufacturers code',
      'mpn',
      'mpc',
      'manufacturers product code',
      'manufacturer sku',
      'supplier sku'
    )
    AND elem->>'value' IS NOT NULL
    AND btrim(elem->>'value') <> ''
  ORDER BY dp.id, char_length(btrim(elem->>'value')) ASC, elem->>'label'
) sp
WHERE dsp.product_id = sp.product_id
  AND (dsp.sku IS NULL OR btrim(dsp.sku::text) = '')
  AND (dsp.supplier_sku IS NULL OR btrim(dsp.supplier_sku::text) = '');

-- ── 3) Mirror sku → supplier_sku when supplier_sku still blank ───────────────────────────────────
UPDATE public.dentago_supplier_products
SET supplier_sku = btrim(sku::text)
WHERE (supplier_sku IS NULL OR btrim(supplier_sku::text) = '')
  AND sku IS NOT NULL
  AND btrim(sku::text) <> '';
