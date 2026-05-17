-- Append-only audit log for all admin verification actions
create table if not exists verification_audit (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id text not null,         -- identifier of the admin who acted
  clinic_id     uuid not null,         -- clinic_profiles.id
  action        text not null,         -- 'approved' | 'rejected' | 'pending' | 'deactivated' | 'reactivated'
  notes         text,                  -- rejection reason or freeform notes
  ip_address    text,                  -- remote IP for audit trail
  timestamp     timestamptz not null default now()
);

-- No UPDATE or DELETE — append-only
alter table verification_audit enable row level security;

-- Only service role can insert/read; no public access
create policy "service_only" on verification_audit
  using (false)
  with check (false);

-- Index for fast clinic lookups
create index if not exists verification_audit_clinic_id_idx
  on verification_audit (clinic_id, timestamp desc);
