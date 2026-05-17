#!/usr/bin/env tsx
/**
 * fill-supplier-prices.ts
 *
 * For each supplier:
 *   1. Scrape their FULL public catalog once → in-memory map of all their products
 *   2. Match all 32k of our products against that map (SKU first, then name/Jaccard)
 *   3. Bulk-insert matched rows into dentago_supplier_products
 *
 * Much faster than per-product searches — one catalog scrape per supplier
 * instead of 32,000 individual HTTP requests.
 *
 * Usage:
 *   npx tsx scripts/fill-supplier-prices.ts
 *   npx tsx scripts/fill-supplier-prices.ts --supplier "Dental Sky"
 *   npx tsx scripts/fill-supplier-prices.ts --dry-run
 *
 * Also **updates** existing `dentago_supplier_products` rows where both `sku` and
 * `supplier_sku` are blank, when the catalog scrape yields a real line match (not EST-only).
 */

import { createClient } from "@supabase/supabase-js";
import * as https from "https";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const isDryRun     = process.argv.includes("--dry-run");
const supplierFlag = (() => {
  const i = process.argv.indexOf("--supplier");
  return i !== -1 ? process.argv[i + 1] : null;
})();

// ── Catalog entry (what we scrape from each supplier) ─────────────────────────

interface CatalogEntry {
  sku:   string;
  name:  string;
  price: number;
  stock: boolean;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   "GET",
      headers:  { "User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "en-GB,en;q=0.9" },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith("http")
          ? res.headers.location
          : `https://${parsed.hostname}${res.headers.location}`;
        fetchHtml(loc).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20_000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

function gqlPost(hostname: string, query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname, path: "/graphql", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "User-Agent": UA },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(e); } });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20_000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

// ── Magento category/search page parser ───────────────────────────────────────

function parseMagentoPage(html: string): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  const blocks = html.split(/<li[^>]*class="[^"]*product-item[^"]*"/i);
  for (const b of blocks.slice(1)) {
    const nameM = b.match(/class="[^"]*product-item-link"[^>]*>([\s\S]*?)<\/a>/i)
               ?? b.match(/class="[^"]*product-item-name[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    if (!nameM) continue;
    const name = nameM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!name) continue;

    const skuM  = b.match(/data-product-sku="([^"]+)"/) ?? b.match(/data-sku="([^"]+)"/);
    const sku   = skuM?.[1]?.trim() ?? "";

    const priceM = b.match(/data-price-amount="([\d.]+)"/)
                ?? b.match(/class="price">£([\d,]+\.?\d*)/)
                ?? b.match(/£\s*([\d,]+\.?\d*)/);
    if (!priceM) continue;
    const price = parseFloat(priceM[1].replace(",", ""));
    if (!price || price <= 0 || price > 50_000) continue;

    const lower = b.toLowerCase();
    const stock = !lower.includes("out-of-stock") && !lower.includes("out of stock")
               && !lower.includes("unavailable")  && !lower.includes("sold out");

    entries.push({ sku, name, price, stock });
  }
  return entries;
}

function extractLastPage(html: string): number {
  const m = html.match(/href="[^"]*[?&]p=(\d+)"[^>]*>\s*(?:Last|»|>)\s*</i)
         ?? html.match(/class="[^"]*last[^"]*"[^>]*href="[^"]*[?&]p=(\d+)"/i)
         ?? html.match(/data-page="(\d+)"[^>]*class="[^"]*last/i);
  return m ? parseInt(m[1]) : 1;
}

async function scrapeAllMagentoPages(baseUrl: string, maxPages = 20, delayMs = 300): Promise<CatalogEntry[]> {
  const all: CatalogEntry[] = [];
  const first = await fetchHtml(baseUrl);
  all.push(...parseMagentoPage(first));
  const last = Math.min(extractLastPage(first), maxPages);
  for (let pg = 2; pg <= last; pg++) {
    await delay(delayMs);
    try {
      const html = await fetchHtml(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}p=${pg}`);
      const entries = parseMagentoPage(html);
      if (entries.length === 0) break;
      all.push(...entries);
    } catch { break; }
  }
  return all;
}

// ── Full catalog scrapers per supplier ────────────────────────────────────────

// Dental Sky — GraphQL with broad dental search terms (same approach as cron)
async function catalogDentalSky(): Promise<CatalogEntry[]> {
  const TERMS = [
    "gloves","nitrile","latex","vinyl","mask","ppe","apron",
    "articaine","lidocaine","septanest","anaesthetic","analgesic",
    "composite","bonding","etch","primer","adhesive",
    "impression","alginate","polyether","silicone","putty",
    "bur","diamond","carbide","rotary","endodontic","protaper","gutta","file","paper point",
    "crown","bridge","cement","temporary","provisional",
    "whitening","bleach","fluoride","varnish",
    "suture","scalpel","surgical","forceps","elevator",
    "matrix","wedge","band","sectional",
    "gauze","cotton","roll","wool",
    "needle","syringe","cartridge",
    "sterilisation","autoclave","pouch","tape",
    "disinfectant","wipe","surface","hand gel",
    "handpiece","turbine","motor","contra angle",
    "scaler","curette","probe","periodontal","instrument",
    "wax","articulating","bite","registration",
    "x-ray","film","sensor","holder","barrier",
    "orthodontic","bracket","wire","band","elastics",
    "glass ionomer","gic","lining","calcium hydroxide",
    "impression tray","stock tray","custom",
    "polishing","prophy","paste","cup",
    "retraction","cord","paste",
    "rubber dam","clamp","frame","punch",
    "post","pin","dowel",
  ];
  const map = new Map<string, CatalogEntry>();
  const PAGE_SIZE = 100;
  const CONCURRENCY = 5;
  const queue = [...TERMS];

  async function runTerm(term: string) {
    try {
      let pg = 1;
      while (true) {
        const res = await gqlPost("www.dentalsky.com", `{
          products(search: "${term.replace(/"/g, "")}", pageSize: ${PAGE_SIZE}, currentPage: ${pg}) {
            total_count
            items { sku name stock_status price { regularPrice { amount { value } } } }
          }
        }`);
        const items = res?.data?.products?.items ?? [];
        const total = res?.data?.products?.total_count ?? 0;
        for (const p of items) {
          const price = p.price?.regularPrice?.amount?.value;
          if (!p.sku || !price || price <= 0) continue;
          map.set(p.sku.trim(), {
            sku:   p.sku.trim(),
            name:  p.name ?? "",
            price: Math.round(price * 100) / 100,
            stock: p.stock_status === "IN_STOCK",
          });
        }
        if (pg * PAGE_SIZE >= total) break;
        pg++;
        await delay(100);
      }
    } catch {}
  }

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const term = queue.shift();
      if (!term) break;
      await runTerm(term);
      await delay(80);
    }
  });
  await Promise.all(workers);
  return Array.from(map.values());
}

// DD Group — Algolia via broad search terms
async function catalogDDGroup(): Promise<CatalogEntry[]> {
  const TERMS = [
    "gloves","mask","anaesthetic","composite","impression","bur","endodontic",
    "cement","whitening","suture","disinfectant","handpiece","scaler","needle",
    "sterilisation","orthodontic","fluoride","matrix","rubber dam","post",
  ];
  const map = new Map<string, CatalogEntry>();

  for (const term of TERMS) {
    try {
      const html = await fetchHtml(`https://www.ddgroup.com/search/?query=${encodeURIComponent(term)}`);
      const idx = html.indexOf('"hits":[{');
      if (idx === -1) { await delay(400); continue; }
      const start = html.indexOf("[", idx);
      let depth = 0, i = start, end = -1;
      while (i < html.length && i < start + 800_000) {
        const c = html[i];
        if (c === "[" || c === "{") depth++;
        else if (c === "]" || c === "}") { if (--depth === 0) { end = i; break; } }
        i++;
      }
      if (end === -1) { await delay(400); continue; }
      const hits: any[] = JSON.parse(html.substring(start, end + 1));
      for (const h of hits) {
        const price = parseFloat(h.catalogPrice ?? 0);
        if (!h.code || price <= 0) continue;
        const sku = h.code.toString().trim();
        map.set(sku, {
          sku,
          name:  h.name ?? "",
          price: Math.round(price * 100) / 100,
          stock: h.stockStatus !== "oos",
        });
      }
    } catch {}
    await delay(400);
  }
  return Array.from(map.values());
}

// DHB — category pages (same as cron)
async function catalogDHB(): Promise<CatalogEntry[]> {
  const CATEGORIES = [
    "https://dhb.co.uk/anaesthetics-pharmaceuticals/anaesthetics.html",
    "https://dhb.co.uk/anaesthetics-pharmaceuticals/analgesics.html",
    "https://dhb.co.uk/anaesthetics-pharmaceuticals/antibiotics.html",
    "https://dhb.co.uk/anaesthetics-pharmaceuticals/medicaments.html",
    "https://dhb.co.uk/disposables/gloves.html",
    "https://dhb.co.uk/disposables/masks-visors.html",
    "https://dhb.co.uk/disposables/needles.html",
    "https://dhb.co.uk/disposables/sterilisation-pouches.html",
    "https://dhb.co.uk/disposables/cotton-products.html",
    "https://dhb.co.uk/disposables/barrier-protection.html",
    "https://dhb.co.uk/disposables/3-in-1-tips.html",
    "https://dhb.co.uk/disposables/aspirator-tips-ejectors.html",
    "https://dhb.co.uk/disposables/gauze.html",
    "https://dhb.co.uk/disposables/paper-products.html",
    "https://dhb.co.uk/infection-control/disinfectant-wipes.html",
    "https://dhb.co.uk/infection-control/hand-cleaning-disinfection.html",
    "https://dhb.co.uk/infection-control/surface-disinfection.html",
    "https://dhb.co.uk/infection-control/instrument-disinfection.html",
    "https://dhb.co.uk/endodontics/endodontic-instruments.html",
    "https://dhb.co.uk/endodontics/endodontic-materials.html",
    "https://dhb.co.uk/endodontics/gutta-percha-points.html",
    "https://dhb.co.uk/endodontics/paper-points.html",
    "https://dhb.co.uk/endodontics/rubber-dams.html",
    "https://dhb.co.uk/filling-materials/composite.html",
    "https://dhb.co.uk/filling-materials/glass-ionomer.html",
    "https://dhb.co.uk/filling-materials/amalgam.html",
    "https://dhb.co.uk/filling-materials/matrices.html",
    "https://dhb.co.uk/filling-materials/articulating-paper.html",
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
    "https://dhb.co.uk/rotary-instruments/burs.html",
    "https://dhb.co.uk/rotary-instruments/diamond-burs.html",
    "https://dhb.co.uk/surgical/sutures.html",
    "https://dhb.co.uk/surgical/surgical-accessories.html",
    "https://dhb.co.uk/finishing-polishing/polishing.html",
    "https://dhb.co.uk/oral-hygiene/fluoride-varnish.html",
    "https://dhb.co.uk/oral-hygiene/teeth-whitening.html",
    "https://dhb.co.uk/x-ray/film.html",
    "https://dhb.co.uk/posts-pins/posts.html",
  ];
  const map = new Map<string, CatalogEntry>();
  for (const url of CATEGORIES) {
    try {
      const entries = await scrapeAllMagentoPages(url, 15, 250);
      for (const e of entries) {
        if (e.sku) map.set(e.sku, e); else map.set(e.name, e);
      }
    } catch {}
    await delay(200);
  }
  return Array.from(map.values());
}

// Generic Magento GraphQL scraper — works for Kent Express, Clark Dental, Trycare, Wrights
// Same approach as catalogDentalSky — uses /graphql endpoint all Magento 2 stores expose
async function catalogMagentoGql(hostname: string): Promise<CatalogEntry[]> {
  const TERMS = [
    "gloves","nitrile","latex","mask","ppe","anaesthetic","articaine","lidocaine","septanest",
    "composite","bonding","etch","adhesive","impression","alginate","silicone","putty",
    "bur","diamond","carbide","endodontic","protaper","gutta","file","paper point",
    "crown","cement","temporary","whitening","fluoride","varnish",
    "suture","scalpel","forceps","surgical","matrix","wedge","band",
    "gauze","cotton","needle","syringe","cartridge",
    "sterilisation","autoclave","pouch","disinfectant","wipe","hand gel",
    "handpiece","scaler","curette","probe","instrument",
    "wax","articulating","x-ray","film","orthodontic","bracket","wire","elastics",
    "glass ionomer","gic","calcium hydroxide","impression tray","polishing","prophy",
    "rubber dam","clamp","post","pin",
  ];
  const map = new Map<string, CatalogEntry>();
  const PAGE_SIZE = 100;
  const CONCURRENCY = 3;
  const queue = [...TERMS];

  async function runTerm(term: string) {
    try {
      let pg = 1;
      while (true) {
        const res = await gqlPost(hostname, `{
          products(search: "${term.replace(/"/g, "")}", pageSize: ${PAGE_SIZE}, currentPage: ${pg}) {
            total_count
            items { sku name stock_status price { regularPrice { amount { value } } } }
          }
        }`);
        const items = res?.data?.products?.items ?? [];
        const total = res?.data?.products?.total_count ?? 0;
        for (const p of items) {
          const price = p.price?.regularPrice?.amount?.value;
          if (!p.sku || !price || price <= 0) continue;
          map.set(p.sku.trim(), {
            sku:   p.sku.trim(),
            name:  p.name ?? "",
            price: Math.round(price * 100) / 100,
            stock: p.stock_status === "IN_STOCK",
          });
        }
        if (pg * PAGE_SIZE >= total || items.length === 0) break;
        pg++;
        await delay(150);
      }
    } catch {}
  }

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const term = queue.shift();
      if (!term) break;
      await runTerm(term);
      await delay(100);
    }
  });
  await Promise.all(workers);
  return Array.from(map.values());
}

// Optident — WooCommerce shop pages
async function catalogOptident(): Promise<CatalogEntry[]> {
  const map = new Map<string, CatalogEntry>();
  let pg = 1;
  while (pg <= 50) {
    try {
      const html = await fetchHtml(`https://optident.co.uk/shop/page/${pg}/`);
      if (html.includes("page-not-found") || html.includes("404")) break;
      const blocks = html.split(/<li[^>]*class="[^"]*product[^"]*"/i);
      let found = 0;
      for (const b of blocks.slice(1)) {
        const nameM = b.match(/class="[^"]*woocommerce-loop-product__title[^"]*">([\s\S]*?)<\/h/i)
                   ?? b.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        if (!nameM) continue;
        const name = nameM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (!name) continue;
        const skuM  = b.match(/data-product_sku="([^"]+)"/);
        const sku   = skuM?.[1]?.trim() ?? "";
        const priceM = b.match(/woocommerce-Price-amount[^>]*>[\s\S]*?£\s*([\d,]+\.?\d*)/i)
                    ?? b.match(/£\s*([\d,]+\.?\d*)/);
        if (!priceM) continue;
        const price = parseFloat(priceM[1].replace(",", ""));
        if (!price || price <= 0 || price > 50_000) continue;
        const lower = b.toLowerCase();
        const stock = !lower.includes("out-of-stock");
        const key = sku || name;
        map.set(key, { sku, name, price, stock });
        found++;
      }
      if (found === 0) break;
    } catch { break; }
    await delay(400);
    pg++;
  }
  return Array.from(map.values());
}

// Henry Schein — public product listing pages (login not required for browsing)
async function catalogHenrySchein(): Promise<CatalogEntry[]> {
  const CATEGORIES = [
    "https://www.henryschein.co.uk/gb-en/dental/c/anaesthesia",
    "https://www.henryschein.co.uk/gb-en/dental/c/gloves",
    "https://www.henryschein.co.uk/gb-en/dental/c/face-masks",
    "https://www.henryschein.co.uk/gb-en/dental/c/needles-syringes",
    "https://www.henryschein.co.uk/gb-en/dental/c/endodontics",
    "https://www.henryschein.co.uk/gb-en/dental/c/composites-adhesives",
    "https://www.henryschein.co.uk/gb-en/dental/c/impression-materials",
    "https://www.henryschein.co.uk/gb-en/dental/c/cements-liners",
    "https://www.henryschein.co.uk/gb-en/dental/c/burs",
    "https://www.henryschein.co.uk/gb-en/dental/c/hand-instruments",
    "https://www.henryschein.co.uk/gb-en/dental/c/infection-control",
    "https://www.henryschein.co.uk/gb-en/dental/c/sterilisation",
    "https://www.henryschein.co.uk/gb-en/dental/c/surgical",
    "https://www.henryschein.co.uk/gb-en/dental/c/whitening",
    "https://www.henryschein.co.uk/gb-en/dental/c/orthodontics",
    "https://www.henryschein.co.uk/gb-en/dental/c/x-ray-imaging",
  ];
  const map = new Map<string, CatalogEntry>();
  for (const url of CATEGORIES) {
    try {
      // HS uses page size param and pagination via ?currentPage=N
      let pg = 1;
      while (pg <= 20) {
        const pageUrl = pg === 1 ? url : `${url}?currentPage=${pg}`;
        const html = await fetchHtml(pageUrl);
        // HS product cards: look for JSON-LD or data attributes
        const blocks = html.split(/<(?:li|div)[^>]*class="[^"]*(?:product-item|productCard|product-tile)[^"]*"/i);
        let found = 0;
        for (const b of blocks.slice(1)) {
          const nameM = b.match(/class="[^"]*(?:product-name|productName|item-name)[^"]*"[^>]*>([\s\S]*?)<\//i)
                     ?? b.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/i)
                     ?? b.match(/aria-label="([^"]{5,100})"/i);
          if (!nameM) continue;
          const name = nameM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          if (!name || name.length < 4) continue;
          const skuM = b.match(/data-(?:sku|product-sku|item-number)="([^"]+)"/)
                    ?? b.match(/Item\s*(?:No|#|Number)[:\s]+([A-Z0-9\-]{4,20})/i);
          const sku  = skuM?.[1]?.trim() ?? "";
          const priceM = b.match(/£\s*([\d,]+\.?\d*)/);
          if (!priceM) continue;
          const price = parseFloat(priceM[1].replace(",", ""));
          if (!price || price <= 0 || price > 50_000) continue;
          const lower = b.toLowerCase();
          const stock = !lower.includes("out of stock") && !lower.includes("discontinued");
          const key = sku || name;
          map.set(key, { sku, name, price, stock });
          found++;
        }
        if (found === 0) break;
        pg++;
        await delay(400);
      }
    } catch {}
    await delay(300);
  }
  return Array.from(map.values());
}

// Dental Directory — Algolia via broad search terms (same structure as DD Group)
async function catalogDentalDirectory(): Promise<CatalogEntry[]> {
  const TERMS = [
    "gloves","mask","anaesthetic","composite","impression","bur","endodontic",
    "cement","whitening","suture","disinfectant","handpiece","scaler","needle",
    "sterilisation","orthodontic","fluoride","matrix","rubber dam","post",
    "nitrile","latex","ppe","apron","articaine","lidocaine","septanest",
    "bonding","etch","adhesive","alginate","silicone","putty",
    "diamond","carbide","protaper","gutta","paper point",
    "temporary","varnish","scalpel","forceps","surgical","wedge","band",
    "gauze","cotton","syringe","cartridge","autoclave","pouch",
    "wipe","hand gel","turbine","motor","curette","probe","instrument",
    "wax","articulating","x-ray","film","bracket","wire","elastics",
    "glass ionomer","calcium hydroxide","impression tray","polishing","prophy",
    "clamp","pin","retraction","cord",
  ];
  const map = new Map<string, CatalogEntry>();

  for (const term of TERMS) {
    try {
      const html = await fetchHtml(`https://www.dental-directory.co.uk/search/?query=${encodeURIComponent(term)}`);
      const idx = html.indexOf('"hits":[{');
      if (idx === -1) { await delay(400); continue; }
      const start = html.indexOf("[", idx);
      let depth = 0, i = start, end = -1;
      while (i < html.length && i < start + 800_000) {
        const c = html[i];
        if (c === "[" || c === "{") depth++;
        else if (c === "]" || c === "}") { if (--depth === 0) { end = i; break; } }
        i++;
      }
      if (end === -1) { await delay(400); continue; }
      const hits: any[] = JSON.parse(html.substring(start, end + 1));
      for (const h of hits) {
        const price = parseFloat(h.catalogPrice ?? 0);
        if (!h.code || price <= 0) continue;
        const sku = h.code.toString().trim();
        map.set(sku, {
          sku,
          name:  h.name ?? "",
          price: Math.round(price * 100) / 100,
          stock: h.stockStatus !== "oos",
        });
      }
    } catch {}
    await delay(400);
  }
  return Array.from(map.values());
}

// ── Supplier registry ──────────────────────────────────────────────────────────

const SUPPLIERS: { name: string; delivery: string; scrape: () => Promise<CatalogEntry[]> }[] = [
  { name: "Dental Sky",       delivery: "2-3 working days", scrape: catalogDentalSky },
  { name: "DD Group",         delivery: "Next day",          scrape: catalogDDGroup },
  { name: "DHB",              delivery: "2-4 working days", scrape: catalogDHB },
  { name: "Kent Express",     delivery: "Next day",          scrape: () => catalogMagentoGql("www.kentexpress.co.uk") },
  { name: "Clark Dental",     delivery: "2-3 working days", scrape: () => catalogMagentoGql("www.clarkdental.co.uk") },
  { name: "Trycare",          delivery: "2-3 working days", scrape: () => catalogMagentoGql("www.trycare.co.uk") },
  { name: "Wrights",          delivery: "2-3 working days", scrape: () => catalogMagentoGql("www.wrightsdentals.com") },
  { name: "Optident",         delivery: "2-4 working days", scrape: catalogOptident },
  { name: "Henry Schein",     delivery: "Next day",          scrape: catalogHenrySchein },
  { name: "Dental Directory", delivery: "2-3 working days", scrape: catalogDentalDirectory },
];

// ── Matching ──────────────────────────────────────────────────────────────────

const STOP = new Set(["the","a","an","and","or","of","for","with","in","on","to","from","by","at","as","is","pack","box","per","each","x"]);

function sigWords(s: string): string[] {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = Array.from(a).filter(w => b.has(w)).length;
  const union = new Set([...Array.from(a), ...Array.from(b)]).size;
  return union === 0 ? 0 : intersection / union;
}

function brandPresent(brand: string, resultName: string): boolean {
  const brandWords = sigWords(brand);
  if (brandWords.length === 0) return true;
  const lower = resultName.toLowerCase();
  return brandWords.some(w => lower.includes(w));
}

function matchProduct(
  product: { name: string; brand: string; knownSkus: string[]; knownPrice?: number },
  catalog: CatalogEntry[]
): CatalogEntry | null {
  // 1. Exact SKU match
  if (product.knownSkus.length) {
    for (const sku of product.knownSkus) {
      const hit = catalog.find(e => e.sku && e.sku.toUpperCase() === sku.toUpperCase());
      if (hit) {
        // Price plausibility check even for SKU matches
        if (product.knownPrice && (hit.price > product.knownPrice * 4 || hit.price < product.knownPrice * 0.25)) continue;
        return hit;
      }
    }
  }

  // 2. Name/Jaccard match
  const aWords = new Set(sigWords(`${product.brand} ${product.name}`));
  let best: CatalogEntry | null = null;
  let bestScore = 0;

  for (const entry of catalog) {
    if (!brandPresent(product.brand, entry.name)) continue;
    if (product.knownPrice && (entry.price > product.knownPrice * 4 || entry.price < product.knownPrice * 0.25)) continue;
    const bWords = new Set(sigWords(entry.name));
    const score  = jaccard(aWords, bWords);
    if (score > bestScore) { bestScore = score; best = entry; }
  }

  return bestScore >= 0.4 ? best : null;
}

// ── EST price multipliers for suppliers we can't scrape ───────────────────────
// Based on known market positioning relative to Dental Sky (cheapest baseline)
const EST_MULTIPLIERS: Record<string, number> = {
  "Kent Express":  1.18,
  "Clark Dental":  1.14,
  "Trycare":       1.12,
  "Wrights":       1.10,
  "Henry Schein":  1.22,
};

// ── Supabase paginator — works around the 1,000 row default cap ───────────────
async function fetchAll<T>(
  query: () => ReturnType<typeof sb.from>
): Promise<T[]> {
  const all: T[] = [];
  let off = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await (query() as any).range(off, off + PAGE - 1);
    if (error) { console.warn("  [WARN] fetchAll error:", error.message); break; }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    off += PAGE;
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🦷  Dentago — fill supplier prices (catalog-first)`);
  console.log(`    mode:     ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`    supplier: ${supplierFlag ?? "all"}\n`);

  // Load supplier IDs
  const { data: dbSuppliers } = await sb.from("dentago_suppliers").select("id, name");
  if (!dbSuppliers?.length) { console.error("No suppliers in DB"); process.exit(1); }
  const supIdMap = new Map<string, number>(dbSuppliers.map((s: any) => [s.name, s.id]));

  // Load ALL products (32k+) — paginating in 1,000-row chunks
  console.log("Loading all products from DB…");
  const allProducts: { id: number; name: string; brand: string; category: string }[] = [];
  {
    let off = 0;
    while (true) {
      const { data } = await sb.from("dentago_products")
        .select("id, name, brand, category")
        .order("id")
        .range(off, off + 999);
      if (!data?.length) break;
      allProducts.push(...(data as any[]));
      if (data.length < 1000) break;
      off += 1000;
      if (off % 5000 === 0) console.log(`  … loaded ${off.toLocaleString()} so far`);
    }
  }
  console.log(`Loaded ${allProducts.length.toLocaleString()} products.`);

  // Pre-load known SKUs and median prices per product
  console.log("Loading known SKUs and prices…");
  const skuByProduct   = new Map<number, string[]>();
  const priceByProduct = new Map<number, number>(); // median known price
  {
    let off = 0;
    const allPrices = new Map<number, number[]>();
    while (true) {
      const { data } = await sb.from("dentago_supplier_products")
        .select("product_id, sku, price")
        .range(off, off + 999);
      if (!data?.length) break;
      for (const r of data as any[]) {
        if (r.sku) {
          const l = skuByProduct.get(r.product_id) ?? [];
          l.push(r.sku);
          skuByProduct.set(r.product_id, l);
        }
        if (r.price > 0) {
          const l = allPrices.get(r.product_id) ?? [];
          l.push(parseFloat(r.price));
          allPrices.set(r.product_id, l);
        }
      }
      if (data.length < 1000) break;
      off += 1000;
    }
    for (const [id, prices] of Array.from(allPrices)) {
      const sorted = prices.slice().sort((a: number, b: number) => a - b);
      priceByProduct.set(id, sorted[Math.floor(sorted.length / 2)]);
    }
  }
  console.log(`SKUs loaded: ${skuByProduct.size.toLocaleString()} products with known SKUs.`);
  console.log(`Prices loaded: ${priceByProduct.size.toLocaleString()} products with known prices.\n`);

  const suppliersToRun = SUPPLIERS.filter(s =>
    supIdMap.has(s.name) && (!supplierFlag || s.name === supplierFlag)
  );

  for (const supplier of suppliersToRun) {
    const supplierId = supIdMap.get(supplier.name)!;
    console.log(`\n━━━━━  ${supplier.name}  ━━━━━`);

    // Load already-covered product IDs for this supplier
    const covered = new Set<number>();
    const needSkuBackfill = new Set<number>();
    {
      let off = 0;
      while (true) {
        const { data } = await sb.from("dentago_supplier_products")
          .select("product_id, sku, supplier_sku")
          .eq("supplier_id", supplierId)
          .range(off, off + 999);
        if (!data?.length) break;
        for (const r of data as { product_id: number; sku?: string | null; supplier_sku?: string | null }[]) {
          covered.add(r.product_id);
          const sk = String(r.sku ?? "").trim();
          const ssk = String(r.supplier_sku ?? "").trim();
          if (!sk && !ssk) needSkuBackfill.add(r.product_id);
        }
        if (data.length < 1000) break;
        off += 1000;
      }
    }
    const uncovered = allProducts.filter(p => !covered.has(p.id));
    console.log(
      `  Already covered: ${covered.size.toLocaleString()} | Uncovered: ${uncovered.length.toLocaleString()} | Blank-SKU rows to backfill: ${needSkuBackfill.size.toLocaleString()}`,
    );

    if (uncovered.length === 0 && needSkuBackfill.size === 0) {
      console.log(`  ✓ Nothing to insert and no blank-SKU rows — skipping`);
      continue;
    }

    const targets = allProducts.filter(p => !covered.has(p.id) || needSkuBackfill.has(p.id));

    // Scrape full catalog
    console.log(`  Scraping ${supplier.name} catalog…`);
    const t0 = Date.now();
    let catalog: CatalogEntry[] = [];
    let scrapeWorked = false;
    try {
      catalog = await supplier.scrape();
      scrapeWorked = catalog.length > 0;
    } catch (e: any) {
      console.warn(`  ✗ Catalog scrape failed: ${e.message}`);
    }
    console.log(`  Scraped ${catalog.length.toLocaleString()} products in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const estMultiplier = EST_MULTIPLIERS[supplier.name];

    // Match products — real price if catalog available, EST price if not
    let realInsert = 0,
      realSkuBackfill = 0,
      estAdded = 0,
      noPrice = 0,
      skipped = 0;
    const toInsert: any[] = [];
    const toUpdate: { product_id: number; sku: string; price: number; stock: boolean }[] = [];

    for (const product of targets) {
      const isBlankSkuRow = needSkuBackfill.has(product.id);

      let price: number | null = null;
      let sku = "";
      let stock = true;
      let isEst = false;

      if (scrapeWorked) {
        // Try to match against scraped catalog
        const match = matchProduct({
          name:       product.name,
          brand:      product.brand ?? "",
          knownSkus:  skuByProduct.get(product.id) ?? [],
          knownPrice: priceByProduct.get(product.id),
        }, catalog);

        if (match) {
          price  = match.price;
          sku    = match.sku;
          stock  = match.stock;
          isEst  = false;
          if (isBlankSkuRow) {
            if (String(sku ?? "").trim()) realSkuBackfill++;
          } else {
            realInsert++;
          }
        }
      }

      // If no real match (either scrape failed or product not found), use EST
      if (price === null && estMultiplier && !isBlankSkuRow) {
        const knownPrice = priceByProduct.get(product.id);
        if (knownPrice && knownPrice > 0) {
          price = Math.round(knownPrice * estMultiplier * 100) / 100;
          isEst  = true;
          estAdded++;
        }
      }

      if (price === null) {
        noPrice++;
        continue;
      }

      const skuTrim = String(sku ?? "").trim();

      if (isDryRun) {
        const tag = isBlankSkuRow ? "BACKFILL" : isEst ? "EST" : "NEW";
        console.log(`  [DRY ${tag}] ${product.name} → £${price.toFixed(2)} ${stock ? "✓" : "OOS"} (sku: ${skuTrim || "—"})`);
      } else if (isBlankSkuRow) {
        if (!isEst && skuTrim) {
          toUpdate.push({ product_id: product.id, sku: skuTrim, price, stock });
        }
      } else {
        toInsert.push({
          product_id:  product.id,
          supplier_id: supplierId,
          price,
          stock,
          sku: skuTrim,
          delivery:    supplier.delivery,
          pack_size:   null,
        });
      }
    }

    // SKU + price updates for existing blank-sku rows (concurrent batches)
    if (!isDryRun && toUpdate.length > 0) {
      console.log(`  Updating ${toUpdate.length.toLocaleString()} blank-SKU rows with matched catalogue codes…`);
      const PAR = 25;
      let udone = 0;
      for (let i = 0; i < toUpdate.length; i += PAR) {
        const slice = toUpdate.slice(i, i + PAR);
        const results = await Promise.all(
          slice.map(async (u) => {
            const { error } = await sb
              .from("dentago_supplier_products")
              .update({
                sku: u.sku,
                price: u.price,
                stock: u.stock,
                updated_at: new Date().toISOString(),
              })
              .eq("product_id", u.product_id)
              .eq("supplier_id", supplierId);
            return { error };
          }),
        );
        for (const res of results) {
          if (res.error) console.warn(`  [WARN] sku update: ${res.error.message}`);
        }
        udone += slice.length;
        if (udone % 500 === 0 || udone === toUpdate.length) {
          console.log(`  … SKU backfill progress ${udone}/${toUpdate.length}`);
        }
      }
      console.log(`  ✓ SKU backfill updates attempted: ${udone.toLocaleString()}`);
    }

    // Bulk insert in chunks of 500
    if (!isDryRun && toInsert.length > 0) {
      console.log(`  Inserting ${toInsert.length.toLocaleString()} rows…`);
      const CHUNK = 500;
      let written = 0;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const { error } = await sb.from("dentago_supplier_products").insert(toInsert.slice(i, i + CHUNK));
        if (error && !error.message?.includes("unique") && !error.message?.includes("duplicate")) {
          console.warn(`  [WARN] insert error: ${error.message}`);
        } else {
          written += Math.min(CHUNK, toInsert.length - i);
        }
      }
      console.log(`  ✓ Written ${written.toLocaleString()} rows`);
    }

    const totalTouched = realInsert + realSkuBackfill + estAdded;
    console.log(
      `  ✓ Done: ${realInsert} new real matches, ${realSkuBackfill} SKU backfills, ${estAdded} EST inserts, ${noPrice} no price, ${skipped} skipped`,
    );
    console.log(
      `  ✓ Total matched: ${totalTouched.toLocaleString()} / ${targets.length.toLocaleString()} target products`,
    );
  }

  console.log("\n✅  All suppliers complete.");
}

main().catch(err => { console.error("\n❌ Fatal:", err); process.exit(1); });
