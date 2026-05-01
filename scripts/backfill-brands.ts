/**
 * backfill-brands.ts
 *
 * Many products (especially newly scraped DHB ones) have brand = "".
 * That breaks dedup-merge.ts which groups by brand before comparing names.
 *
 * Strategy:
 *   1. Build a set of known brands from products that already have a brand set
 *   2. For each product with brand = "", inspect the first few tokens of its name
 *      and assign the longest known-brand prefix that matches.
 *   3. Persist the inferred brand to dentago_products.
 *
 * Idempotent: only updates rows where brand is currently empty.
 */

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const DRY_RUN = process.argv.includes("--dry-run");

function loadAll<T>(table: string, cols: string): Promise<T[]> {
  return new Promise(async (resolve, reject) => {
    const out: any[] = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await sb.from(table).select(cols).range(offset, offset + PAGE - 1).order("id");
      if (error) return reject(error);
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    resolve(out);
  });
}

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s\-&]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

async function main() {
  console.log(`=== Brand Backfill${DRY_RUN ? " (DRY RUN)" : ""} ===\n`);

  const products = await loadAll<{ id: number; name: string; brand: string }>(
    "dentago_products",
    "id, name, brand"
  );
  console.log(`Loaded ${products.length} products`);

  // Build known-brand set from existing brand fields
  const knownBrands = new Map<string, string>(); // normalised → display
  for (const p of products) {
    if (p.brand && p.brand.trim()) {
      const norm = p.brand.trim().toLowerCase();
      if (!knownBrands.has(norm)) knownBrands.set(norm, p.brand.trim());
    }
  }
  console.log(`Discovered ${knownBrands.size} distinct brands from existing data\n`);

  // Add a few well-known UK dental brands to bootstrap (in case all came from a single supplier)
  const SEED_BRANDS = [
    "Aurelia", "Smart", "Medibase", "Sempermed", "Ansell", "Halyard",
    "3M", "Septanest", "Septodont", "Lignospan", "Scandonest", "Citoject",
    "Dentsply", "Sirona", "Kerr", "Ivoclar", "Vivadent", "GC", "Voco",
    "Coltene", "Coltène", "Optident", "Septodont", "Tokuyama",
    "Henry Schein", "Aquasil", "Impregum", "Express", "Honigum",
    "ProTaper", "WaveOne", "Mtwo", "Reciproc",
    "Heraeus", "Kulzer", "Vita", "Ivoclar Vivadent", "Shofu", "Mizzy",
    "Cavex", "Carestream", "Acteon", "NSK", "W&H", "Bien-Air", "KaVo",
    "Sirona", "Planmeca", "Shenzhen", "Crosstex", "MedCom",
    "Ultradent", "Premier", "Prevest", "Prime Dental", "Schülke",
    "FlexiMix", "Zhermack", "Pluradent", "Pulpdent", "Cerkamed",
    "Maillefer", "VDW", "Filtek", "OptiBond", "Scotchbond", "ScotchBond",
    "Single Bond", "Adper", "Scotchbond Universal",
    "Tetric", "EvoCeram", "Estelite", "Beautifil", "Charisma",
    "TPH", "Spectrum", "Z250", "Z350", "Z550", "Solare",
    "Aquasil Ultra", "Aquasil Ultra+", "Honigum Pro",
  ];
  for (const b of SEED_BRANDS) {
    const norm = b.toLowerCase();
    if (!knownBrands.has(norm)) knownBrands.set(norm, b);
  }

  // Pre-build sorted list of normalised brands by length desc — so longer brands match first
  const sortedBrands = [...knownBrands.entries()].sort((a, b) => b[0].length - a[0].length);

  // Match products with empty brand
  const empty = products.filter(p => !p.brand || !p.brand.trim());
  console.log(`Products with empty brand: ${empty.length}`);

  let inferred = 0;
  const updates: Array<{ id: number; brand: string }> = [];

  for (const p of empty) {
    const lower = p.name.toLowerCase();
    // Scan from longest brand to shortest; use word-boundary match
    for (const [norm, display] of sortedBrands) {
      // Multi-word brand: check substring + word boundary
      const re = new RegExp(`\\b${norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(lower)) {
        updates.push({ id: p.id, brand: display });
        inferred++;
        break;
      }
    }
  }

  console.log(`Inferred brands for ${inferred}/${empty.length} products`);
  console.log(`Sample:`);
  for (const u of updates.slice(0, 10)) {
    const p = products.find(x => x.id === u.id)!;
    console.log(`  id ${u.id}: "${p.name.slice(0, 60)}" → brand: ${u.brand}`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run — no changes. Run without --dry-run to apply.`);
    return;
  }

  // Apply updates
  console.log(`\nApplying ${updates.length} brand updates...`);
  let done = 0, failed = 0;
  const BATCH = 100;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await Promise.all(batch.map(async u => {
      try {
        await sb.from("dentago_products").update({ brand: u.brand }).eq("id", u.id);
        done++;
      } catch {
        failed++;
      }
    }));
    if ((i + BATCH) % 1000 === 0 || i + BATCH >= updates.length) {
      console.log(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nDone — ${done} updated, ${failed} failed`);
}

main().catch(console.error);
