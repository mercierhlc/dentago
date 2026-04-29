import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
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
      const price = parseFloat(h.catalogPrice ?? 0);
      if (sku && price > 0) priceMap.set(sku, price);
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
  const ddId = ddSupplier.id;

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
  let updated = 0, unchanged = 0;
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select("sku, price")
    .eq("supplier_id", ddId);

  for (const row of existing ?? []) {
    const newPrice = allPrices.get(row.sku);
    if (!newPrice) continue;
    if (Math.abs(newPrice - row.price) < 0.001) { unchanged++; continue; }

    await supabaseAdmin
      .from("dentago_supplier_products")
      .update({ price: newPrice, updated_at: now })
      .eq("supplier_id", ddId).eq("sku", row.sku);
    updated++;
  }

  return NextResponse.json({
    ok: true,
    skusScraped: allPrices.size,
    updated,
    unchanged,
    pagesScraped,
    timestamp: now,
  });
}
