/**
 * Kent Express catalog scraper.
 * Step 1: Use Playwright to load the KX Angular SPA and capture the Gigya JWT.
 * Step 2: Use the JWT to hit the product search API directly at scale.
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const KX_SUPPLIER_ID = 2;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

const SEARCH_TERMS = [
  'anaesthetic', 'articaine', 'lidocaine', 'septanest', 'carbocaine',
  'composite', 'bonding', 'adhesive', 'etch',
  'nitrile gloves', 'latex gloves', 'vinyl gloves', 'examination gloves',
  'face mask', 'surgical mask', 'FFP2', 'FFP3',
  'alginate', 'polyether', 'polyvinylsiloxane', 'impression',
  'bur diamond', 'bur carbide', 'bur tungsten', 'surgical bur',
  'rotary file', 'gutta percha', 'endodontic', 'K-file', 'H-file',
  'matrix band', 'sectional matrix', 'tofflemire',
  'glass ionomer cement', 'resin cement', 'zinc oxide', 'phosphate cement',
  'suture', 'silk suture', 'vicryl',
  'x-ray', 'film', 'barrier envelope', 'sensor cover',
  'prophy paste', 'fluoride varnish', 'fluoride gel',
  'whitening', 'bleaching gel', 'tooth whitening',
  'orthodontic bracket', 'archwire', 'molar band',
  'disinfectant', 'surface wipe', 'hand sanitiser', 'instrument cleaner',
  'autoclave pouch', 'sterilisation wrap', 'indicator tape',
  'dental needle', 'aspirating syringe', 'cartridge syringe',
  'scaler', 'curette', 'probe', 'mirror', 'tweezers', 'forceps',
  'burnisher', 'plugger', 'condenser', 'carver',
  'rubber dam', 'dam clamp', 'dam frame', 'dam punch',
  'cotton roll', 'gauze', 'bib', 'patient towel',
  'impression tray', 'stock tray', 'custom tray material',
  'temporary crown', 'provisional crown', 'temporary filling', 'cavit',
  'retraction cord', 'gingival retraction',
  'curing light', 'LED light', 'light cure',
  'handpiece maintenance', 'turbine oil', 'handpiece oil',
  'saliva ejector', 'high volume suction', 'evacuation tip',
  'fissure sealant', 'pit fissure', 'resin sealant',
  'topical anaesthetic', 'benzocaine gel', 'numbing gel',
  'articulating paper', 'occlusion foil', 'shimstock',
  'wedge', 'wooden wedge', 'plastic wedge',
  'disposable tips', 'mixing tip', 'applicator tip',
  'zirconia', 'porcelain', 'ceramic crown',
];

let totalNew = 0;
let totalMatched = 0;
const seenSkus = new Set<string>();

async function getJwt(): Promise<string> {
  console.log('Launching browser to get KX JWT...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  let jwt = '';
  page.on('request', req => {
    const url = req.url();
    const auth = req.headers()['authorization'] ?? '';
    // Only capture real Gigya JWTs (300+ chars), not short tokens
    if (url.includes('api.kentexpress') && auth.length > 200 && !jwt) {
      jwt = auth;
    }
  });

  await page.goto('https://www.kentexpress.co.uk/', { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await delay(2000);
  try { await page.click("button:has-text('Accept')", { timeout: 3000 }); await delay(500); } catch {}
  try { await page.evaluate(() => { document.getElementById('usercentrics-root')?.remove(); }); } catch {}

  // Trigger a search to force a product API call and capture the JWT
  const searchBox = await page.$('input[placeholder*="Search"]');
  if (searchBox) {
    await searchBox.fill('gloves');
    await searchBox.press('Enter');
    await delay(5000);
  }

  await browser.close();
  if (!jwt) throw new Error('Failed to capture KX JWT from browser');
  console.log(`JWT captured (${jwt.length} chars)\n`);
  return jwt;
}

async function searchProducts(term: string, page: number, jwt: string): Promise<{ products: any[]; totalPages: number }> {
  const query = Buffer.from(`${term}:relevance`).toString('base64');
  const url = `https://api.kentexpress.co.uk/eapi/web-product-details/v2/product/category/search/kentxprs-gb?query=${encodeURIComponent(query)}&currentPage=${page}&pageSize=100`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: jwt,
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: 'https://www.kentexpress.co.uk/',
        Origin: 'https://www.kentexpress.co.uk',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('JWT_EXPIRED');
      return { products: [], totalPages: 0 };
    }
    const json = await res.json();
    return { products: json.products ?? [], totalPages: json.pagination?.totalPages ?? 0 };
  } catch (e: any) {
    if (e.message === 'JWT_EXPIRED') throw e;
    return { products: [], totalPages: 0 };
  }
}

async function upsertProduct(p: any) {
  const sku = String(p.code ?? p.productCode ?? '').trim();
  const name = String(p.name ?? '').trim();
  if (!sku || !name || seenSkus.has(sku)) return;
  seenSkus.add(sku);

  const image = (() => {
    const imgs = p.images ?? [];
    const primary = imgs.find((i: any) => i.imageType === 'PRIMARY') ?? imgs[0];
    const u = primary?.url ?? '';
    return u.startsWith('http') ? u : u ? `https://www.kentexpress.co.uk${u}` : '';
  })();

  const price = typeof p.price?.value === 'number' ? p.price.value :
    parseFloat(String(p.price?.formattedValue ?? '0').replace(/[^0-9.]/g, '')) || 0;

  const inStock = p.stock?.stockLevelStatus !== 'outOfStock';
  const packSize = p.unit ?? '';
  const brand = p.brand?.name ?? '';
  const catName = p.categories?.[0]?.name ?? 'General';

  // Try to match existing dentago_products by name prefix
  const prefix = name.substring(0, 30).replace(/[%_]/g, '');
  const { data: match } = await sb
    .from('dentago_products')
    .select('id')
    .ilike('name', `${prefix}%`)
    .limit(1)
    .maybeSingle();

  let productId: number;
  if (match?.id) {
    productId = match.id as number;
    totalMatched++;
  } else {
    const { data: np, error } = await sb
      .from('dentago_products')
      .insert({ name, brand, category: catName, image, pack_size: packSize })
      .select('id').single();
    if (error || !np?.id) return;
    productId = np.id as number;
    totalNew++;
  }

  await sb.from('dentago_supplier_products').upsert({
    product_id: productId,
    supplier_id: KX_SUPPLIER_ID,
    sku, supplier_sku: sku,
    price, stock: inStock,
    stock_status: inStock ? 'in_stock' : 'out_of_stock',
    delivery: '1-2 days',
    name, pack_size: packSize,
  }, { onConflict: 'product_id,supplier_id' });
}

async function main() {
  console.log('=== Kent Express API Scraper ===');
  let jwt = await getJwt();

  for (let t = 0; t < SEARCH_TERMS.length; t++) {
    const term = SEARCH_TERMS[t];
    let allProducts: any[] = [];

    try {
      const { products: p0, totalPages } = await searchProducts(term, 0, jwt);
      allProducts.push(...p0);
      for (let pg = 1; pg < Math.min(totalPages, 40); pg++) {
        await delay(150);
        const { products } = await searchProducts(term, pg, jwt);
        allProducts.push(...products);
      }
    } catch (e: any) {
      if (e.message === 'JWT_EXPIRED') {
        console.log('\nJWT expired — refreshing...');
        jwt = await getJwt();
        t--; continue; // retry this term
      }
    }

    const before = seenSkus.size;
    for (const p of allProducts) await upsertProduct(p);
    const added = seenSkus.size - before;
    if (allProducts.length > 0 || added > 0)
      console.log(`[${t+1}/${SEARCH_TERMS.length}] "${term}" → ${allProducts.length} results, +${added} new (total: ${seenSkus.size} SKUs)`);
    await delay(300);
  }

  console.log(`\n=== Done ===`);
  console.log(`New products: ${totalNew} | Matched existing: ${totalMatched} | Unique SKUs: ${seenSkus.size}`);
}

main().catch(console.error);
