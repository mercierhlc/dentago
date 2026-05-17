/**
 * Kent Express authenticated scraper.
 * Logs in with clinic credentials, then intercepts API calls for product listings.
 * KX is Angular SPA on Henry Schein SAP Commerce Cloud — login flow is PKCE OAuth.
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const KX_SUPPLIER_ID = 2;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const USERNAME = process.env.KX_USERNAME || '70529148';
const PASSWORD = process.env.KX_PASSWORD || 'Matlock1!'; // Townhouse KX

let totalInserted = 0;
let totalMatched = 0;
const seenSkus = new Set<string>();

function parseProducts(json: any): any[] {
  const lists = [
    json?.products, json?.searchResults?.products,
    json?.catalogProductList?.catalogProductData, json?.data?.products,
    json?.productList, json?.results, json?.items,
    json?.content, json?.data,
  ].filter(Array.isArray);

  const results: any[] = [];
  for (const list of lists) {
    for (const item of list) {
      const sku = String(item.productCode ?? item.code ?? item.sku ?? item.id ?? '').trim();
      const name = String(item.description ?? item.name ?? item.productName ?? item.summary ?? '').trim();
      if (!name || !sku) continue;
      const key = sku || name;
      if (seenSkus.has(key)) continue;
      seenSkus.add(key);

      const image = String(item.mediaURL ?? item.imageUrl ?? item.image ?? item.primaryImageUrl ?? '').trim();
      const price = parseFloat(String(item.price ?? item.listPrice ?? item.unitPrice ?? '0')) || 0;

      results.push({ sku, name, image, price });
    }
  }
  return results;
}

async function upsertProducts(products: any[]) {
  for (const p of products) {
    // Try to match to existing dentago_products by name similarity
    const { data: match } = await sb
      .from('dentago_products')
      .select('id, name, pack_size')
      .ilike('name', `%${p.name.substring(0, 30)}%`)
      .limit(1)
      .maybeSingle();

    if (!match) {
      totalInserted++;
      // Insert new product
      const { data: newProd } = await sb
        .from('dentago_products')
        .insert({ name: p.name, brand: '', category: 'General', image: p.image || '' })
        .select('id')
        .single();
      if (!newProd?.id) continue;

      await sb.from('dentago_supplier_products').upsert({
        product_id: newProd.id,
        supplier_id: KX_SUPPLIER_ID,
        sku: p.sku,
        supplier_sku: p.sku,
        price: p.price || 0,
        stock: true,
        delivery: '2-3 days',
        name: p.name,
      }, { onConflict: 'product_id,supplier_id' });
    } else {
      totalMatched++;
      await sb.from('dentago_supplier_products').upsert({
        product_id: match.id,
        supplier_id: KX_SUPPLIER_ID,
        sku: p.sku,
        supplier_sku: p.sku,
        price: p.price || 0,
        stock: true,
        delivery: '2-3 days',
        name: p.name,
      }, { onConflict: 'product_id,supplier_id' });
    }
  }
}

async function main() {
  console.log('=== Kent Express Authenticated Scraper ===\n');
  console.log(`Using credentials: ${USERNAME}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-web-security'],
  });

  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });

  const page = await context.newPage();
  const allProducts: any[] = [];
  const capturedUrls = new Set<string>();

  page.on('response', async (res) => {
    const url = res.url();
    if (capturedUrls.has(url)) return;
    if (!url.includes('kentexpress') && !url.includes('henryschein')) return;
    const ct = res.headers()['content-type'] ?? '';
    if (!ct.includes('json')) return;
    try {
      const json = await res.json();
      const products = parseProducts(json);
      if (products.length > 0) {
        capturedUrls.add(url);
        console.log(`  🎯 ${products.length} products from: ...${url.slice(-70)}`);
        allProducts.push(...products);
      }
    } catch {}
  });

  console.log('Loading homepage...');
  await page.goto('https://www.kentexpress.co.uk/', { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await delay(2000);

  // Dismiss cookie banner
  try {
    await page.click("button:has-text('Accept')", { timeout: 3000 });
    await delay(1000);
  } catch {}
  try {
    await page.evaluate(() => {
      document.getElementById('usercentrics-root')?.remove();
      (document.querySelector('[id*=cookie],[class*=cookie],[id*=consent]') as HTMLElement)?.remove();
    });
  } catch {}

  console.log('Looking for login link...');
  // Try to find and click login
  const loginClicked = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button'));
    const loginLink = links.find(el => /sign.?in|log.?in/i.test(el.textContent ?? ''));
    if (loginLink) { (loginLink as HTMLElement).click(); return true; }
    return false;
  });

  if (loginClicked) {
    console.log('Clicked login link');
    await delay(4000);
    console.log(`Current URL after click: ${page.url()}`);

    // KX login opens a panel/redirect — wait for password field then find the text field before it
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      // Find the nearest preceding text/email input (KX has plain <input type="text"> with no name/placeholder)
      const usernameInput = await page.$('input[type="text"]:not([placeholder*="Search"]):not([name="q"]), input[type="email"]');
      if (usernameInput) {
        await usernameInput.fill(USERNAME);
        await delay(300);
        await passwordInput.fill(PASSWORD);
        await delay(300);
        await passwordInput.press('Enter');
        console.log('Submitted login form');
        await delay(6000);
        console.log(`After login URL: ${page.url()}`);
      } else {
        // Try clicking just before the password field and tab
        await passwordInput.click({ clickCount: 3 });
        const box = await passwordInput.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y - 40);
          await page.keyboard.type(USERNAME);
          await delay(300);
        }
        await passwordInput.fill(PASSWORD);
        await delay(300);
        await passwordInput.press('Enter');
        console.log('Submitted login (mouse approach)');
        await delay(6000);
      }
    } else {
      console.log('No password field found after clicking login');
      const inputs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input')).map(i => `${i.type}|${i.name}|${i.placeholder}`)
      );
      console.log(`Available inputs: ${JSON.stringify(inputs)}`);
    }
  } else {
    console.log('No login link found, proceeding as guest...');
  }

  // Navigate through dental categories
  const categories = [
    '/dental', '/dental/dental-anaesthetics', '/dental/composites-and-adhesives',
    '/dental/cements', '/dental/impression-materials', '/dental/burs',
    '/dental/hand-instruments', '/dental/endodontics', '/dental/orthodontics',
    '/dental/whitening', '/dental/infection-control', '/dental/sterilisation',
    '/dental/rotary-instruments', '/dental/preventive', '/dental/x-ray',
    '/dental/surgery', '/dental/gloves', '/dental/needles-and-syringes',
    '/dental/matrix-bands', '/dental/rubber-dam', '/dental/restorative',
  ];

  for (const cat of categories) {
    const before = allProducts.length;
    console.log(`\nNavigating: ${cat}`);

    // Try direct navigation first
    await page.goto(`https://www.kentexpress.co.uk${cat}`, {
      waitUntil: 'networkidle', timeout: 20000
    }).catch(() => {});
    await delay(3000);

    // Also scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await delay(2000);

    console.log(`  Got ${allProducts.length - before} products`);
  }

  await browser.close();

  console.log(`\nTotal captured: ${allProducts.length}`);

  if (allProducts.length > 0) {
    console.log('Upserting to DB...');
    await upsertProducts(allProducts);
    console.log(`Done: ${totalInserted} new, ${totalMatched} matched`);
  } else {
    console.log('No products captured — KX may require different auth approach');
  }
}

main().catch(console.error);
