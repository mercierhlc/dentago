import { createClient } from "@supabase/supabase-js";
const s = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

async function main() {
  // For each supplier, how many products in stock and what avg price vs DS?
  const { data: suppliers } = await s.from("dentago_suppliers").select("id, name");

  for (const sup of suppliers || []) {
    const { count: total } = await s.from("dentago_supplier_products")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", sup.id);
    const { count: inStock } = await s.from("dentago_supplier_products")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", sup.id).eq("stock", true).gt("price", 0);
    console.log(`${sup.name.padEnd(20)} | total: ${String(total).padStart(4)} | in-stock: ${String(inStock).padStart(4)}`);
  }

  // Check a sample product to see all suppliers
  const { data: sample } = await s.from("dentago_supplier_products")
    .select("supplier_id, price, stock")
    .eq("product_id", 300)
    .order("price");
  console.log("\nProduct 300 suppliers:", JSON.stringify(sample, null, 2));

  // How many products where a non-DS supplier is cheaper AND in stock?
  const { data: allSPs } = await s.from("dentago_supplier_products")
    .select("product_id, supplier_id, price, stock")
    .gt("price", 0);

  // Group by product
  const byProduct = new Map<number, Array<{supplier_id: number, price: number, stock: boolean}>>();
  for (const sp of allSPs || []) {
    if (!byProduct.has(sp.product_id)) byProduct.set(sp.product_id, []);
    byProduct.get(sp.product_id)!.push(sp);
  }

  let dsWins = 0, competitorWins = 0, tied = 0;
  for (const [pid, sps] of byProduct.entries()) {
    const inStock = sps.filter(s => s.stock && s.price > 0);
    if (inStock.length < 2) continue;
    const minPrice = Math.min(...inStock.map(s => s.price));
    const dsPrice = inStock.find(s => s.supplier_id === 3)?.price;
    if (!dsPrice) continue;
    if (dsPrice === minPrice) dsWins++;
    else if (dsPrice > minPrice) competitorWins++;
    else tied++;
  }

  console.log(`\nFor products with 2+ in-stock suppliers:`);
  console.log(`  DS wins best price: ${dsWins}`);
  console.log(`  Competitor wins best price: ${competitorWins}`);
  console.log(`  Tied: ${tied}`);
}
main().catch(console.error);
