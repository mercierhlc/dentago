-- Dentago Pro — clinic extensions, staff requests, product price history, supplier scorecard
-- Safe to re-run: IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS
--
-- "plan" in product UI = column product_plan (free | pro).

-- ── clinic_accounts ───────────────────────────────────────────────────────────

ALTER TABLE public.clinic_accounts
  ADD COLUMN IF NOT EXISTS product_plan text NOT NULL DEFAULT 'free';

ALTER TABLE public.clinic_accounts
  DROP CONSTRAINT IF EXISTS clinic_accounts_product_plan_check;

ALTER TABLE public.clinic_accounts
  ADD CONSTRAINT clinic_accounts_product_plan_check
  CHECK (product_plan IN ('free', 'pro'));

ALTER TABLE public.clinic_accounts
  ADD COLUMN IF NOT EXISTS staff_request_token text;

CREATE UNIQUE INDEX IF NOT EXISTS clinic_accounts_staff_request_token_key
  ON public.clinic_accounts (staff_request_token)
  WHERE staff_request_token IS NOT NULL;

ALTER TABLE public.clinic_accounts
  ADD COLUMN IF NOT EXISTS monthly_budget numeric(12, 2);

COMMENT ON COLUMN public.clinic_accounts.product_plan IS 'free | pro — clinic product tier (Pro migration “plan”).';
COMMENT ON COLUMN public.clinic_accounts.staff_request_token IS 'Opaque token for public staff item requests (/request?token=…).';
COMMENT ON COLUMN public.clinic_accounts.monthly_budget IS 'Optional monthly procurement budget (GBP).';

-- ── clinic_staff_requests ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_staff_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinic_accounts (id) ON DELETE CASCADE,
  product_id integer REFERENCES public.dentago_products (id) ON DELETE SET NULL,
  product_name text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  note text,
  requester_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_staff_requests_clinic_status_created
  ON public.clinic_staff_requests (clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_staff_requests_clinic_id
  ON public.clinic_staff_requests (clinic_id);

ALTER TABLE public.clinic_staff_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_staff_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_staff_requests_select_own" ON public.clinic_staff_requests;
CREATE POLICY "clinic_staff_requests_select_own"
  ON public.clinic_staff_requests FOR SELECT TO authenticated
  USING (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "clinic_staff_requests_update_own" ON public.clinic_staff_requests;
CREATE POLICY "clinic_staff_requests_update_own"
  ON public.clinic_staff_requests FOR UPDATE TO authenticated
  USING (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  );

-- Inserts are performed by service role (public /api/public/staff-request); no client INSERT policy.

-- ── product_price_history (append-only; can mirror dentago_price_history writes) ─

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id bigserial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES public.dentago_products (id) ON DELETE CASCADE,
  supplier_id integer NOT NULL REFERENCES public.dentago_suppliers (id) ON DELETE CASCADE,
  price numeric NOT NULL,
  stock boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'cron',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_price_history_product_recorded
  ON public.product_price_history (product_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_price_history_supplier_recorded
  ON public.product_price_history (supplier_id, recorded_at DESC);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_history FORCE ROW LEVEL SECURITY;

-- No policies: same pattern as dentago_price_history — cron/API use service role only.

-- ── supplier_scorecard (reporting; use service role or bypass RLS for full aggregates) ─

CREATE OR REPLACE VIEW public.supplier_scorecard AS
SELECT
  oi.supplier_id,
  s.name AS supplier_name,
  COUNT(DISTINCT oi.order_id)::bigint AS order_count,
  COALESCE(SUM(oi.unit_price * oi.quantity), 0)::numeric AS total_revenue_gbp,
  MAX(o.created_at) AS last_order_at,
  CASE
    WHEN COUNT(DISTINCT oi.order_id) > 0
    THEN COALESCE(SUM(oi.unit_price * oi.quantity), 0) / NULLIF(COUNT(DISTINCT oi.order_id), 0)
    ELSE 0::numeric
  END AS avg_order_value_gbp
FROM public.dentago_order_items oi
JOIN public.dentago_orders o ON o.id = oi.order_id
JOIN public.dentago_suppliers s ON s.id = oi.supplier_id
GROUP BY oi.supplier_id, s.name;

COMMENT ON VIEW public.supplier_scorecard IS
  'Per-supplier order GMV rollup. Prefer querying with service role; RLS on underlying orders/items limits direct client reads.';
