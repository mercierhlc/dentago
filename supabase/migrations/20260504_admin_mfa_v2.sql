-- Admin MFA + Verification Audit Log v2
-- ========================================
-- 1. user_roles table — maps auth.users to application roles
-- 2. verification_audit — add admin_auth_user_id uuid FK for Supabase Auth
-- 3. RLS on verification_audit — INSERT requires aal2 + admin role
-- ========================================

-- ── 1. user_roles ──────────────────────────────────────────────────────────
create table if not exists user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role    text not null check (role in ('admin', 'supplier', 'clinic')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table user_roles enable row level security;

-- Only service role can manage roles; no public read
create policy "service_only_user_roles" on user_roles
  using (false)
  with check (false);

-- Index for fast role lookups
create index if not exists user_roles_user_id_idx on user_roles (user_id);

-- ── 2. verification_audit — add uuid FK column for Supabase Auth users ──────
-- Keep existing admin_user_id (text) for backwards compat; add new FK column
alter table verification_audit
  add column if not exists auth_user_id uuid references auth.users;

-- ── 3. RLS — replace service_only with aal2-scoped policies ─────────────────
-- Drop the blanket deny-all policy from the initial migration
drop policy if exists "service_only" on verification_audit;

-- Helper: check if the current JWT bearer has the admin role
-- (stored in user_roles table OR in raw_app_meta_data->>'role')
create or replace function is_admin_aal2()
returns boolean
language sql
security definer
stable
as $$
  select (
    -- must be authenticated at assurance level 2 (MFA verified)
    (auth.jwt() ->> 'aal') = 'aal2'
    and
    -- must have admin role in user_roles OR in app_metadata
    (
      exists (
        select 1 from user_roles
        where user_id = auth.uid()
        and role = 'admin'
      )
      or
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );
$$;

-- INSERT allowed only for aal2 admins
create policy "admin_aal2_insert" on verification_audit
  for insert
  with check (is_admin_aal2());

-- SELECT allowed only for aal2 admins (read their own audit trail)
create policy "admin_aal2_select" on verification_audit
  for select
  using (is_admin_aal2());

-- No UPDATE or DELETE policies — append-only by design
