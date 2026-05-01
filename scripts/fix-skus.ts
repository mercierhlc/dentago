/**
 * fix-skus.ts
 *
 * Deletes all fake/seeded supplier_products rows.
 * Keeps only real scraped data:
 *   - Henry Schein: scraped numeric SKUs (remove HEN- prefix fakes)
 *   - DD Group: scraped alphanumeric SKUs (NAA015, AAA335 format)
 *   - Dental Sky: real SKUs only (remove DS- prefix fakes + TRUSTPILOT garbage)
 *
 * ALL other suppliers have 100% fabricated SKUs and are wiped entirely.
 */

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

// Supplier IDs
const SUPPLIER_IDS = {
  HENRY_SCHEIN: 1,
  KENT_EXPRESS: 2,
  DENTAL_SKY: 3,
  DHB: 4,
  TRYCARE: 5,
  DMI: 6,
  WRIGHTS: 7,
  CLARK_DENTAL: 8,
  JS_DAVIS: 9,
  PATTERSON: 10,
  MEDENTRA: 11,
  TOTAL_DENTAL: 12,
  AMALGADENT: 13,
  NUVELO: 14,
  DENTAL_DIRECTORY: 15,
  DD_GROUP: 76,
};

// Entirely fake suppliers — wipe all rows
const FAKE_SUPPLIER_IDS = [
  SUPPLIER_IDS.KENT_EXPRESS,
  SUPPLIER_IDS.DHB,
  SUPPLIER_IDS.TRYCARE,
  SUPPLIER_IDS.DMI,
  SUPPLIER_IDS.WRIGHTS,
  SUPPLIER_IDS.CLARK_DENTAL,
  SUPPLIER_IDS.JS_DAVIS,
  SUPPLIER_IDS.PATTERSON,
  SUPPLIER_IDS.MEDENTRA,
  SUPPLIER_IDS.TOTAL_DENTAL,
  SUPPLIER_IDS.AMALGADENT,
  SUPPLIER_IDS.NUVELO,
  SUPPLIER_IDS.DENTAL_DIRECTORY,
];

async function deleteInBatches(
  supplierId: number,
  extraFilter?: (query: any) => any,
  label = ""
): Promise<number> {
  let deleted = 0;
  while (true) {
    // Fetch IDs to delete in batches of 500
    let q = sb
      .from("dentago_supplier_products")
      .select("product_id")
      .eq("supplier_id", supplierId)
      .limit(500);
    if (extraFilter) q = extraFilter(q);

    const { data, error } = await q;
    if (error) { console.error("Fetch error:", error.message); break; }
    if (!data || data.length === 0) break;

    const ids = data.map((r: any) => r.product_id);
    const { error: delErr, count } = await sb
      .from("dentago_supplier_products")
      .delete({ count: "exact" })
      .eq("supplier_id", supplierId)
      .in("product_id", ids);

    if (delErr) { console.error("Delete error:", delErr.message); break; }
    deleted += count ?? 0;
    console.log(`  ${label} — deleted ${deleted} so far...`);
    if (data.length < 500) break;
  }
  return deleted;
}

async function main() {
  console.log("=== SKU Cleanup — removing all fake supplier data ===\n");

  // 1. Wipe entirely fake suppliers
  for (const sid of FAKE_SUPPLIER_IDS) {
    const { data: s } = await sb.from("dentago_suppliers").select("name").eq("id", sid).single();
    const name = s?.name ?? `supplier_id=${sid}`;
    const { error, count } = await sb
      .from("dentago_supplier_products")
      .delete({ count: "exact" })
      .eq("supplier_id", sid);
    if (error) {
      console.error(`❌ ${name}: ${error.message}`);
    } else {
      console.log(`✅ ${name}: deleted ${count} fake rows`);
    }
  }

  // 2. Henry Schein — delete HEN- prefixed fakes only
  console.log("\n🔧 Henry Schein — removing HEN- prefix fakes...");
  const { error: hsErr, count: hsCount } = await sb
    .from("dentago_supplier_products")
    .delete({ count: "exact" })
    .eq("supplier_id", SUPPLIER_IDS.HENRY_SCHEIN)
    .ilike("sku", "HEN-%");
  if (hsErr) {
    console.error("❌ HS delete error:", hsErr.message);
  } else {
    console.log(`✅ Henry Schein: deleted ${hsCount} HEN- fake rows`);
  }

  // 3. Dental Sky — delete DS- prefix fakes + TRUSTPILOT garbage
  console.log("\n🔧 Dental Sky — removing DS- prefix fakes...");
  const { error: dsErr1, count: dsCount1 } = await sb
    .from("dentago_supplier_products")
    .delete({ count: "exact" })
    .eq("supplier_id", SUPPLIER_IDS.DENTAL_SKY)
    .ilike("sku", "DS-%");
  console.log(`  DS- prefix rows deleted: ${dsCount1} (err: ${dsErr1?.message ?? "none"})`);

  const { error: dsErr2, count: dsCount2 } = await sb
    .from("dentago_supplier_products")
    .delete({ count: "exact" })
    .eq("supplier_id", SUPPLIER_IDS.DENTAL_SKY)
    .ilike("sku", "%TRUSTPILOT%");
  console.log(`  TRUSTPILOT garbage rows deleted: ${dsCount2} (err: ${dsErr2?.message ?? "none"})`);

  // Final count
  console.log("\n=== Final state ===");
  const { data: suppliers } = await sb.from("dentago_suppliers").select("id, name");
  for (const s of (suppliers ?? [])) {
    if ((s as any).name === "Test Supplier Co") continue;
    const { count } = await sb
      .from("dentago_supplier_products")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", (s as any).id);
    if ((count ?? 0) > 0) {
      console.log(`  ${((s as any).name as string).padEnd(25)} ${count} real rows`);
    }
  }
}

main().catch(console.error);
