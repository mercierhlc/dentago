-- DSO Multi-Location Structure
-- Parent organisation (DSO) accounts with child practice accounts
-- and a consolidated spend view across all practices.

-- ── 1. DSO organisations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dso_organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dso_orgs_created_by ON dso_organisations(created_by);

-- ── 2. Link practices (clinic_accounts) to a DSO ──────────────────────────────
ALTER TABLE clinic_accounts
  ADD COLUMN IF NOT EXISTS dso_id UUID REFERENCES dso_organisations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_dso ON clinic_accounts(dso_id);

-- ── 3. DSO-level users (admins who span multiple practices) ───────────────────
CREATE TABLE IF NOT EXISTS dso_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dso_id        UUID NOT NULL REFERENCES dso_organisations(id) ON DELETE CASCADE,
  auth_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('owner', 'admin', 'viewer')),
  name          TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dso_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_dso_users_dso  ON dso_users(dso_id);
CREATE INDEX IF NOT EXISTS idx_dso_users_auth ON dso_users(auth_user_id);

-- ── 4. Consolidated spend view ────────────────────────────────────────────────
-- Aggregates dentago_orders by clinic, rolling up to dso level.
-- Accessible to: DSO users (read across all child clinics), clinic users (own clinic only).
CREATE OR REPLACE VIEW dso_spend_summary AS
SELECT
  ca.dso_id,
  ca.id                                      AS clinic_id,
  ca.clinic_name,
  ca.email                                   AS clinic_email,
  COUNT(o.id)                                AS order_count,
  COALESCE(SUM(o.total_amount), 0)           AS total_spend,
  COALESCE(SUM(CASE
    WHEN o.created_at >= date_trunc('month', NOW())
    THEN o.total_amount ELSE 0
  END), 0)                                   AS mtd_spend,
  COALESCE(SUM(CASE
    WHEN o.created_at >= date_trunc('year', NOW())
    THEN o.total_amount ELSE 0
  END), 0)                                   AS ytd_spend,
  MAX(o.created_at)                          AS last_order_at
FROM clinic_accounts ca
LEFT JOIN dentago_orders o
  ON o.clinic_id = ca.id
  AND o.status   != 'cancelled'
WHERE ca.dso_id IS NOT NULL
GROUP BY ca.dso_id, ca.id, ca.clinic_name, ca.email;

-- ── 5. Per-supplier breakdown per DSO ─────────────────────────────────────────
CREATE OR REPLACE VIEW dso_supplier_spend AS
SELECT
  ca.dso_id,
  oi.supplier_id,
  ds.name                                    AS supplier_name,
  COUNT(DISTINCT o.id)                       AS order_count,
  SUM(oi.quantity * oi.unit_price)           AS total_spend,
  SUM(CASE
    WHEN o.created_at >= date_trunc('month', NOW())
    THEN oi.quantity * oi.unit_price ELSE 0
  END)                                       AS mtd_spend
FROM dentago_order_items oi
JOIN dentago_orders o     ON o.id         = oi.order_id
JOIN clinic_accounts ca   ON ca.id        = o.clinic_id
LEFT JOIN dentago_suppliers ds ON ds.id::text = oi.supplier_id::text
WHERE ca.dso_id IS NOT NULL
  AND o.status != 'cancelled'
GROUP BY ca.dso_id, oi.supplier_id, ds.name;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE dso_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dso_users         ENABLE ROW LEVEL SECURITY;

-- DSO orgs: readable by members, writable by owner
CREATE POLICY "dso_orgs_member_read" ON dso_organisations
  FOR SELECT USING (
    id IN (SELECT dso_id FROM dso_users WHERE auth_user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "dso_orgs_owner_write" ON dso_organisations
  FOR ALL USING (created_by = auth.uid());

-- DSO users: members can see their own DSO's user list; owners can manage
CREATE POLICY "dso_users_member_read" ON dso_users
  FOR SELECT USING (
    dso_id IN (SELECT dso_id FROM dso_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "dso_users_owner_manage" ON dso_users
  FOR ALL USING (
    dso_id IN (
      SELECT id FROM dso_organisations
      WHERE created_by = auth.uid()
    )
    OR
    dso_id IN (
      SELECT dso_id FROM dso_users WHERE auth_user_id = auth.uid() AND role = 'owner'
    )
  );

-- Grant service-role access to the views (Supabase service role bypasses RLS)
GRANT SELECT ON dso_spend_summary  TO authenticated;
GRANT SELECT ON dso_supplier_spend TO authenticated;

-- ── 7. Helper function: is the caller a DSO member for a given org? ───────────
CREATE OR REPLACE FUNCTION is_dso_member(p_dso_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM dso_users
    WHERE dso_id = p_dso_id AND auth_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM dso_organisations
    WHERE id = p_dso_id AND created_by = auth.uid()
  );
$$;
