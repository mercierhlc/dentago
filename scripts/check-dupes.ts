import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);
async function main() {
  // Find septanest entries across product table
  const { data: rows } = await sb.from("dentago_products")
    .select("id, name, brand, dentago_supplier_products(supplier_id, sku, price)")
    .ilike("name", "%septanest%")
    .limit(15);
  console.log("Septanest products in DB:");
  for (const p of rows ?? []) {
    const sups = ((p as any).dentago_supplier_products ?? []).map((s: any) => `sup${s.supplier_id}:${s.sku}`);
    console.log(` id:${(p as any).id} | ${(p as any).name?.slice(0,55)} | ${sups.join(", ")}`);
  }

  // How many products have 2+ suppliers?
  const { data: spData } = await sb.from("dentago_supplier_products").select("product_id, supplier_id").limit(50000);
  const map = new Map<number, Set<number>>();
  for (const r of spData ?? []) {
    if (!map.has(r.product_id)) map.set(r.product_id, new Set());
    map.get(r.product_id)!.add(r.supplier_id);
  }
  let single = 0, multi = 0;
  for (const [, sups] of map) { sups.size === 1 ? single++ : multi++; }
  console.log(`\nProducts with 1 supplier: ${single}`);
  console.log(`Products with 2+ suppliers: ${multi}`);
}
main().catch(console.error);
