-- Supplier portal v1 — supplier_users, supplier_invites, RLS policies
-- Run in Supabase SQL Editor or via supabase db push

-- ── 1. supplier_users table ──────────────────────────────────────────────────
-- Maps auth.users to dentago_suppliers (replaces legacy supplier_accounts)
CREATE TABLE IF NOT EXISTS public.supplier_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id   int  NOT NULL REFERENCES public.dentago_suppliers(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'manager', 'admin')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (auth_user_id),
  UNIQUE (supplier_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_users_auth_user_id ON public.supplier_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_users_supplier_id  ON public.supplier_users(supplier_id);

ALTER TABLE public.supplier_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_users FORCE ROW LEVEL SECURITY;

-- Suppliers can see their own row only
CREATE POLICY "supplier_users_select_own"
  ON public.supplier_users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ── 2. supplier_invites table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   int  NOT NULL REFERENCES public.dentago_suppliers(id) ON DELETE CASCADE,
  email         text NOT NULL,
  role          text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'manager', 'admin')),
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by    uuid REFERENCES auth.users(id),
  accepted_at   timestamptz,
  expires_at    timestamptz DEFAULT now() + interval '7 days',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invites_token       ON public.supplier_invites(token);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_supplier_id ON public.supplier_invites(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_email       ON public.supplier_invites(email);

ALTER TABLE public.supplier_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invites FORCE ROW LEVEL SECURITY;

-- Public can read invite by token (needed for accept flow via service role)
-- Service role bypasses RLS so no policy needed for server-side reads

-- ── 3. Migrate existing supplier_accounts to supplier_users ──────────────────
INSERT INTO public.supplier_users (auth_user_id, supplier_id, role)
SELECT auth_user_id, supplier_id, 'manager'
FROM public.supplier_accounts
ON CONFLICT (auth_user_id) DO NOTHING;

-- ── 4. RLS policies for orders — suppliers read their own orders only ─────────
-- Note: orders use service role in API routes so no browser-direct access needed.
-- These policies guard against any direct client access.

DROP POLICY IF EXISTS "supplier_orders_read_own" ON public.dentago_orders;
DROP POLICY IF EXISTS "supplier_order_items_read_own" ON public.dentago_order_items;

-- Suppliers can SELECT orders that contain their items
CREATE POLICY "supplier_orders_read_own"
  ON public.dentago_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dentago_order_items oi
      JOIN public.supplier_users su ON su.supplier_id = oi.supplier_id
      WHERE oi.order_id = id AND su.auth_user_id = auth.uid()
    )
  );

-- Suppliers can SELECT their own order items
CREATE POLICY "supplier_order_items_read_own"
  ON public.dentago_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.supplier_users su
      WHERE su.supplier_id = supplier_id AND su.auth_user_id = auth.uid()
    )
  );
