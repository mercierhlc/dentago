/**
 * scrape-ds-categories.ts
 *
 * Directly crawls Dental Sky category pages (paginated Magento 2)
 * to collect 1,000+ unique product URLs, then scrapes each for real prices.
 * Seeds to Supabase with DS prices + calibrated competitor prices.
 *
 * No Google needed — uses DS's own category pagination.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// All Dental Sky category pages to crawl (paginated)
const CATEGORIES = [
  // Anaesthetics
  { url: "https://www.dentalsky.com/all-products/anaesthetics/local-anaesthetics.html", category: "Anaesthetics", pages: 5 },
  { url: "https://www.dentalsky.com/all-products/anaesthetics/topical-anaesthetics.html", category: "Anaesthetics", pages: 3 },
  // Composites & Bonding
  { url: "https://www.dentalsky.com/all-products/restoratives/dental-composites.html", category: "Composites & Bonding", pages: 5 },
  { url: "https://www.dentalsky.com/all-products/restoratives/bonding-adhesives.html", category: "Composites & Bonding", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/restoratives/dental-cements.html", category: "Cements & Liners", pages: 5 },
  { url: "https://www.dentalsky.com/all-products/restoratives/glass-ionomer-cement.html", category: "Cements & Liners", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/restoratives/dental-liners-bases.html", category: "Cements & Liners", pages: 3 },
  // Endodontics
  { url: "https://www.dentalsky.com/all-products/endodontics/manual-instruments.html", category: "Endodontics", pages: 5 },
  { url: "https://www.dentalsky.com/all-products/endodontics/rotary-instruments.html", category: "Endodontics", pages: 5 },
  { url: "https://www.dentalsky.com/all-products/endodontics/root-canal-sealers.html", category: "Endodontics", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/endodontics/irrigation-solutions.html", category: "Endodontics", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/endodontics/obturators-gutta-percha.html", category: "Endodontics", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/endodontics/pulp-capping.html", category: "Endodontics", pages: 2 },
  // Impression
  { url: "https://www.dentalsky.com/all-products/impression-materials/alginate.html", category: "Impression Materials", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/impression-materials/vinyl-polysiloxane.html", category: "Impression Materials", pages: 5 },
  { url: "https://www.dentalsky.com/all-products/impression-materials/polyether.html", category: "Impression Materials", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/impression-materials/impression-trays.html", category: "Impression Materials", pages: 4 },
  // Infection control
  { url: "https://www.dentalsky.com/all-products/infection-control/gloves/nitrile-gloves.html", category: "Infection Control", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/infection-control/gloves/latex-gloves.html", category: "Infection Control", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/infection-control/gloves/vinyl-gloves.html", category: "Infection Control", pages: 2 },
  { url: "https://www.dentalsky.com/all-products/infection-control/face-masks/type-iir.html", category: "Infection Control", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/infection-control/face-masks/ffp2.html", category: "Infection Control", pages: 2 },
  { url: "https://www.dentalsky.com/all-products/infection-control/surface-disinfection/surface-wipes.html", category: "Infection Control", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/infection-control/surface-disinfection/surface-sprays.html", category: "Infection Control", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/infection-control/sterilisation/sterilisation-pouches.html", category: "Infection Control", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/infection-control/sterilisation/autoclave-consumables.html", category: "Infection Control", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/infection-control/hand-hygiene/hand-soap.html", category: "Infection Control", pages: 2 },
  { url: "https://www.dentalsky.com/all-products/infection-control/hand-hygiene/hand-gel.html", category: "Infection Control", pages: 2 },
  // Instruments
  { url: "https://www.dentalsky.com/all-products/hand-instruments/mirrors.html", category: "Instruments", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/hand-instruments/probes.html", category: "Instruments", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/hand-instruments/tweezers.html", category: "Instruments", pages: 2 },
  { url: "https://www.dentalsky.com/all-products/hand-instruments/scalers-curettes.html", category: "Instruments", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/hand-instruments/elevators-luxators.html", category: "Instruments", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/hand-instruments/extraction-forceps.html", category: "Instruments", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/hand-instruments/amalgam-instruments.html", category: "Instruments", pages: 2 },
  { url: "https://www.dentalsky.com/all-products/hand-instruments/composite-instruments.html", category: "Instruments", pages: 3 },
  // Orthodontics
  { url: "https://www.dentalsky.com/all-products/orthodontics/brackets.html", category: "Orthodontics", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/orthodontics/archwires.html", category: "Orthodontics", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/orthodontics/elastics-auxiliaries.html", category: "Orthodontics", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/orthodontics/bands.html", category: "Orthodontics", pages: 3 },
  // Polishing
  { url: "https://www.dentalsky.com/all-products/preventive/prophy-paste.html", category: "Preventive", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/preventive/polishing-discs-cups.html", category: "Preventive", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/preventive/fluoride-treatments.html", category: "Preventive", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/preventive/fissure-sealants.html", category: "Preventive", pages: 2 },
  // Radiology
  { url: "https://www.dentalsky.com/all-products/radiology/x-ray-films.html", category: "Radiology", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/radiology/phosphor-plates.html", category: "Radiology", pages: 2 },
  // Disposables
  { url: "https://www.dentalsky.com/all-products/disposables/bibs-aprons.html", category: "Consumables", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/disposables/cotton-products.html", category: "Consumables", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/disposables/saliva-ejectors-cannulas.html", category: "Consumables", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/disposables/cups.html", category: "Consumables", pages: 2 },
  { url: "https://www.dentalsky.com/all-products/disposables/syringes-needles.html", category: "Consumables", pages: 4 },
  { url: "https://www.dentalsky.com/all-products/disposables/mixing-tips.html", category: "Consumables", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/disposables/protective-barriers.html", category: "Consumables", pages: 3 },
  // Whitening
  { url: "https://www.dentalsky.com/all-products/teeth-whitening/whitening-kits.html", category: "Whitening", pages: 3 },
  { url: "https://www.dentalsky.com/all-products/teeth-whitening/whitening-gels.html", category: "Whitening", pages: 3 },
];

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (res.status !== 200) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractProductUrlsFromPage(html: string): string[] {
  const urls = new Set<string>();

  // Method 1: LD+JSON ItemList
  const ldMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of ldMatches) {
    try {
      const d = JSON.parse(match[1]);
      if (d["@type"] === "ItemList" && d.itemListElement) {
        for (const item of d.itemListElement) {
          const prod = item["@type"] === "Product" ? item : item.item;
          if (prod?.url && prod.url.includes("dentalsky.com")) urls.add(prod.url);
        }
      }
    } catch {}
  }

  // Method 2: product-item links in HTML
  const linkMatches = [...html.matchAll(/href="(https:\/\/www\.dentalsky\.com\/[a-z0-9][^"#?]+\.html)"/g)];
  for (const m of linkMatches) {
    const u = m[1];
    // Must not be a category page (no sub-paths or simple category structure)
    if (!u.match(/\/all-products\/[a-z-]+\/[a-z-]+\/[a-z-]+\.html$/) &&
        !u.match(/\?p=\d+/) &&
        u.split("/").length >= 5) {
      urls.add(u);
    }
  }

  return [...urls];
}

function extractPrice(html: string): number | null {
  // Magento price in JSON config
  const m1 = html.match(/"basePrice"[^}]*?"amount"\s*:\s*([\d.]+)/);
  if (m1) return parseFloat(m1[1]);
  // data attribute
  const m2 = html.match(/data-price-amount="([\d.]+)"\s*data-price-type="basePrice"/);
  if (m2) return parseFloat(m2[1]);
  // LD+JSON Product
  const m3 = html.match(/"price"\s*:\s*"?([\d.]+)"?[,\s]/);
  if (m3 && parseFloat(m3[1]) > 0) return parseFloat(m3[1]);
  return null;
}

function extractName(html: string): string {
  const m = html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);
  if (m) return m[1].replace(/&amp;/g, "&").replace(/&#039;/g, "'").trim();
  const m2 = html.match(/"name"\s*:\s*"([^"]+)"/);
  if (m2) return m2[1].replace(/\\u0027/g, "'").trim();
  return "";
}

function extractSku(html: string): string {
  const m = html.match(/class="value"\s*itemprop="sku"[^>]*>([^<]+)</) ||
             html.match(/"sku"\s*:\s*"([^"]+)"/);
  return m ? m[1].trim() : "";
}

function extractImage(html: string): string {
  const m = html.match(/"image"\s*:\s*"(https:\/\/www\.dentalsky\.com\/media\/catalog\/product[^"]+)"/);
  return m ? m[1].replace(/\\/g, "") : "";
}

function extractBrand(name: string): string {
  const brands = [
    "Septodont", "Dentsply", "Kerr", "3M", "GC", "Ivoclar", "SDI", "VOCO",
    "Ultradent", "Bisco", "Shofu", "Tokuyama", "Kuraray", "Heraeus", "COLTENE",
    "Mani", "VDW", "Micromega", "FKG", "Brasseler", "Maillefer", "Medin",
    "Hu-Friedy", "Medibase", "Smart Blue", "Aurelia", "Sempermed", "Cranberry",
    "Microflex", "Ansell", "Kimberly-Clark", "Cardinal", "Crosstex", "Henry Schein",
    "Omnii", "Pascal", "Premier", "Pulpdent", "Medline", "ProDentis",
    "Perfection Plus", "Medi-Globe", "Nopa", "Procter & Gamble", "Colgate",
    "Oral-B", "Nuvelo", "Trycare", "Aquafresh", "GSK", "SS White",
    "American Orthodontics", "Ormco", "3M Unitek", "Forestadent", "Ortho Technology",
    "Stardent", "W&H", "NSK", "KaVo", "Sirona",
  ];
  for (const b of brands) {
    if (name.includes(b)) return b;
  }
  // First capitalised word as fallback brand
  const m = name.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  return m ? m[1] : "";
}

function inferCategory(url: string, catLabel: string): string {
  const u = url.toLowerCase();
  if (u.includes("anaesthetic")) return "Anaesthetics";
  if (u.includes("composite") || u.includes("bonding")) return "Composites & Bonding";
  if (u.includes("cement") || u.includes("glass-ionomer") || u.includes("liner")) return "Cements & Liners";
  if (u.includes("endodontic") || u.includes("rotary") || u.includes("manual-instrument") || u.includes("sealer") || u.includes("obturator") || u.includes("irrigation")) return "Endodontics";
  if (u.includes("impression") || u.includes("alginate") || u.includes("polysiloxane") || u.includes("polyether") || u.includes("tray")) return "Impression Materials";
  if (u.includes("glove") || u.includes("mask") || u.includes("sterilisa") || u.includes("disinfect") || u.includes("hand-hygiene") || u.includes("infection")) return "Infection Control";
  if (u.includes("mirror") || u.includes("probe") || u.includes("scaler") || u.includes("elevator") || u.includes("forcep") || u.includes("instrument")) return "Instruments";
  if (u.includes("orthodontic") || u.includes("bracket") || u.includes("archwire") || u.includes("elastic") || u.includes("band")) return "Orthodontics";
  if (u.includes("prophy") || u.includes("polishing") || u.includes("fluoride") || u.includes("fissure") || u.includes("preventive")) return "Preventive";
  if (u.includes("radiology") || u.includes("x-ray") || u.includes("phosphor")) return "Radiology";
  if (u.includes("whiten")) return "Whitening";
  if (u.includes("disposable") || u.includes("syringe") || u.includes("mixing-tip") || u.includes("saliva") || u.includes("cotton") || u.includes("bib") || u.includes("cup")) return "Consumables";
  return catLabel;
}

function roundPrice(price: number): number {
  const endings = [0.25, 0.45, 0.50, 0.75, 0.95, 0.99];
  const base = Math.floor(price);
  const frac = price - base;
  const nearest = endings.reduce((a, b) => Math.abs(b - frac) < Math.abs(a - frac) ? b : a);
  return base + nearest;
}

function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function getCompetitorPrice(dsPrice: number, supplierId: number, productId: number, category: string): number {
  const seed = productId * supplierId;
  const r = rand(seed);
  const consumable = ["Infection Control", "Consumables"].some(c => category.includes(c));
  const clinical = ["Composites", "Endodontics", "Anaesthetics", "Cements"].some(c => category.includes(c));

  let mult: number;
  switch (supplierId) {
    case 1: mult = 1.08 + r * 0.14; break; // Henry Schein: premium
    case 2: mult = consumable ? 0.87 + r * 0.10 : 0.94 + r * 0.12; break; // Kent Express
    case 5: mult = clinical ? 0.91 + r * 0.10 : 0.97 + r * 0.10; break; // Trycare
    case 14: mult = 0.85 + r * 0.12; break; // Nuvelo: cheapest
    case 15: mult = 0.96 + r * 0.12; break; // Dental Directory
    default: mult = 0.92 + r * 0.16;
  }
  return Math.max(0.50, roundPrice(dsPrice * mult));
}

async function main() {
  console.log("🦷 Scraping 1,000 new Dental Sky products from category pages...\n");

  // Load existing data
  const { data: existingProducts } = await supabase
    .from("dentago_products")
    .select("id, name");
  const existingNames = new Set(existingProducts?.map(p => p.name.toLowerCase().replace(/\s+/g, " ").trim()) || []);

  const { data: existingDSSPs } = await supabase
    .from("dentago_supplier_products")
    .select("sku")
    .eq("supplier_id", 3);
  const existingSkus = new Set(existingDSSPs?.map(x => x.sku).filter(Boolean) || []);

  const { data: maxRow } = await supabase
    .from("dentago_products")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);
  let nextId = (maxRow?.[0]?.id ?? 468) + 1;

  console.log(`Existing products: ${existingProducts?.length}`);
  console.log(`Starting nextId: ${nextId}\n`);

  // Phase 1: Collect all product URLs from category pages
  const allProductUrls = new Map<string, string>(); // url → category

  for (const { url: catUrl, category, pages } of CATEGORIES) {
    let foundForCat = 0;
    for (let page = 1; page <= pages; page++) {
      const pageUrl = page === 1 ? catUrl : `${catUrl}?p=${page}`;
      const html = await fetchPage(pageUrl);
      if (!html) { break; }

      const urls = extractProductUrlsFromPage(html);
      for (const u of urls) {
        if (!allProductUrls.has(u)) {
          allProductUrls.set(u, category);
          foundForCat++;
        }
      }

      // Check if there's a next page (don't fetch extra pages unnecessarily)
      if (!html.includes(`?p=${page + 1}`) && !html.includes(`page=${page + 1}`)) break;

      await delay(300);
    }
    const catShort = catUrl.replace("https://www.dentalsky.com/all-products/", "").split("/")[0];
    console.log(`  ${catShort.padEnd(22)} → ${foundForCat} URLs collected`);
  }

  console.log(`\n📋 Total unique product URLs found: ${allProductUrls.size}`);

  // Phase 2: Scrape each product page
  const BATCH = 6;
  let seeded = 0;
  let skipped = 0;
  let noPrice = 0;

  const urlsToProcess = [...allProductUrls.entries()];

  for (let i = 0; i < urlsToProcess.length && seeded < 1000; i += BATCH) {
    const batch = urlsToProcess.slice(i, i + BATCH);

    await Promise.all(batch.map(async ([url, catLabel]) => {
      if (seeded >= 1000) return;

      const html = await fetchPage(url);
      if (!html || html.length < 3000) { noPrice++; return; }

      const price = extractPrice(html);
      if (!price || price <= 0) { noPrice++; return; }

      const name = extractName(html);
      if (!name || name.length < 3) { noPrice++; return; }

      // Dedup check
      const nameKey = name.toLowerCase().replace(/\s+/g, " ").trim();
      if (existingNames.has(nameKey)) { skipped++; return; }
      existingNames.add(nameKey);

      const sku = extractSku(html);
      if (sku && existingSkus.has(sku)) { skipped++; return; }

      const image = extractImage(html);
      const brand = extractBrand(name);
      const category = inferCategory(url, catLabel);

      // Insert product
      const { error } = await supabase.from("dentago_products").insert({
        id: nextId,
        name,
        brand,
        category,
        image,
        description: `${name} — trusted by UK dental practices.`,
        pack_size: "",
        specs: [],
        similars: [],
      });

      if (error) {
        if (!error.message.includes("duplicate")) {
          console.error(`  ❌ Insert error: ${error.message} — ${name.slice(0, 40)}`);
        }
        return;
      }

      const pid = nextId;
      nextId++;

      // DS supplier product
      await supabase.from("dentago_supplier_products").insert({
        product_id: pid,
        supplier_id: 3,
        price,
        stock: true,
        delivery: "1-2 working days",
        sku: sku || url.replace("https://www.dentalsky.com/", "").replace(".html", "").slice(0, 60),
        pack_size: "",
      });

      // 3-4 competitor prices
      const competitors = [
        { id: 1, delivery: "Next day" },
        { id: 2, delivery: "2-3 working days" },
        { id: 5, delivery: "2-3 working days" },
        { id: 14, delivery: "3-5 working days" },
      ];

      // Pick 3 competitors deterministically
      const numComp = 3 + (rand(pid * 7) < 0.4 ? 1 : 0);
      const shuffled = competitors.sort((a, b) => rand(pid + a.id) - rand(pid + b.id)).slice(0, numComp);

      for (const comp of shuffled) {
        const compPrice = getCompetitorPrice(price, comp.id, pid, category);
        const inStock = rand(pid * 1000 + comp.id) < 0.88;
        await supabase.from("dentago_supplier_products").insert({
          product_id: pid,
          supplier_id: comp.id,
          price: compPrice,
          stock: inStock,
          delivery: comp.delivery,
          sku: `${["", "HS", "KE", "DS", "", "TC", "", "", "", "", "", "", "", "", "NU", "DD"][comp.id] || comp.id}-${String(pid).padStart(5, "0")}`,
          pack_size: "",
        });
      }

      seeded++;
      if (seeded % 50 === 0) {
        console.log(`  💾 Seeded ${seeded} products (latest: ${name.slice(0, 50)})`);
      }
    }));

    await delay(350);
  }

  console.log(`\n✅ Seeded ${seeded} new products`);
  console.log(`   Skipped (duplicate): ${skipped}`);
  console.log(`   Failed (no price/name): ${noPrice}`);

  // Final stats
  const { count: totalProducts } = await supabase
    .from("dentago_products")
    .select("*", { count: "exact", head: true });

  const { count: totalSPs } = await supabase
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true });

  const { data: multiCheck } = await supabase
    .from("dentago_supplier_products")
    .select("product_id")
    .gt("price", 0);

  const spByProduct = new Map<number, number>();
  for (const sp of multiCheck || []) {
    spByProduct.set(sp.product_id, (spByProduct.get(sp.product_id) || 0) + 1);
  }
  const withMultiple = [...spByProduct.values()].filter(v => v >= 2).length;

  console.log(`\n📊 Final catalog:`);
  console.log(`  Total products: ${totalProducts}`);
  console.log(`  Total supplier prices: ${totalSPs}`);
  console.log(`  Products with 2+ supplier prices: ${withMultiple}`);
}

main().catch(console.error);
