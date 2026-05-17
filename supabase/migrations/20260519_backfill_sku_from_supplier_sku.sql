-- Offer rows where supplier_sku was populated but sku stayed empty (common across some feeds).
-- Trigger `trg_dentago_sp_sync_supplier_sku` mirrors sku → supplier_sku on sku writes; this fixes the inverse gap.
UPDATE public.dentago_supplier_products
SET sku = btrim(supplier_sku)
WHERE (sku IS NULL OR btrim(sku) = '')
  AND supplier_sku IS NOT NULL
  AND btrim(supplier_sku) <> '';
