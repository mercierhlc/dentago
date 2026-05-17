-- Track savings per order/search
create table if not exists clinic_savings_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinic_accounts(id) on delete cascade,
  product_id bigint references dentago_supplier_products(id),
  product_name text not null,
  supplier_name text,
  dentago_price numeric(10,2) not null,
  previous_price numeric(10,2), -- what they paid before, if known
  list_price numeric(10,2),     -- RRP/list price from supplier
  saving_amount numeric(10,2),  -- previous_price - dentago_price (or list_price - dentago_price)
  saving_pct numeric(5,2),      -- percentage saved
  quantity integer default 1,
  saved_at timestamptz default now(),
  source text default 'search'  -- 'search' | 'order'
);
create index if not exists clinic_savings_log_clinic_idx on clinic_savings_log(clinic_id);
create index if not exists clinic_savings_log_saved_at_idx on clinic_savings_log(saved_at);
