import 'dotenv/config';
import { chromium } from 'playwright';

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function test(username: string, password: string, label: string) {
  console.log(`\nTesting: ${label} (${username})`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA });

  let cartId = '';
  let authHeader = '';

  page.on('request', req => {
    try {
      const url = req.url();
      if (url.includes('category/search') && url.includes('cartId=') && !cartId) {
        const m = url.match(/cartId=([^&]+)/);
        if (m) { cartId = m[1]; authHeader = req.headers()['authorization'] ?? ''; }
      }
    } catch {}
  });

  await page.goto('https://www.henryschein.co.uk', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await delay(2000);
  try { await page.click("button:has-text('Accept all')", { timeout: 3000 }); await delay(500); } catch {}

  await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a')).find(x => x.textContent?.trim() === 'Sign In');
    if (a) (a as HTMLElement).click();
  });
  await delay(2500);

  const pwdSelector = "#mat-input-0,input[type='password']";
  try {
    await page.waitForSelector(pwdSelector, { timeout: 20000 });
    await page.fill('#mat-input-0', username).catch(() => {});
    await delay(300);
    await page.fill("input[type='password']", password);
    await page.press("input[type='password']", 'Enter');
    await delay(5000);
  } catch (e: any) {
    console.log(`  Login UI error: ${e.message}`);
    console.log(`  Current URL: ${page.url()}`);
    // dump visible input fields
    const inputs = await page.evaluate(() => 
      Array.from(document.querySelectorAll('input')).map(i => `${i.type}:${i.id}:${i.name}:${i.placeholder}`)
    );
    console.log(`  Inputs on page: ${JSON.stringify(inputs)}`);
    await browser.close();
    return;
  }

  console.log(`  After login URL: ${page.url()}`);
  await page.goto('https://www.henryschein.co.uk/search/gloves?type=Products', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await delay(8000);

  console.log(`  cartId: ${cartId || 'NOT CAPTURED'}`);
  console.log(`  authHeader: ${authHeader ? authHeader.substring(0,30)+'...' : 'NOT CAPTURED'}`);
  await browser.close();
}

async function main() {
  await test('karuna.giri', 'dENTAL2024', 'Karuna');
  await test('Townhousedentalpractice', 'Dental25', 'Townhouse');
}
main().catch(console.error);
