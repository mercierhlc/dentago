/**
 * /api/cron/refresh-dhb-prices
 *
 * Cron route that re-scrapes DHB Magento HTML category pages, extracts SKU →
 * { price, stock }, and updates dentago_supplier_products + appends to
 * dentago_price_history wherever the price moved.
 *
 * Mirrors /api/cron/refresh-dental-sky-prices but uses HTML parsing instead of
 * GraphQL. We do NOT add new DHB products in the cron path — new-catalog
 * onboarding happens via scripts/scrape-dhb.ts (manual). The cron is purely
 * about keeping the prices we already track fresh.
 */
import { NextResponse } from "next/server";
import { buildSupplierOfferSyncPatch } from "@/lib/canonical-pricing";
import { supabaseAdmin } from "@/lib/supabase";
import { finalizeSupplierPriceCronSuccess, recordSupplierSyncFailure } from "@/lib/supplier-sync-health";
import * as https from "https";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const CATEGORY_URLS = [
  "https://dhb.co.uk/anaesthetics-pharmaceuticals/anaesthetics.html",
  "https://dhb.co.uk/anaesthetics-pharmaceuticals/analgesics.html",
  "https://dhb.co.uk/anaesthetics-pharmaceuticals/antibiotics.html",
  "https://dhb.co.uk/anaesthetics-pharmaceuticals/emergency-drugs.html",
  "https://dhb.co.uk/anaesthetics-pharmaceuticals/medicaments.html",
  "https://dhb.co.uk/disposables/gloves.html",
  "https://dhb.co.uk/disposables/masks-visors.html",
  "https://dhb.co.uk/disposables/needles.html",
  "https://dhb.co.uk/disposables/sterilisation-pouches.html",
  "https://dhb.co.uk/disposables/cotton-products.html",
  "https://dhb.co.uk/disposables/barrier-protection.html",
  "https://dhb.co.uk/disposables/3-in-1-tips.html",
  "https://dhb.co.uk/disposables/aspirator-tips-ejectors.html",
  "https://dhb.co.uk/disposables/bibs-capes.html",
  "https://dhb.co.uk/disposables/dental-mirrors.html",
  "https://dhb.co.uk/disposables/gauze.html",
  "https://dhb.co.uk/disposables/indicator-strips.html",
  "https://dhb.co.uk/disposables/paper-products.html",
  "https://dhb.co.uk/disposables/squat-cups.html",
  "https://dhb.co.uk/disposables/tongue-depresser.html",
  "https://dhb.co.uk/disposables/tray-liners-inserts.html",
  "https://dhb.co.uk/infection-control/disinfectant-wipes.html",
  "https://dhb.co.uk/infection-control/hand-cleaning-disinfection.html",
  "https://dhb.co.uk/infection-control/surface-disinfection.html",
  "https://dhb.co.uk/infection-control/instrument-disinfection.html",
  "https://dhb.co.uk/infection-control/barrier-protection.html",
  "https://dhb.co.uk/infection-control/aspirator-cleaner.html",
  "https://dhb.co.uk/infection-control/detergent-wipes.html",
  "https://dhb.co.uk/infection-control/disinfectant-powder.html",
  "https://dhb.co.uk/infection-control/drain-disinfectant.html",
  "https://dhb.co.uk/infection-control/waterline-treatment.html",
  "https://dhb.co.uk/infection-control/ultrasonic-bath-disinfection.html",
  "https://dhb.co.uk/endodontics/endodontic-instruments.html",
  "https://dhb.co.uk/endodontics/endodontic-materials.html",
  "https://dhb.co.uk/endodontics/gutta-percha-points.html",
  "https://dhb.co.uk/endodontics/paper-points.html",
  "https://dhb.co.uk/endodontics/rubber-dams.html",
  "https://dhb.co.uk/endodontics/accessories.html",
  "https://dhb.co.uk/filling-materials/composite.html",
  "https://dhb.co.uk/filling-materials/glass-ionomer.html",
  "https://dhb.co.uk/filling-materials/amalgam.html",
  "https://dhb.co.uk/filling-materials/matrices.html",
  "https://dhb.co.uk/filling-materials/articulating-paper.html",
  "https://dhb.co.uk/filling-materials/silver-glass-ionomers.html",
  "https://dhb.co.uk/etching-bonding/bonding-systems.html",
  "https://dhb.co.uk/etching-bonding/etching-agent.html",
  "https://dhb.co.uk/impression-material/addition-silicone.html",
  "https://dhb.co.uk/impression-material/alginate.html",
  "https://dhb.co.uk/impression-material/polyether.html",
  "https://dhb.co.uk/impression-material/impression-trays.html",
  "https://dhb.co.uk/impression-material/bite-registration.html",
  "https://dhb.co.uk/liners-cements/calcium-hydroxide-liners.html",
  "https://dhb.co.uk/liners-cements/crown-bridge-cementation.html",
  "https://dhb.co.uk/liners-cements/glass-ionomer.html",
  "https://dhb.co.uk/liners-cements/permanent-cement.html",
  "https://dhb.co.uk/hand-instruments/instruments.html",
  "https://dhb.co.uk/hand-instruments/periodontal.html",
  "https://dhb.co.uk/hand-instruments/mouth-mirrors.html",
  "https://dhb.co.uk/rotary-instruments/burs.html",
  "https://dhb.co.uk/rotary-instruments/diamond-burs.html",
  "https://dhb.co.uk/rotary-instruments/steel-burs.html",
  "https://dhb.co.uk/x-ray/film.html",
  "https://dhb.co.uk/x-ray/holders.html",
  "https://dhb.co.uk/surgical/sutures.html",
  "https://dhb.co.uk/surgical/surgical-accessories.html",
  "https://dhb.co.uk/finishing-polishing/polishing.html",
  "https://dhb.co.uk/oral-hygiene/fluoride-varnish.html",
  "https://dhb.co.uk/oral-hygiene/teeth-whitening.html",
  "https://dhb.co.uk/posts-pins/posts.html",
  "https://dhb.co.uk/posts-pins/pins.html",
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
        const loc = res.headers.location.startsWith("http")
          ? res.headers.location
          : "https://dhb.co.uk" + res.headers.location;
        fetchHtml(loc).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
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

function parsePrices(html: string): Map<string, { price: number; stock: boolean }> {
  const out = new Map<string, { price: number; stock: boolean }>();
  const blocks = html.split(/<li[^>]*class="[^"]*product-item[^"]*"/);
  for (const block of blocks.slice(1)) {
    const skuMatch = block.match(/data-product-sku="([^"]+)"/);
    if (!skuMatch) continue;
    const sku = skuMatch[1].trim();

    // Trade price = lower of two; if only one shown, use that
    const prices = [...block.matchAll(/class="price">£([\d,.]+)/g)]
      .map(m => parseFloat(m[1].replace(",", "")))
      .filter(p => !isNaN(p) && p > 0);
    const raw = prices.length >= 2 ? Math.min(...prices) : prices[0] ?? 0;
    if (!raw) continue;
    const price = Math.round(raw * 100) / 100;

    const lower = block.toLowerCase();
    const stock = !lower.includes("out-of-stock") && !lower.includes("unavailable");
    out.set(sku, { price, stock });
  }
  return out;
}

async function scrapeAllPrices(): Promise<Map<string, { price: number; stock: boolean }>> {
  const all = new Map<string, { price: number; stock: boolean }>();
  for (const url of CATEGORY_URLS) {
    try {
      const html = await fetchHtml(url);
      parsePrices(html).forEach((v, k) => all.set(k, v));

      // Pagination — mirror scrape-dhb.ts capping at 15 pages
      const last = html.match(/href="[^"]*[?&]p=(\d+)"[^>]*>[^<]*Last\b/i)
                || html.match(/class="[^"]*last[^"]*"[^>]*href="[^"]*[?&]p=(\d+)"/i);
      const lastPage = last ? parseInt(last[1]) : 1;
      for (let pg = 2; pg <= Math.min(lastPage, 15); pg++) {
        await delay(300);
        const sep = url.includes("?") ? "&" : "?";
        const pageHtml = await fetchHtml(`${url}${sep}p=${pg}`);
        const parsed = parsePrices(pageHtml);
        if (parsed.size === 0) break;
        parsed.forEach((v, k) => all.set(k, v));
      }
    } catch {
      // category-level error → skip
    }
    await delay(200);
  }
  return all;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();

  const { data: dhbSupplier } = await supabaseAdmin
    .from("dentago_suppliers").select("id").eq("name", "DHB").single();
  if (!dhbSupplier) {
    return NextResponse.json({ error: "DHB supplier row missing" }, { status: 500 });
  }
  const dhbId = dhbSupplier.id as number;

  try {
  const fresh = await scrapeAllPrices();

  const existing: Array<{
    id: number;
    product_id: number;
    sku: string | null;
    price: number;
    stock: boolean | null;
    pack_size: string | null;
    supplier_pack_quantity: number | null;
  }> = [];
  {
    let off = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from("dentago_supplier_products")
        .select("id, product_id, sku, price, stock, pack_size, supplier_pack_quantity")
        .eq("supplier_id", dhbId)
        .range(off, off + PAGE - 1);
      if (error) break;
      if (!data || data.length === 0) break;
      existing.push(...data as any);
      if (data.length < PAGE) break;
      off += PAGE;
    }
  }

  const now = new Date().toISOString();
  const historyRows: any[] = [];
  let updated = 0, unchanged = 0, missing = 0;

  for (const row of existing) {
    if (!row.sku) continue;
    const f = fresh.get(row.sku);
    if (!f) { missing++; continue; }

    const priceChanged = Math.abs(f.price - Number(row.price)) > 0.001;
    const stockChanged = f.stock !== Boolean(row.stock);
    if (!priceChanged && !stockChanged) { unchanged++; continue; }

    const syncPatch = buildSupplierOfferSyncPatch(f.price, f.stock, {
      packSizeHint: row.pack_size,
      supplierPackQuantity: row.supplier_pack_quantity,
      syncedAt: now,
    });
    const { error: upErr } = await supabaseAdmin
      .from("dentago_supplier_products")
      .update({ price: f.price, stock: f.stock, updated_at: now, ...syncPatch })
      .eq("id", row.id);
    if (upErr) continue;

    historyRows.push({
      supplier_id: dhbId,
      product_id: row.product_id,
      sku: row.sku,
      price: f.price,
      stock: f.stock,
      source: "cron",
      recorded_at: now,
    });
    updated++;
  }

  if (historyRows.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < historyRows.length; i += CHUNK) {
      await supabaseAdmin
        .from("dentago_price_history")
        .insert(historyRows.slice(i, i + CHUNK));
    }
  }

  const payload = {
    ok: true,
    supplier: "DHB",
    skusFetched: fresh.size,
    rowsConsidered: existing.length,
    updated,
    unchanged,
    missingFromFeed: missing,
    historyRowsWritten: historyRows.length,
    elapsedMs: Date.now() - t0,
    timestamp: now,
  };
  await finalizeSupplierPriceCronSuccess(dhbId, "DHB", "refresh-dhb-prices", payload);
  return NextResponse.json(payload);
  } catch (e) {
    await recordSupplierSyncFailure(dhbId, "DHB", e, { source: "refresh-dhb-prices" });
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
