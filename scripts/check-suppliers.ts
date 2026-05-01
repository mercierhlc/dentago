import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

async function main() {
  const { data: suppliers } = await supabase.from("dentago_suppliers").select("*");
  console.log("Suppliers:", JSON.stringify(suppliers, null, 2));

  const { count: spCount } = await supabase.from("dentago_supplier_products").select("*", { count: "exact", head: true });
  console.log("Total supplier_products:", spCount);

  const { data: spSample } = await supabase.from("dentago_supplier_products").select("*").limit(5);
  console.log("Sample supplier_products:", JSON.stringify(spSample, null, 2));

  // How many products have price > 0?
  const { count: withPrice } = await supabase.from("dentago_supplier_products").select("*", { count: "exact", head: true }).gt("price", 0);
  console.log("Supplier products with price > 0:", withPrice);

  // Check products table for price column
  const { data: prodSample } = await supabase.from("dentago_products").select("id, name, price").limit(5);
  console.log("Products with price field:", JSON.stringify(prodSample, null, 2));
}
main().catch(console.error);
