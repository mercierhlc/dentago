-- Run in Supabase SQL Editor once: adds SKU variant links (sizes, shades, etc.)
-- Sibling IDs only — do not include the product's own id.

ALTER TABLE dentago_products
  ADD COLUMN IF NOT EXISTS variations INTEGER[] NOT NULL DEFAULT '{}';
