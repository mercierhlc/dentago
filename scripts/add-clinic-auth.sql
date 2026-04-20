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

-- RLS
ALTER TABLE clinic_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_suppliers ENABLE ROW LEVEL SECURITY;

-- Clinics can read/update their own account
CREATE POLICY "Clinic read own account" ON clinic_accounts
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Clinic update own account" ON clinic_accounts
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Service role can do everything (for API routes using supabaseAdmin)
CREATE POLICY "Service full access clinic_accounts" ON clinic_accounts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service full access clinic_suppliers" ON clinic_suppliers
  FOR ALL USING (true) WITH CHECK (true);
