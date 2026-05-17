import 'dotenv/config';
import { chromium } from 'playwright';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  let jwt = '';
  page.on('request', req => {
    const url = req.url();
    const auth = req.headers()['authorization'] ?? '';
    if (url.includes('api.kentexpress') && auth.length > 200 && !jwt) {
      jwt = auth;
    }
  });

  await page.goto('https://www.kentexpress.co.uk/', { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await delay(2000);
  try { await page.click("button:has-text('Accept')", { timeout: 3000 }); await delay(500); } catch {}

  const searchBox = await page.$('input[placeholder*="Search"]');
  if (searchBox) {
    await searchBox.fill('gloves');
    await searchBox.press('Enter');
    await delay(5000);
  }

  console.log(`JWT: ${jwt ? jwt.substring(0, 50)+'...' : 'NONE'}`);

  // Try page.evaluate to make the request from inside the browser context (same cookies/session)
  const result = await page.evaluate(async ({ jwt }) => {
    const query = btoa('gloves:relevance');
    const url = `https://api.kentexpress.co.uk/eapi/web-product-details/v2/product/category/search/kentxprs-gb?query=${query}&currentPage=0&pageSize=5`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: jwt, Accept: 'application/json' }
      });
      const text = await res.text();
      return { status: res.status, body: text.substring(0, 1000) };
    } catch (e: any) {
      return { status: -1, error: e.message };
    }
  }, { jwt });

  console.log(`Status: ${result.status}`);
  console.log(`Body: ${JSON.stringify(result.body ?? result.error).substring(0, 500)}`);

  await browser.close();
}
main().catch(console.error);
