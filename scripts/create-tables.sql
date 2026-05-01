-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wybqjycfpauwlcrqgtfb/sql/new

CREATE TABLE IF NOT EXISTS dentago_suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dentago_products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT NOT NULL,
  description TEXT NOT NULL,
  pack_size TEXT NOT NULL,
  specs JSONB NOT NULL DEFAULT '[]',
  similars INTEGER[] NOT NULL DEFAULT '{}',
  variations INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dentago_supplier_products (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES dentago_products(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES dentago_suppliers(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  stock BOOLEAN NOT NULL DEFAULT TRUE,
  delivery TEXT NOT NULL,
  sku TEXT NOT NULL,
  pack_size TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS dentago_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name TEXT NOT NULL,
  clinic_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dentago_order_items (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES dentago_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES dentago_products(id),
  supplier_id INTEGER NOT NULL REFERENCES dentago_suppliers(id),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  pack_size TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dentago_products_category ON dentago_products(category);
CREATE INDEX IF NOT EXISTS idx_dentago_sp_product ON dentago_supplier_products(product_id);
CREATE INDEX IF NOT EXISTS idx_dentago_sp_supplier ON dentago_supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_dentago_sp_stock ON dentago_supplier_products(stock);
CREATE INDEX IF NOT EXISTS idx_dentago_orders_status ON dentago_orders(status);
CREATE INDEX IF NOT EXISTS idx_dentago_order_items_order ON dentago_order_items(order_id);

-- RLS: full policy set in supabase/migrations/20260430140000_harden_rls.sql (run after this file).
-- Never use USING (true) FOR ALL without TO service_role — the anon key would get full access.
ALTER TABLE dentago_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE dentago_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dentago_supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE dentago_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dentago_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dentago_products_select_public" ON dentago_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "dentago_suppliers_select_public" ON dentago_suppliers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "dentago_supplier_products_select_public" ON dentago_supplier_products FOR SELECT TO anon, authenticated USING (true);
-- Orders: no policies for anon/authenticated — only service_role (server) may access via API.
