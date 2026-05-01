-- Run in Supabase SQL Editor

-- Clinic profile (links to Supabase auth.users)
CREATE TABLE IF NOT EXISTS clinic_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL,
  clinic_name  TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Which suppliers each clinic has connected
CREATE TABLE IF NOT EXISTS clinic_suppliers (
  clinic_id      UUID NOT NULL REFERENCES clinic_accounts(id) ON DELETE CASCADE,
  supplier_id    INTEGER NOT NULL REFERENCES dentago_suppliers(id) ON DELETE CASCADE,
  account_number TEXT,
  connected_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (clinic_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_suppliers_clinic ON clinic_suppliers(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_accounts_auth_user ON clinic_accounts(auth_user_id);

-- RLS: complete policies in supabase/migrations/20260430140000_harden_rls.sql
ALTER TABLE clinic_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_accounts_select_own" ON clinic_accounts
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "clinic_accounts_update_own" ON clinic_accounts
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "clinic_suppliers_tenant" ON clinic_suppliers
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT c.id FROM clinic_accounts c WHERE c.auth_user_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT c.id FROM clinic_accounts c WHERE c.auth_user_id = auth.uid())
  );
