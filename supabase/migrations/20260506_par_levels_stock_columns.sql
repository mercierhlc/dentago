-- Add current_quantity and reorder_point to clinic_par_levels
-- These support real-time stockout alerts based on quantity-on-hand,
-- complementing the existing reorder_interval_days (time-based) approach.
alter table public.clinic_par_levels
  add column if not exists current_quantity integer,
  add column if not exists reorder_point    integer not null default 1;

-- Index for the cron: quickly find rows where stock is low
create index if not exists idx_clinic_par_levels_low_stock
  on public.clinic_par_levels(current_quantity, reorder_point)
  where current_quantity is not null;
