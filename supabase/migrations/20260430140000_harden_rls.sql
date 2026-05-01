-- Dentago — RLS hardening (run once in Supabase SQL Editor or via `supabase db push`)
--
-- Fixes critical issues:
--   • Policies named "Service role…" / "Service full access…" used USING (true) for ALL roles,
--     which allowed the anon key full access to clinic_accounts, orders, etc.
--   • Service role bypasses RLS — those policies are unnecessary for server routes and unsafe for clients.
--
-- After running: test onboarding (step2→step3 uploads), login redirect, /search as a clinic,
-- and admin dashboards (service role unchanged).

-- ── 0. Drop legacy / unsafe policies (names from repo scripts) ─────────────────

DROP POLICY IF EXISTS "Public read products" ON public.dentago_products;
DROP POLICY IF EXISTS "Public read suppliers" ON public.dentago_suppliers;
DROP POLICY IF EXISTS "Public read supplier_products" ON public.dentago_supplier_products;
DROP POLICY IF EXISTS "Service role full access orders" ON public.dentago_orders;
DROP POLICY IF EXISTS "Service role full access order_items" ON public.dentago_order_items;

DROP POLICY IF EXISTS "Clinic read own account" ON public.clinic_accounts;
DROP POLICY IF EXISTS "Clinic update own account" ON public.clinic_accounts;
DROP POLICY IF EXISTS "Service full access clinic_accounts" ON public.clinic_accounts;
DROP POLICY IF EXISTS "Service full access clinic_suppliers" ON public.clinic_suppliers;

DROP POLICY IF EXISTS "service role only" ON public.price_cache;
DROP POLICY IF EXISTS "service role only" ON public.dentago_price_history;
DROP POLICY IF EXISTS "service role only" ON public.leads;

-- Idempotent: drop our replacement policies if re-running this migration
DROP POLICY IF EXISTS "dentago_products_select_public" ON public.dentago_products;
DROP POLICY IF EXISTS "dentago_suppliers_select_public" ON public.dentago_suppliers;
DROP POLICY IF EXISTS "dentago_supplier_products_select_public" ON public.dentago_supplier_products;
DROP POLICY IF EXISTS "clinic_accounts_select_own" ON public.clinic_accounts;
DROP POLICY IF EXISTS "clinic_accounts_update_own" ON public.clinic_accounts;
DROP POLICY IF EXISTS "clinic_suppliers_select_own" ON public.clinic_suppliers;
DROP POLICY IF EXISTS "clinic_suppliers_write_own" ON public.clinic_suppliers;
DROP POLICY IF EXISTS "clinic_suppliers_tenant" ON public.clinic_suppliers;
DROP POLICY IF EXISTS "price_cache_clinic_isolation" ON public.price_cache;

-- ── 1. Catalog (public read, no client writes) ─────────────────────────────────

ALTER TABLE public.dentago_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentago_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentago_supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dentago_products_select_public"
  ON public.dentago_products FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "dentago_suppliers_select_public"
  ON public.dentago_suppliers FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "dentago_supplier_products_select_public"
  ON public.dentago_supplier_products FOR SELECT TO anon, authenticated USING (true);

-- ── 2. Orders — API/service only (no direct browser access) ───────────────────

ALTER TABLE public.dentago_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentago_order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dentago_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dentago_order_items FORCE ROW LEVEL SECURITY;

-- (intentionally no policies for anon/authenticated)

-- ── 3. Clinic tenant data ─────────────────────────────────────────────────────

ALTER TABLE public.clinic_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_suppliers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clinic_accounts FORCE ROW LEVEL SECURITY;

CREATE POLICY "clinic_accounts_select_own"
  ON public.clinic_accounts FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "clinic_accounts_update_own"
  ON public.clinic_accounts FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Tenant isolation (read + write for authenticated clinic users; API still uses service role)
CREATE POLICY "clinic_suppliers_tenant"
  ON public.clinic_suppliers FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  );

-- supplier_credentials: match clinic_id to this auth user
ALTER TABLE public.supplier_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_credentials_clinic" ON public.supplier_credentials;
CREATE POLICY "supplier_credentials_clinic"
  ON public.supplier_credentials FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  );

-- price_cache: clinics may only touch their own rows (API still uses service role)
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_cache FORCE ROW LEVEL SECURITY;

CREATE POLICY "price_cache_clinic_isolation"
  ON public.price_cache FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  );

-- ── 4. Onboarding tables (static HTML uses anon key + session → authenticated) ─

ALTER TABLE IF EXISTS public.clinic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clinic_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_profiles_own" ON public.clinic_profiles;
CREATE POLICY "clinic_profiles_own"
  ON public.clinic_profiles FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

ALTER TABLE IF EXISTS public.clinic_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clinic_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_documents_own" ON public.clinic_documents;
CREATE POLICY "clinic_documents_own"
  ON public.clinic_documents FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 5. Admin-only tables (no client policies) ─────────────────────────────────

ALTER TABLE IF EXISTS public.supplier_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_connections FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

ALTER TABLE public.dentago_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentago_price_history FORCE ROW LEVEL SECURITY;

-- public.suppliers (UUID): internal catalogue / credentials FK; no direct client access
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers FORCE ROW LEVEL SECURITY;

-- supplier portal mapping
ALTER TABLE public.supplier_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_accounts_own" ON public.supplier_accounts;
CREATE POLICY "supplier_accounts_own"
  ON public.supplier_accounts FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ── 6. Shopping carts ──────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.carts FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cart_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts_clinic" ON public.carts;
CREATE POLICY "carts_clinic"
  ON public.carts FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cart_items_via_cart" ON public.cart_items;
CREATE POLICY "cart_items_via_cart"
  ON public.cart_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carts ct
      WHERE ct.id = cart_id
        AND ct.clinic_id IN (
          SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts ct
      WHERE ct.id = cart_id
        AND ct.clinic_id IN (
          SELECT c.id FROM public.clinic_accounts c WHERE c.auth_user_id = auth.uid()
        )
    )
  );

-- ── 7. Storage: documents bucket — own-folder only (path: {auth.uid()}/...) ────
-- Remove any overly broad "public" policies on this bucket in the Dashboard if present.

DROP POLICY IF EXISTS "documents_select_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_own" ON storage.objects;

CREATE POLICY "documents_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "documents_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "documents_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "documents_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
