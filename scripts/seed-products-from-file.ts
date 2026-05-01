import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CATEGORY_MAP: Record<string, string> = {
  "glove": "PPE", "mask": "PPE", "ppe": "PPE", "apron": "PPE",
  "infection": "Infection Control", "disinfect": "Infection Control", "steril": "Infection Control", "wipe": "Infection Control", "autoclave": "Infection Control", "pouch": "Infection Control",
  "anaesth": "Anaesthetics", "cartridge": "Anaesthetics", "needle": "Anaesthetics", "articaine": "Anaesthetics", "lidocaine": "Anaesthetics",
  "composite": "Composites", "bond": "Composites", "resin": "Composites", "cement": "Composites", "ionomer": "Composites", "adhesive": "Composites",
  "endo": "Endodontics", "file": "Endodontics", "gutta": "Endodontics", "sealer": "Endodontics",
  "implant": "Implants",
  "impression": "Impression Materials", "alginate": "Impression Materials", "silicone": "Impression Materials",
  "instrument": "Instruments", "forcep": "Instruments", "probe": "Instruments", "mirror": "Instruments", "scaler": "Instruments",
  "orthodont": "Orthodontics", "bracket": "Orthodontics",
  "xray": "Diagnostics", "x-ray": "Diagnostics",
  "fluoride": "Consumables", "whitening": "Consumables", "polish": "Consumables",
};

function mapCategory(name: string, desc = ""): string {
  const lower = (name + " " + desc).toLowerCase();
  for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(kw)) return cat;
  }
  return "Consumables";
}

async function main() {
  const file = process.argv[2] || path.join(process.env.HOME!, "Downloads", "ds-voco-products.json");
  const products = JSON.parse(fs.readFileSync(file, "utf-8"));
  console.log(`Loaded ${products.length} products from ${file}`);

  const { data: existingProds } = await supabase.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (existingProds?.[0]?.id ?? 100) + 1;
  console.log(`Starting ID: ${nextId}`);

  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hsId = suppliers?.find((s: any) => s.name.toLowerCase().includes("henry"))?.id;
  console.log(`Henry Schein supplier ID: ${hsId}`);

  // Filter: only products with valid images and names
  const valid = products.filter((p: any) =>
    p.name && p.name.length > 3 &&
    p.image && p.image.startsWith("http") && !p.image.includes("placeholder")
  );
  console.log(`Valid products (with images): ${valid.length}`);

  let seeded = 0;
  for (const p of valid) {
    const category = mapCategory(p.name, p.description);

    const { error } = await supabase.from("dentago_products").upsert({
      id: nextId,
      name: p.name,
      brand: p.brand || "Dental Sky",
      category,
      image: p.image,
      pack_size: p.packSize || "1 unit",
      description: p.description || `${p.name} — professional dental supply.`,
      specs: [
        { label: "SKU", value: p.sku || `DS-${nextId}` },
        { label: "Supplier", value: p.brand || "Dental Sky" },
        { label: "Category", value: category },
      ],
      similars: [],
    }, { onConflict: "id" });

    if (!error) {
      if (hsId) {
        await supabase.from("dentago_supplier_products").upsert({
          product_id: nextId,
          supplier_id: hsId,
          price: p.price || 0,
          stock: true,
          delivery: "1-2 working days",
          sku: p.sku || `DS-${nextId}`,
          pack_size: p.packSize || "1 unit",
        }, { onConflict: "product_id,supplier_id" });
      }
      console.log(`  ✅ [${nextId}] ${p.name.slice(0, 60)}`);
      seeded++;
      nextId++;
    } else {
      console.error(`  ❌ [${nextId}] ${p.name.slice(0, 40)} — ${error.message}`);
    }
  }

  console.log(`\n🎉 ${seeded}/${valid.length} products seeded`);
}

main().catch(console.error);
