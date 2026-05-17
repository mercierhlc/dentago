-- Extend supplier_ops_catalog_stats with data-quality counts (SKU + canonical product name).
--
-- Must DROP first: Postgres CREATE OR REPLACE VIEW cannot insert new columns before an
-- existing trailing column (it would try to "rename" last_row_update_at → missing_sku).

DROP VIEW IF EXISTS public.supplier_ops_catalog_stats;

CREATE VIEW public.supplier_ops_catalog_stats AS
SELECT
  dsp.supplier_id,
  count(*)::bigint AS sku_rows,
  count(*) FILTER (WHERE dsp.match_status = 'pending_review')::bigint AS pending_review,
  count(*) FILTER (WHERE dsp.match_status IS NULL OR dsp.match_status = 'approved')::bigint AS mapping_ok,
  count(*) FILTER (WHERE dsp.match_status IN ('rejected', 'unmatched'))::bigint AS mapping_blocked,
  count(*) FILTER (WHERE dsp.price IS NULL OR dsp.price <= 0)::bigint AS missing_price,
  count(*) FILTER (WHERE dsp.updated_at < (now() - interval '14 days'))::bigint AS stale_rows,
  count(*) FILTER (WHERE dsp.sku IS NULL OR btrim(COALESCE(dsp.sku, '')) = '')::bigint AS missing_sku,
  count(*) FILTER (WHERE dp.id IS NULL OR btrim(COALESCE(dp.name, '')) = '')::bigint AS missing_product_name,
  max(dsp.updated_at) AS last_row_update_at
FROM public.dentago_supplier_products dsp
LEFT JOIN public.dentago_products dp ON dp.id = dsp.product_id
GROUP BY dsp.supplier_id;
