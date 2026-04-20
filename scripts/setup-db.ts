/**
 * Creates the Dentago product tables in Supabase and seeds them.
 * Run with: npx tsx scripts/setup-db.ts
 */

import { createClient } from "@supabase/supabase-js";
import { PRODUCTS, ALL_SUPPLIERS } from "../lib/products";

const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

async function run() {
  console.log("Creating tables...");

  // Create tables via RPC (raw SQL)
  const { error: createErr } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS dentago_suppliers (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        website TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dentago_products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        category TEXT NOT NULL,
        image TEXT NOT NULL,
        description TEXT NOT NULL,
        pack_size TEXT NOT NULL,
        specs JSONB NOT NULL DEFAULT '[]',
        similars INTEGER[] NOT NULL DEFAULT '{}',
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

      CREATE INDEX IF NOT EXISTS idx_dentago_products_category ON dentago_products(category);
      CREATE INDEX IF NOT EXISTS idx_dentago_sp_product ON dentago_supplier_products(product_id);
      CREATE INDEX IF NOT EXISTS idx_dentago_sp_supplier ON dentago_supplier_products(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_dentago_sp_stock ON dentago_supplier_products(stock);
    `,
  });

  if (createErr) {
    // exec_sql RPC may not exist — try via direct SQL using REST
    console.log("RPC not available, tables may already exist. Continuing with upsert...");
  } else {
    console.log("Tables created.");
  }

  // ── Seed suppliers ──────────────────────────────────────────────────────
  console.log("Seeding suppliers...");
  const { data: suppliers, error: supErr } = await supabase
    .from("dentago_suppliers")
    .upsert(
      ALL_SUPPLIERS.map((name) => ({ name })),
      { onConflict: "name", ignoreDuplicates: false }
    )
    .select("id, name");

  if (supErr) throw new Error(`Suppliers error: ${supErr.message}`);
  const supplierMap = Object.fromEntries((suppliers ?? []).map((s) => [s.name, s.id]));
  console.log(`  ${suppliers?.length} suppliers seeded.`);

  // ── Seed products ───────────────────────────────────────────────────────
  console.log("Seeding products...");
  for (const p of PRODUCTS) {
    // Upsert product
    const { data: prod, error: prodErr } = await supabase
      .from("dentago_products")
      .upsert(
        {
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          image: p.image,
          description: p.description,
          pack_size: p.packSize,
          specs: p.specs,
          similars: p.similars,
        },
        { onConflict: "id" }
      )
      .select("id")
      .single();

    if (prodErr) throw new Error(`Product ${p.id} error: ${prodErr.message}`);

    // Upsert supplier_products
    const spRows = p.suppliers.map((s) => ({
      product_id: prod.id,
      supplier_id: supplierMap[s.name],
      price: s.price,
      stock: s.stock,
      delivery: s.delivery,
      sku: s.sku,
      pack_size: s.packSize ?? null,
    }));

    const { error: spErr } = await supabase
      .from("dentago_supplier_products")
      .upsert(spRows, { onConflict: "product_id,supplier_id" });

    if (spErr) throw new Error(`SupplierProducts for product ${p.id}: ${spErr.message}`);
    process.stdout.write(`  ✓ ${p.name.slice(0, 60)}\n`);
  }

  console.log("\nDone! Database seeded with", PRODUCTS.length, "products.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
