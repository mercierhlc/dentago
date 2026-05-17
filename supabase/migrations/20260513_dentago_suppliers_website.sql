-- Align with scripts/create-tables.sql: optional supplier homepage (not required for admin APIs).

ALTER TABLE public.dentago_suppliers
  ADD COLUMN IF NOT EXISTS website text;
