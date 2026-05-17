import 'dotenv/config';
import { chromium } from 'playwright';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Log ALL network requests to find the search/catalog API
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('kentexpress') && !url.includes('henryschein') && !url.includes('api.')) return;
    const ct = res.headers()['content-type'] ?? '';
    if (!ct.includes('json')) return;
    try {
      const json = await res.json();
      const str = JSON.stringify(json);
      // Only log if it looks like it has products
      if (str.includes('productCode') || str.includes('products') || str.includes('catalogProduct')) {
        const size = (str.length / 1024).toFixed(1);
        console.log(`[${size}KB] ${url.substring(0, 120)}`);
        // Show structure
        const keys = Object.keys(json);
        console.log(`  keys: ${keys.slice(0, 10).join(', ')}`);
        if (Array.isArray(json.products)) console.log(`  products.length: ${json.products.length}`);
        if (json.pagination) console.log(`  pagination: ${JSON.stringify(json.pagination)}`);
      }
    } catch {}
  });

  console.log('Loading homepage...');
  await page.goto('https://www.kentexpress.co.uk/', { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await delay(2000);

  // Dismiss cookie banner
  try { await page.click("button:has-text('Accept')", { timeout: 3000 }); await delay(1000); } catch {}
  try { await page.evaluate(() => { document.getElementById('usercentrics-root')?.remove(); }); } catch {}

  // Try using the search box to search for dental products
  console.log('\nTyping in search box...');
  const searchBox = await page.$('input[placeholder*="Search"], input[type="text"]:first-of-type');
  if (searchBox) {
    await searchBox.fill('gloves');
    await searchBox.press('Enter');
    await delay(5000);
    console.log(`URL after search: ${page.url()}`);
  }

  // Also try clicking a category link in nav
  console.log('\nLooking for dental category links...');
  const navLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="dental"], a[href*="product"]'))
      .slice(0, 5)
      .map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() }))
  );
  console.log(JSON.stringify(navLinks, null, 2));

  await browser.close();
}

main().catch(console.error);
