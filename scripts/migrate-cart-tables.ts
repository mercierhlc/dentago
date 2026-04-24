import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

async function main() {
  // Drop old tables and recreate with correct schema
  const sql = `
    -- Drop old incompatible tables
    DROP TABLE IF EXISTS cart_items CASCADE;
    DROP TABLE IF EXISTS carts CASCADE;

    -- Create carts table tied to clinic_accounts
    CREATE TABLE carts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id   UUID NOT NULL REFERENCES clinic_accounts(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(clinic_id, status)
    );

    -- Create cart_items table
    CREATE TABLE cart_items (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id         UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id      INTEGER NOT NULL REFERENCES dentago_products(id),
      supplier_id     UUID NOT NULL REFERENCES dentago_suppliers(id),
      quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      unit_price      NUMERIC(10,2) NOT NULL,
      pack_size       TEXT,
      sku             TEXT,
      added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(cart_id, product_id, supplier_id)
    );

    -- Index for fast cart lookups
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
    CREATE INDEX IF NOT EXISTS idx_carts_clinic_id ON carts(clinic_id);
  `;

  const { error } = await supabase.rpc("exec_sql", { sql });

  if (error) {
    // rpc exec_sql might not exist — try direct via pg connection
    console.error("RPC failed, trying alternative:", error.message);

    // Insert test to verify tables exist after manual creation
    console.log("\nPlease run this SQL in Supabase SQL Editor:");
    console.log("https://supabase.com/dashboard/project/wybqjycfpauwlcrqgtfb/sql/new");
    console.log("\n--- SQL TO RUN ---");
    console.log(sql);
    console.log("--- END SQL ---");
    return;
  }

  console.log("✅ Cart tables migrated successfully");
}

main().catch(console.error);
