-- Run this in Supabase SQL Editor
-- Creates the supplier_accounts table that maps Supabase auth users to supplier IDs

create table if not exists public.supplier_accounts (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  supplier_id   int  not null references public.dentago_suppliers(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (auth_user_id),
  unique (supplier_id)
);

-- Enable RLS (routes use service role so all reads/writes are allowed)
alter table public.supplier_accounts enable row level security;

-- Example: add a supplier user
-- First create the user in Supabase Auth > Users (or invite them)
-- Then run:
--
-- insert into public.supplier_accounts (auth_user_id, supplier_id)
-- values ('<uuid from auth.users>', <supplier id from dentago_suppliers>);
