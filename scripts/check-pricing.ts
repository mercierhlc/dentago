import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

async function main() {
  // Products with 0 price supplier products
  const { data: zeroPriced } = await supabase
    .from("dentago_supplier_products")
    .select("product_id, price, supplier_id")
    .eq("price", 0)
    .limit(5);
  console.log("Zero-priced supplier products sample:", JSON.stringify(zeroPriced, null, 2));

  // Check what the fast-scraped products look like (IDs 258+)
  const { data: newProds } = await supabase
    .from("dentago_products")
    .select("id, name, category")
    .gte("id", 258)
    .limit(10);
  console.log("New products (258+):", JSON.stringify(newProds, null, 2));

  // Check supplier_products for a new product
  const { data: sp } = await supabase
    .from("dentago_supplier_products")
    .select("*")
    .eq("product_id", 260);
  console.log("Supplier products for product 260:", JSON.stringify(sp, null, 2));

  // Count products with NO supplier products
  const { data: allProductIds } = await supabase.from("dentago_products").select("id");
  const { data: spProductIds } = await supabase.from("dentago_supplier_products").select("product_id");
  const spSet = new Set(spProductIds?.map(x => x.product_id));
  const noSupplier = allProductIds?.filter(p => !spSet.has(p.id)) ?? [];
  console.log(`Products with NO supplier products: ${noSupplier.length}`);
  console.log("First 10 IDs with no supplier:", noSupplier.slice(0, 10).map(x => x.id));
}
main().catch(console.error);
