create table if not exists sku_match_candidates (
  id uuid primary key default gen_random_uuid(),
  product_a_id bigint references dentago_supplier_products(id),
  product_b_id bigint references dentago_supplier_products(id),
  confidence numeric(4,3),
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists sku_match_candidates_status_idx on sku_match_candidates(status);
