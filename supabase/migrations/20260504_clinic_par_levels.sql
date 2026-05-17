-- clinic_par_levels: per-clinic par level settings for stockout alerts
create table if not exists public.clinic_par_levels (
  id                    uuid primary key default gen_random_uuid(),
  clinic_id             uuid not null references public.clinic_accounts(id) on delete cascade,
  product_id            integer not null references public.dentago_products(id) on delete cascade,
  par_quantity          integer not null check (par_quantity >= 1),
  reorder_quantity      integer not null default 1 check (reorder_quantity >= 1),
  reorder_interval_days integer check (reorder_interval_days >= 1),
  last_ordered_at       timestamptz,
  alert_sent_at         timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (clinic_id, product_id)
);

-- Index for fast per-clinic lookups
create index if not exists idx_clinic_par_levels_clinic_id
  on public.clinic_par_levels(clinic_id);

-- Index for the cron job (filter by interval configured)
create index if not exists idx_clinic_par_levels_interval
  on public.clinic_par_levels(reorder_interval_days)
  where reorder_interval_days is not null;

-- RLS: clinics can only see/modify their own par levels
alter table public.clinic_par_levels enable row level security;

create policy "Clinics own their par levels"
  on public.clinic_par_levels
  using (
    clinic_id = (
      select id from public.clinic_accounts
      where auth_user_id = auth.uid()
    )
  );

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clinic_par_levels_updated_at
  before update on public.clinic_par_levels
  for each row execute function update_updated_at_column();
