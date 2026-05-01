/**
 * /api/cron/refresh-dental-sky-prices
 *
 * Vercel Cron-triggered route. Re-fetches Dental Sky public catalog prices via
 * the Magento GraphQL endpoint, compares to whatever is currently in
 * dentago_supplier_products, and:
 *   - UPDATEs supplier_products rows where price (or stock) drifted
 *   - INSERTs a row into dentago_price_history for every change so we keep a
 *     time-series of price movement (used for "this product is N% cheaper than
 *     last week" UX + future analytics).
 *
 * Mirrors /api/cron/refresh-dd-prices but swaps the fetcher (GraphQL → HTML)
 * and includes the price-history write.
 *
 * Triggered daily via vercel.json (Hobby plan). For 12-hour cadence we layer a
 * GitHub Actions workflow on top — see .github/workflows/refresh-prices.yml.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import * as https from "https";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const SEARCH_TERMS = [
  "gloves", "nitrile", "latex", "vinyl",
  "anaesthetic", "articaine", "lidocaine", "septanest",
  "composite", "bonding", "etch",
  "impression", "alginate", "polyether",
  "bur", "diamond", "carbide",
  "needle", "syringe",
  "endodontic", "gutta", "protaper", "file",
  "crown", "bridge", "cement",
  "whitening", "bleach",
  "mask", "apron", "ppe", "infection",
  "orthodontic", "bracket", "wire",
  "matrix", "wedge",
  "x-ray", "sensor", "film",
  "suture", "scalpel",
  "paper", "cotton", "gauze",
  "handpiece", "turbine",
  "scale", "curette", "probe",
  "wax", "articulating",
  "sterilisation", "autoclave",
  "disinfectant", "wipe",
];

function gqlPost(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: "www.dentalsky.com",
      path: "/graphql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

async function fetchPage(searchTerm: string, currentPage: number) {
  const query = `{
    products(search:"${searchTerm}",pageSize:${PAGE_SIZE},currentPage:${currentPage}){
      total_count
      items{ sku price{regularPrice{amount{value}}} stock_status }
    }
  }`;
  const res = await gqlPost(query);
  const products = res?.data?.products;
  if (!products) throw new Error("no products");
  return { items: products.items ?? [], totalCount: products.total_count ?? 0 };
}

// Parallelise across search terms (concurrency=5) so the route fits comfortably
// in Vercel's 300s maxDuration. 50 terms × ~10 pages = ~500 GraphQL requests;
// concurrency 5 keeps Dental Sky's edge happy while bringing total wall-clock
// down to ~90-150s for a full refresh.
async function fetchAllPrices(): Promise<Map<string, { price: number; stock: boolean }>> {
  const out = new Map<string, { price: number; stock: boolean }>();
  const ingest = (items: any[]) => {
    for (const p of items) {
      const sku = p.sku?.toString().trim();
          const raw = p.price?.regularPrice?.amount?.value;
          if (!sku || !raw || raw <= 0) continue;
          // Round to 2dp here — Magento's amount.value sometimes carries float
          // artefacts (e.g. 74.952001) that we don't want to persist.
          const price = Math.round(raw * 100) / 100;
          out.set(sku, { price, stock: (p.stock_status ?? "IN_STOCK") === "IN_STOCK" });
    }
  };

  async function runTerm(term: string) {
    try {
      const first = await fetchPage(term, 1);
      ingest(first.items);
      const pages = Math.min(Math.ceil(first.totalCount / PAGE_SIZE), 10);
      for (let pg = 2; pg <= pages; pg++) {
        const more = await fetchPage(term, pg);
        ingest(more.items);
      }
    } catch {
      // term failed → skip; next cron tick will try again
    }
  }

  const CONCURRENCY = 5;
  const queue = [...SEARCH_TERMS];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const term = queue.shift();
      if (!term) break;
      await runTerm(term);
      await delay(50); // tiny pause between terms per worker
    }
  });
  await Promise.all(workers);
  return out;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();

  const { data: dsSupplier } = await supabaseAdmin
    .from("dentago_suppliers").select("id").eq("name", "Dental Sky").single();
  if (!dsSupplier) {
    return NextResponse.json({ error: "Dental Sky supplier row missing" }, { status: 500 });
  }
  const dsId = dsSupplier.id;

  // Fetch fresh prices from Dental Sky
  const fresh = await fetchAllPrices();

  // Page through every existing DS supplier_product
  const existing: Array<{ id: number; product_id: number; sku: string | null; price: number; stock: boolean | null }> = [];
  {
    let off = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from("dentago_supplier_products")
        .select("id, product_id, sku, price, stock")
        .eq("supplier_id", dsId)
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

    const { error: upErr } = await supabaseAdmin
      .from("dentago_supplier_products")
      .update({ price: f.price, stock: f.stock, updated_at: now })
      .eq("id", row.id);
    if (upErr) continue;

    historyRows.push({
      supplier_id: dsId,
      product_id: row.product_id,
      sku: row.sku,
      price: f.price,
      stock: f.stock,
      source: "cron",
      recorded_at: now,
    });
    updated++;
  }

  // Bulk insert price-history rows in chunks
  if (historyRows.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < historyRows.length; i += CHUNK) {
      await supabaseAdmin
        .from("dentago_price_history")
        .insert(historyRows.slice(i, i + CHUNK));
    }
  }

  return NextResponse.json({
    ok: true,
    supplier: "Dental Sky",
    skusFetched: fresh.size,
    rowsConsidered: existing.length,
    updated,
    unchanged,
    missingFromFeed: missing,
    historyRowsWritten: historyRows.length,
    elapsedMs: Date.now() - t0,
    timestamp: now,
  });
}
