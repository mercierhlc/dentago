import { supabaseAdmin } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { scrapeDentalSky } from "@/lib/scrapers";

const JEROME_CLINIC_ID = "cf3f1230-7bd5-440f-b99a-ad8765b5ccb5";

const { data } = await supabaseAdmin
  .from("supplier_credentials")
  .select("username, encrypted_password, suppliers(name)")
  .eq("clinic_id", JEROME_CLINIC_ID);

console.log("Stored credentials:");
for (const row of data ?? []) {
  const sup = Array.isArray((row as any).suppliers) ? (row as any).suppliers[0] : (row as any).suppliers;
  const pwd = decrypt((row as any).encrypted_password);
  console.log(`  ${sup?.name}: ${(row as any).username} / ${pwd}`);
}

const dsRow = (data ?? []).find((r: any) => {
  const sup = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
  return sup?.name === "Dental Sky";
}) as any;

if (dsRow) {
  const pwd = decrypt(dsRow.encrypted_password);
  console.log(`\nTesting DS scrape: ${dsRow.username} / ${pwd}`);
  const price = await scrapeDentalSky(dsRow.username, pwd, "nitrile gloves");
  console.log("Price result:", price);
  if (price) {
    console.log("✅ Login + scrape working");
  } else {
    console.log("❌ Returned null — login failed or no price found");
  }
}
