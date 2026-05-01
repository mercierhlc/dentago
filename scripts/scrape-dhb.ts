/**
 * DHB dental scraper — Magento 2 HTML
 * Fetches all category pages, extracts SKU/name/price/stock from HTML.
 * Trade price (lower) used. SKU format: AUR###, GA##, etc.
 */
import { createClient } from "@supabase/supabase-js";
import * as https from "https";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// All DHB sub-category pages (leaf nodes — avoids double-counting parent pages)
const CATEGORIES: { url: string; category: string }[] = [
  { url: "https://dhb.co.uk/anaesthetics-pharmaceuticals/anaesthetics.html", category: "Anaesthetics" },
  { url: "https://dhb.co.uk/anaesthetics-pharmaceuticals/analgesics.html", category: "Anaesthetics" },
  { url: "https://dhb.co.uk/anaesthetics-pharmaceuticals/antibiotics.html", category: "Anaesthetics" },
  { url: "https://dhb.co.uk/anaesthetics-pharmaceuticals/emergency-drugs.html", category: "Anaesthetics" },
  { url: "https://dhb.co.uk/anaesthetics-pharmaceuticals/medicaments.html", category: "Anaesthetics" },
  { url: "https://dhb.co.uk/disposables/gloves.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/disposables/masks-visors.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/disposables/needles.html", category: "Anaesthetics" },
  { url: "https://dhb.co.uk/disposables/sterilisation-pouches.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/disposables/cotton-products.html", category: "Sundries" },
  { url: "https://dhb.co.uk/disposables/barrier-protection.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/disposables/3-in-1-tips.html", category: "Sundries" },
  { url: "https://dhb.co.uk/disposables/aspirator-tips-ejectors.html", category: "Sundries" },
  { url: "https://dhb.co.uk/disposables/bibs-capes.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/disposables/dental-mirrors.html", category: "Instruments" },
  { url: "https://dhb.co.uk/disposables/gauze.html", category: "Sundries" },
  { url: "https://dhb.co.uk/disposables/indicator-strips.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/disposables/paper-products.html", category: "Sundries" },
  { url: "https://dhb.co.uk/disposables/squat-cups.html", category: "Sundries" },
  { url: "https://dhb.co.uk/disposables/tongue-depresser.html", category: "Sundries" },
  { url: "https://dhb.co.uk/disposables/tray-liners-inserts.html", category: "Sundries" },
  { url: "https://dhb.co.uk/infection-control/disinfectant-wipes.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/hand-cleaning-disinfection.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/surface-disinfection.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/instrument-disinfection.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/barrier-protection.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/aspirator-cleaner.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/detergent-wipes.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/disinfectant-powder.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/drain-disinfectant.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/waterline-treatment.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/infection-control/ultrasonic-bath-disinfection.html", category: "PPE & Infection Control" },
  { url: "https://dhb.co.uk/endodontics/endodontic-instruments.html", category: "Endodontics" },
  { url: "https://dhb.co.uk/endodontics/endodontic-materials.html", category: "Endodontics" },
  { url: "https://dhb.co.uk/endodontics/gutta-percha-points.html", category: "Endodontics" },
  { url: "https://dhb.co.uk/endodontics/paper-points.html", category: "Endodontics" },
  { url: "https://dhb.co.uk/endodontics/rubber-dams.html", category: "Endodontics" },
  { url: "https://dhb.co.uk/endodontics/accessories.html", category: "Endodontics" },
  { url: "https://dhb.co.uk/filling-materials/composite.html", category: "Composites & Restoratives" },
  { url: "https://dhb.co.uk/filling-materials/glass-ionomer.html", category: "Composites & Restoratives" },
  { url: "https://dhb.co.uk/filling-materials/amalgam.html", category: "Composites & Restoratives" },
  { url: "https://dhb.co.uk/filling-materials/matrices.html", category: "Composites & Restoratives" },
  { url: "https://dhb.co.uk/filling-materials/articulating-paper.html", category: "Composites & Restoratives" },
  { url: "https://dhb.co.uk/filling-materials/silver-glass-ionomers.html", category: "Composites & Restoratives" },
  { url: "https://dhb.co.uk/etching-bonding/bonding-systems.html", category: "Composites & Restoratives" },
  { url: "https://dhb.co.uk/etching-bonding/etching-agent.html", category: "Composites & Restoratives" },
  { url: "https://dhb.co.uk/impression-material/addition-silicone.html", category: "Impression Materials" },
  { url: "https://dhb.co.uk/impression-material/alginate.html", category: "Impression Materials" },
  { url: "https://dhb.co.uk/impression-material/polyether.html", category: "Impression Materials" },
  { url: "https://dhb.co.uk/impression-material/impression-trays.html", category: "Impression Materials" },
  { url: "https://dhb.co.uk/impression-material/bite-registration.html", category: "Impression Materials" },
  { url: "https://dhb.co.uk/liners-cements/calcium-hydroxide-liners.html", category: "Cements & Liners" },
  { url: "https://dhb.co.uk/liners-cements/crown-bridge-cementation.html", category: "Cements & Liners" },
  { url: "https://dhb.co.uk/liners-cements/glass-ionomer.html", category: "Cements & Liners" },
  { url: "https://dhb.co.uk/liners-cements/permanent-cement.html", category: "Cements & Liners" },
  { url: "https://dhb.co.uk/hand-instruments/instruments.html", category: "Instruments" },
  { url: "https://dhb.co.uk/hand-instruments/periodontal.html", category: "Instruments" },
  { url: "https://dhb.co.uk/hand-instruments/mouth-mirrors.html", category: "Instruments" },
  { url: "https://dhb.co.uk/rotary-instruments/burs.html", category: "Burs & Instruments" },
  { url: "https://dhb.co.uk/rotary-instruments/diamond-burs.html", category: "Burs & Instruments" },
  { url: "https://dhb.co.uk/rotary-instruments/steel-burs.html", category: "Burs & Instruments" },
  { url: "https://dhb.co.uk/x-ray/film.html", category: "Imaging & X-Ray" },
  { url: "https://dhb.co.uk/x-ray/holders.html", category: "Imaging & X-Ray" },
  { url: "https://dhb.co.uk/surgical/sutures.html", category: "Instruments" },
  { url: "https://dhb.co.uk/surgical/surgical-accessories.html", category: "Instruments" },
  { url: "https://dhb.co.uk/finishing-polishing/polishing.html", category: "Instruments" },
  { url: "https://dhb.co.uk/oral-hygiene/fluoride-varnish.html", category: "Patient Products" },
  { url: "https://dhb.co.uk/oral-hygiene/teeth-whitening.html", category: "Patient Products" },
  { url: "https://dhb.co.uk/posts-pins/posts.html", category: "Instruments" },
  { url: "https://dhb.co.uk/posts-pins/pins.html", category: "Instruments" },
];

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-GB,en;q=0.9",
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith("http") ? res.headers.location : "https://dhb.co.uk" + res.headers.location;
        fetchHtml(loc).then(resolve).catch(reject); return;
      }
      if (res.statusCode && res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

interface Product {
  sku: string;
  name: string;
  price: number;
  stock: boolean;
  image: string;
  category: string;
}

function parseProductsFromHtml(html: string, category: string): Product[] {
  const products: Product[] = [];
  // Split by product item blocks
  const itemBlocks = html.split(/<li[^>]*class="[^"]*product-item[^"]*"/);

  for (const block of itemBlocks.slice(1)) {
    const skuMatch = block.match(/data-product-sku="([^"]+)"/);
    if (!skuMatch) continue;
    const sku = skuMatch[1].trim();

    // Name: DHB no longer uses class="product-item-name". Pull from the product image
    // alt attribute (most reliable, human-readable). Fall back to legacy strong markup,
    // then to the product URL slug.
    const altMatch = block.match(/<img[^>]*class="[^"]*product-image-photo[^"]*"[^>]*alt="([^"]+)"/)
      || block.match(/<img[^>]*alt="([^"]+)"[^>]*class="[^"]*product-image-photo[^"]*"/)
      || block.match(/<img[^>]*alt="([^"]+)"/);
    const legacyMatch = block.match(/class="product-item-name"[^>]*>.*?<strong[^>]*>(.*?)<\/strong>/s);
    const slugMatch = block.match(/<a\s+href="https:\/\/dhb\.co\.uk\/([a-z0-9\-]+)\.html"[^>]*class="product photo/i);
    let name = "";
    if (altMatch) {
      name = altMatch[1].replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").trim();
    } else if (legacyMatch) {
      name = legacyMatch[1].replace(/<[^>]+>/g, "").trim();
    } else if (slugMatch) {
      name = slugMatch[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    if (!name) continue;

    const imgMatch = block.match(/<img[^>]*class="[^"]*product-image-photo[^"]*"[^>]*src="([^"]+)"/)
      || block.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*product-image-photo[^"]*"/)
      || block.match(/<img[^>]*src="([^"]+)"/);
    const image = imgMatch ? imgMatch[1] : "";

    // Prices: two prices shown = retail + trade. Use the LOWER one (trade price).
    const prices = [...block.matchAll(/class="price">£([\d,.]+)/g)]
      .map(m => parseFloat(m[1].replace(",", "")))
      .filter(p => !isNaN(p) && p > 0);
    const price = prices.length >= 2 ? Math.min(...prices) : prices[0] ?? 0;
    if (!price) continue;

    const stock = !block.toLowerCase().includes("out-of-stock") &&
                  !block.toLowerCase().includes("unavailable");

    products.push({ sku, name, price, stock, image, category });
  }
  return products;
}

async function scrapeCategory(url: string, category: string): Promise<Product[]> {
  const allProducts = new Map<string, Product>();
  try {
    const html = await fetchHtml(url);
    const products = parseProductsFromHtml(html, category);
    products.forEach(p => allProducts.set(p.sku, p));

    // Pagination: check for "?p=2" style pages
    const lastPageMatch = html.match(/href="[^"]*[?&]p=(\d+)"[^>]*>[^<]*Last\b/i) ||
                          html.match(/class="[^"]*last[^"]*"[^>]*href="[^"]*[?&]p=(\d+)"/i);
    const lastPage = lastPageMatch ? parseInt(lastPageMatch[1]) : 1;

    for (let pg = 2; pg <= Math.min(lastPage, 15); pg++) {
      await delay(400);
      const sep = url.includes("?") ? "&" : "?";
      const pageHtml = await fetchHtml(`${url}${sep}p=${pg}`);
      const pageProducts = parseProductsFromHtml(pageHtml, category);
      if (pageProducts.length === 0) break;
      pageProducts.forEach(p => allProducts.set(p.sku, p));
    }

    process.stdout.write(`  ${url.replace("https://dhb.co.uk","")}: ${allProducts.size} products\n`);
  } catch (e: any) {
    process.stdout.write(`  ${url.replace("https://dhb.co.uk","")}: ERROR — ${e.message}\n`);
  }
  return [...allProducts.values()];
}

async function main() {
  console.log("=== DHB Scraper ===\n");

  const { data: dhbSupplier } = await sb.from("dentago_suppliers").select("id").eq("name", "DHB").single();
  const dhbId = dhbSupplier?.id;
  if (!dhbId) { console.error("DHB supplier not found"); process.exit(1); }
  console.log(`DHB supplier ID: ${dhbId}`);

  const { data: existingSP } = await sb.from("dentago_supplier_products").select("sku, product_id").eq("supplier_id", dhbId);
  const skuToProductId = new Map<string, number>((existingSP ?? []).map((r: any) => [r.sku, r.product_id]));
  console.log(`Existing DHB entries: ${skuToProductId.size}\n`);

  const { data: maxRow } = await sb.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (maxRow?.[0]?.id ?? 0) + 1;

  // Scrape all categories
  const allProducts = new Map<string, Product>();
  for (const { url, category } of CATEGORIES) {
    const products = await scrapeCategory(url, category);
    products.forEach(p => { if (!allProducts.has(p.sku)) allProducts.set(p.sku, p); });
    await delay(300);
  }

  console.log(`\n=== Collected ${allProducts.size} unique DHB products. Syncing... ===\n`);

  let added = 0, refreshed = 0, failed = 0;

  for (const [sku, p] of allProducts) {
    try {
      if (skuToProductId.has(sku)) {
        await sb.from("dentago_supplier_products")
          .update({ price: p.price, stock: p.stock })
          .eq("supplier_id", dhbId).eq("sku", sku);
        refreshed++;
      } else {
        // Try to match existing product by name
        const { data: existing } = await sb.from("dentago_products")
          .select("id, image").ilike("name", p.name).maybeSingle();

        let productId: number;
        if (existing?.id) {
          productId = existing.id;
          if (p.image && !existing.image) await sb.from("dentago_products").update({ image: p.image }).eq("id", productId);
        } else {
          const { error } = await sb.from("dentago_products").insert({
            id: nextId, name: p.name, brand: "", category: p.category,
            image: p.image, pack_size: "", description: `${p.name}. Available from DHB.`,
            specs: [], similars: [],
          });
          if (error) { failed++; continue; }
          productId = nextId++;
        }

        await sb.from("dentago_supplier_products").insert({
          product_id: productId, supplier_id: dhbId,
          price: p.price, stock: p.stock, delivery: "2-3 working days",
          sku, pack_size: "",
        });
        skuToProductId.set(sku, productId);
        added++;
      }
    } catch { failed++; }
    if ((added + refreshed) % 100 === 0 && (added + refreshed) > 0) {
      console.log(`  Progress — Added: ${added} | Refreshed: ${refreshed} | Failed: ${failed}`);
    }
    await delay(30);
  }

  console.log(`\n✅ Done — Added: ${added} | Refreshed: ${refreshed} | Failed: ${failed}`);
}

main().catch(console.error);
