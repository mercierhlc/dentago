-- After 20260516 backfill: every product must carry a stable canonical_slug.
ALTER TABLE public.dentago_products
  ALTER COLUMN canonical_slug SET NOT NULL;
