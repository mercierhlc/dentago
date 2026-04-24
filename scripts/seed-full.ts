import { createClient } from "@supabase/supabase-js";
import { PRODUCTS, ALL_SUPPLIERS } from "../lib/products";

const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

async function main() {
  // Upsert suppliers
  const supplierRows = ALL_SUPPLIERS.map((name, i) => ({ id: i + 1, name }));
  // Upsert suppliers by name (UUID pk auto-assigned)
  const { error: suppErr } = await supabase
    .from("dentago_suppliers")
    .upsert(ALL_SUPPLIERS.map(name => ({ name })), { onConflict: "name" });
  if (suppErr) { console.error("Supplier upsert failed:", suppErr); process.exit(1); }

  const { data: dbSuppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const supplierIdMap = Object.fromEntries((dbSuppliers ?? []).map((s: { id: string; name: string }) => [s.name, s.id]));
  console.log(`✓ ${Object.keys(supplierIdMap).length} suppliers ready`);

  // Upsert products
  for (const p of PRODUCTS) {
    const { error: pErr } = await supabase.from("dentago_products").upsert({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      image: p.image,
      pack_size: p.packSize,
      description: p.description,
      specs: p.specs,
      similars: p.similars,
    }, { onConflict: "id" });
    if (pErr) { console.error(`  ✗ [${p.id}] ${p.name}:`, pErr.message); continue; }

    for (const s of p.suppliers) {
      const supplier_id = supplierIdMap[s.name];
      if (!supplier_id) { console.warn(`  ! Unknown supplier: ${s.name}`); continue; }
      const { error: sjErr } = await supabase
        .from("dentago_supplier_products")
        .upsert({
          product_id: p.id,
          supplier_id,
          price: s.price,
          stock: s.stock,
          delivery: s.delivery,
          sku: s.sku,
          pack_size: s.packSize ?? p.packSize,
        }, { onConflict: "product_id,supplier_id" });
      if (sjErr) console.error(`  ✗ SP [${p.id}/${s.name}]:`, sjErr.message);
    }

    console.log(`  ✓ [${p.id}] ${p.name.slice(0, 55)}`);
  }

  console.log(`\n✅ Database seeded with ${PRODUCTS.length} products.`);
}

main().catch(console.error);
