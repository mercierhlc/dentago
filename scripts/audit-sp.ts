import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);
async function main() {
  // Check product_id distribution — how many rows per product?
  const { data } = await sb.from("dentago_supplier_products")
    .select("product_id, supplier_id, sku")
    .order("product_id")
    .limit(100);

  console.log("First 100 supplier_product rows:");
  data?.forEach((r: any) => console.log(` product_id:${r.product_id} | sup:${r.supplier_id} | sku:${r.sku}`));

  // Count how many rows share the same product_id
  const { data: sample } = await sb.from("dentago_supplier_products")
    .select("product_id, supplier_id, sku")
    .eq("product_id", (data?.[0] as any)?.product_id)
    .limit(20);
  console.log("\nAll rows for product_id", (data?.[0] as any)?.product_id, ":");
  sample?.forEach((r: any) => console.log(` sup:${r.supplier_id} | sku:${r.sku}`));

  // How many products have >1 row (any supplier)?
  const { data: allSP } = await sb.from("dentago_supplier_products")
    .select("product_id, supplier_id")
    .limit(50000);

  const counts = new Map<number, number>();
  for (const r of allSP ?? []) {
    counts.set(r.product_id, (counts.get(r.product_id) || 0) + 1);
  }

  const dist: Record<number,number> = {};
  for (const [,c] of counts) dist[c] = (dist[c]||0)+1;

  console.log("\nRows-per-product distribution:");
  Object.entries(dist).sort((a,b)=>+a[0]-+b[0]).forEach(([k,v]) => console.log(` ${k} rows: ${v} products`));
  console.log("Total unique product_ids:", counts.size);
}
main().catch(console.error);
