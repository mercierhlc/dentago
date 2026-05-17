-- Approval Workflows for DSO Procurement
-- Orders above a clinic-configured threshold require manager sign-off

-- ── 1. Clinic user roles (multi-user per clinic) ──────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinic_accounts(id) ON DELETE CASCADE,
  auth_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
  name          TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (clinic_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_users_clinic ON clinic_users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_users_auth   ON clinic_users(auth_user_id);

-- ── 2. Per-clinic approval policy ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_approval_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID NOT NULL UNIQUE REFERENCES clinic_accounts(id) ON DELETE CASCADE,
  approval_threshold NUMERIC(10,2) NOT NULL DEFAULT 500.00,  -- GBP, orders above this need approval
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Approval columns on orders ─────────────────────────────────────────────
ALTER TABLE dentago_orders
  ADD COLUMN IF NOT EXISTS clinic_id          UUID REFERENCES clinic_accounts(id),
  ADD COLUMN IF NOT EXISTS submitted_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approval_status    TEXT DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required', 'pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by        UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes     TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON dentago_orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_orders_clinic_id       ON dentago_orders(clinic_id);

-- ── 4. Approval audit log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES dentago_orders(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('requested', 'approved', 'rejected', 'cancelled')),
  actor_user_id   UUID REFERENCES auth.users(id),
  actor_email     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_approvals_order ON order_approvals(order_id);

-- ── 5. RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE clinic_users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_approval_policies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_approvals           ENABLE ROW LEVEL SECURITY;

-- clinic_users: only your own clinic rows
CREATE POLICY "clinic_users_own_clinic" ON clinic_users
  FOR ALL USING (
    clinic_id IN (
      SELECT id FROM clinic_accounts WHERE auth_user_id = auth.uid()
    )
    OR
    clinic_id IN (
      SELECT clinic_id FROM clinic_users WHERE auth_user_id = auth.uid()
    )
  );

-- approval_policies: only your clinic
CREATE POLICY "approval_policy_own_clinic" ON clinic_approval_policies
  FOR ALL USING (
    clinic_id IN (
      SELECT id FROM clinic_accounts WHERE auth_user_id = auth.uid()
    )
    OR
    clinic_id IN (
      SELECT clinic_id FROM clinic_users WHERE auth_user_id = auth.uid()
    )
  );

-- order_approvals: only for orders belonging to your clinic
CREATE POLICY "order_approvals_own_clinic" ON order_approvals
  FOR ALL USING (
    order_id IN (
      SELECT o.id FROM dentago_orders o
      JOIN clinic_accounts ca ON ca.id = o.clinic_id
      WHERE ca.auth_user_id = auth.uid()
        OR ca.id IN (SELECT clinic_id FROM clinic_users WHERE auth_user_id = auth.uid())
    )
  );
