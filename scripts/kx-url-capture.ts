import 'dotenv/config';
import { chromium } from 'playwright';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Log full product search URLs
  page.on('request', req => {
    const url = req.url();
    if (url.includes('category/search') || url.includes('searchcontent')) {
      console.log(`REQUEST: ${url}`);
      const headers = req.headers();
      const relevant = Object.fromEntries(
        Object.entries(headers).filter(([k]) => ['authorization','cookie','x-'].some(p => k.startsWith(p)))
      );
      console.log(`HEADERS: ${JSON.stringify(relevant).substring(0, 300)}`);
    }
  });

  await page.goto('https://www.kentexpress.co.uk/', { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await delay(2000);
  try { await page.click("button:has-text('Accept')", { timeout: 3000 }); await delay(500); } catch {}

  const searchBox = await page.$('input[placeholder*="Search"]');
  if (searchBox) {
    await searchBox.fill('nitrile gloves');
    await searchBox.press('Enter');
    await delay(6000);
  }
  await browser.close();
}
main().catch(console.error);
