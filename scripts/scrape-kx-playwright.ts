/**
 * Kent Express scraper via Playwright search result pages.
 * Navigates to /search/TERM?type=Products for each term and intercepts
 * the product API response. No JWT extraction needed — browser has session.
 */
import 'dotenv/config';
import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const KX_SUPPLIER_ID = 2;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

const SEARCH_TERMS = [
  'anaesthetic', 'articaine', 'lidocaine', 'mepivacaine',
  'composite resin', 'bonding agent', 'dental adhesive',
  'nitrile gloves', 'latex gloves', 'vinyl gloves',
  'face mask', 'surgical mask',
  'alginate', 'polyvinylsiloxane', 'polyether impression',
  'diamond bur', 'carbide bur', 'tungsten bur', 'steel bur',
  'rotary endodontic', 'gutta percha', 'endodontic file', 'root canal sealer',
  'matrix band', 'sectional matrix',
  'glass ionomer', 'resin cement', 'zinc phosphate',
  'suture dental',
  'x-ray film', 'dental x-ray',
  'prophy paste', 'fluoride varnish',
  'whitening gel', 'bleaching',
  'orthodontic bracket', 'archwire', 'molar band',
  'surface disinfectant', 'instrument disinfectant', 'hand sanitiser',
  'autoclave pouch', 'sterilisation wrap',
  'dental needle', 'dental syringe',
  'dental scaler', 'curette', 'dental probe', 'mouth mirror',
  'rubber dam', 'dam clamp',
  'cotton roll', 'gauze', 'dental bib',
  'temporary crown', 'temporary filling',
  'impression tray', 'bite registration',
  'retraction cord', 'gingival retraction',
  'curing light', 'LED curing',
  'saliva ejector', 'suction tip',
  'fissure sealant', 'resin sealant',
  'topical anaesthetic', 'benzocaine',
  'articulating paper', 'occlusal foil',
  'composite wedge', 'wooden wedge',
  'disposable mixing tip',
  'intraoral camera',
];

let totalNew = 0;
let totalMatched = 0;
const seenSkus = new Set<string>();
let nextProductId = 0; // assigned after reading max id from DB

async function initNextId() {
  const { data } = await sb.from('dentago_products').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
  nextProductId = (data?.id ?? 0) + 1;
  console.log(`Starting product IDs from ${nextProductId}`);
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
  const catName = p.categories?.[0]?.name ?? 'Dental';

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
    const newId = nextProductId++;
    const { data: np, error } = await sb
      .from('dentago_products')
      .insert({ id: newId, canonical_slug: `DG-${String(newId).padStart(10,'0')}`, name, brand, category: catName, image, pack_size: packSize, description: `${name} — available from Kent Express.`, specs: [], similars: [] })
      .select('id').single();
    if (error || !np?.id) { console.error('Insert error:', error?.message, { name, brand, category: catName }); return; }
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
    pack_size: packSize,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: 'product_id,supplier_id' });
}

async function scrapeSearchResults(page: Page, term: string): Promise<number> {
  const products: any[] = [];

  const responseHandler = async (res: any) => {
    const url = res.url();
    if (!url.includes('category/search')) return;
    const ct = res.headers()['content-type'] ?? '';
    if (!ct.includes('json')) return;
    try {
      const json = await res.json();
      if (Array.isArray(json.products)) products.push(...json.products);
    } catch {}
  };

  page.on('response', responseHandler);

  // Use the search box so Angular SPA makes product API calls (page.goto to search URLs doesn't trigger them)
  const searchBox = await page.$('input[placeholder*="Search"]');
  if (searchBox) {
    await searchBox.click({ clickCount: 3 });
    await searchBox.fill(term);
    await delay(200);
    await searchBox.press('Enter');
    await delay(4000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await delay(1000);
  } else {
    console.warn(`  [!] Search box not found for term: "${term}"`);
  }

  page.off('response', responseHandler);

  // Process captured products
  const before = seenSkus.size;
  for (const p of products) await upsertProduct(p);
  return seenSkus.size - before;
}

async function main() {
  console.log('=== Kent Express Playwright Scraper ===');
  console.log(`${SEARCH_TERMS.length} search terms\n`);

  await initNextId();

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'Accept-Language': 'en-GB' } });
  const page = await context.newPage();

  // Load homepage first to establish session/cookies
  console.log('Loading homepage to establish session...');
  await page.goto('https://www.kentexpress.co.uk/', { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await delay(2000);
  try { await page.click("button:has-text('Accept')", { timeout: 3000 }); await delay(500); } catch {}

  for (let i = 0; i < SEARCH_TERMS.length; i++) {
    const term = SEARCH_TERMS[i];
    const added = await scrapeSearchResults(page, term);
    if (added > 0 || i % 10 === 0)
      console.log(`[${i+1}/${SEARCH_TERMS.length}] "${term}" → +${added} (total: ${seenSkus.size} SKUs, ${totalNew} new, ${totalMatched} matched)`);
    await delay(500);
  }

  await browser.close();
  console.log(`\n=== Done ===`);
  console.log(`New: ${totalNew} | Matched: ${totalMatched} | Unique SKUs: ${seenSkus.size}`);
}
main().catch(console.error);
