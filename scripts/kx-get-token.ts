import 'dotenv/config';
import { chromium } from 'playwright';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  let capturedToken = '';
  let capturedBaseUrl = '';

  page.on('request', req => {
    const url = req.url();
    if (url.includes('api.kentexpress') && req.headers()['authorization']) {
      capturedToken = req.headers()['authorization'];
      capturedBaseUrl = url.split('?')[0];
      console.log(`TOKEN CAPTURED from: ${url.substring(0, 80)}`);
    }
  });

  await page.goto('https://www.kentexpress.co.uk/', { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await delay(2000);
  try { await page.click("button:has-text('Accept')", { timeout: 3000 }); await delay(500); } catch {}
  try { await page.evaluate(() => { document.getElementById('usercentrics-root')?.remove(); }); } catch {}

  // Trigger search to get an API call with auth
  const searchBox = await page.$('input[placeholder*="Search"]');
  if (searchBox) {
    await searchBox.fill('gloves');
    await searchBox.press('Enter');
    await delay(6000);
  }

  console.log(`\nToken: ${capturedToken || 'NOT FOUND'}`);
  console.log(`Base URL: ${capturedBaseUrl}`);

  // Also dump all KX API cookies/local storage
  const cookies = await context.cookies('https://www.kentexpress.co.uk');
  console.log(`\nCookies: ${JSON.stringify(cookies.slice(0, 5).map(c => c.name), null, 2)}`);

  const storage = await page.evaluate(() => ({
    localStorage: Object.fromEntries(Object.entries(localStorage).slice(0, 10)),
    sessionStorage: Object.fromEntries(Object.entries(sessionStorage).slice(0, 10)),
  }));
  console.log(`localStorage keys: ${Object.keys(storage.localStorage).join(', ')}`);
  console.log(`sessionStorage keys: ${Object.keys(storage.sessionStorage).join(', ')}`);

  await browser.close();
}
main().catch(console.error);
