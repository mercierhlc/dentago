import { NextResponse } from "next/server";
import { buildSupplierOfferSyncPatch } from "@/lib/canonical-pricing";
import { supabaseAdmin } from "@/lib/supabase";
import { finalizeSupplierPriceCronSuccess, recordSupplierSyncFailure } from "@/lib/supplier-sync-health";
import * as https from "https";

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith("http") ? res.headers.location : "https://www.ddgroup.com" + res.headers.location;
        fetchHtml(loc).then(resolve).catch(reject); return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

const CATEGORIES = [
  "/anaesthetics--pharmaceuticals/",
  "/infection-control/",
  "/endodontics/",
  "/restoratives/",
  "/burs/",
  "/hand-instruments/",
  "/impression-materials/",
  "/orthodontics/",
  "/surgical--implantology/",
  "/x-ray/",
  "/handpieces/",
  "/consumables/",
  "/equipment/",
  "/whitening/",
];

function extractPriceMap(html: string): Map<string, number> {
  const priceMap = new Map<string, number>();
  const hitsIdx = html.indexOf('"hits":[{"name"');
  if (hitsIdx === -1) return priceMap;
  const arrayStart = html.indexOf("[", hitsIdx);
  if (arrayStart === -1) return priceMap;

  let depth = 0, i = arrayStart, end = -1;
  while (i < html.length && i < arrayStart + 600000) {
    const c = html[i];
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") { depth--; if (depth === 0) { end = i; break; } }
    i++;
  }
  if (end === -1) return priceMap;

  try {
    const hits = JSON.parse(html.substring(arrayStart, end + 1));
    for (const h of hits) {
      const sku = (h.code || "").toString().toUpperCase().trim();
      const raw = parseFloat(h.catalogPrice ?? 0);
      if (sku && raw > 0) priceMap.set(sku, Math.round(raw * 100) / 100);
    }
  } catch {}
  return priceMap;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized triggers
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: ddSupplier } = await supabaseAdmin
    .from("dentago_suppliers").select("id").eq("name", "DD Group").single();
  if (!ddSupplier) return NextResponse.json({ error: "DD Group supplier not found" }, { status: 500 });
  const ddId = ddSupplier.id as number;

  try {
  const allPrices = new Map<string, number>();
  let pagesScraped = 0;

  for (const catPath of CATEGORIES) {
    try {
      const firstHtml = await fetchHtml("https://www.ddgroup.com" + catPath);
      const page1Prices = extractPriceMap(firstHtml);
      page1Prices.forEach((price, sku) => allPrices.set(sku, price));

      const nbPagesMatch = firstHtml.match(/"nbPages"\s*:\s*(\d+)/);
      const nbPages = nbPagesMatch ? parseInt(nbPagesMatch[1]) : 1;
      pagesScraped++;

      for (let pg = 1; pg < Math.min(nbPages, 20); pg++) {
        await delay(400);
        const pageHtml = await fetchHtml("https://www.ddgroup.com" + catPath + `?page=${pg}`);
        extractPriceMap(pageHtml).forEach((price, sku) => allPrices.set(sku, price));
        pagesScraped++;
      }

      await delay(500);
    } catch {}
  }

  // Bulk update prices in DB
  let updated = 0, unchanged = 0, missing = 0;
  const now = new Date().toISOString();

  // Page through ALL existing DD rows (paginated to bypass 1000-row cap)
  const existing: Array<{
    id: number;
    product_id: number;
    sku: string;
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
        .eq("supplier_id", ddId)
        .range(off, off + PAGE - 1);
      if (error) break;
      if (!data || data.length === 0) break;
      existing.push(...data as any);
      if (data.length < PAGE) break;
      off += PAGE;
    }
  }

  const historyRows: any[] = [];

  for (const row of existing) {
    if (!row.sku) continue;
    const newPrice = allPrices.get(row.sku);
    if (newPrice == null) { missing++; continue; }
    if (Math.abs(newPrice - Number(row.price)) < 0.001) { unchanged++; continue; }

    const stock = Boolean(row.stock ?? true);
    const syncPatch = buildSupplierOfferSyncPatch(newPrice, stock, {
      packSizeHint: row.pack_size,
      supplierPackQuantity: row.supplier_pack_quantity,
      syncedAt: now,
    });
    const { error: upErr } = await supabaseAdmin
      .from("dentago_supplier_products")
      .update({ price: newPrice, updated_at: now, ...syncPatch })
      .eq("id", row.id);
    if (upErr) continue;

    historyRows.push({
      supplier_id: ddId,
      product_id: row.product_id,
      sku: row.sku,
      price: newPrice,
      stock,
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
    supplier: "DD Group",
    skusScraped: allPrices.size,
    rowsConsidered: existing.length,
    updated,
    unchanged,
    missingFromFeed: missing,
    historyRowsWritten: historyRows.length,
    pagesScraped,
    timestamp: now,
  };
  await finalizeSupplierPriceCronSuccess(ddId, "DD Group", "refresh-dd-prices", payload);
  return NextResponse.json(payload);
  } catch (e) {
    await recordSupplierSyncFailure(ddId, "DD Group", e, { source: "refresh-dd-prices" });
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
