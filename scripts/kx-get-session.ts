/**
 * Capture full KX login response to find JWT fields
 */
import { chromium } from "playwright";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("api.kentexpress")) return;
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const json = await res.json();
      console.log(`\n=== ${url.slice(50)} ===`);
      console.log(JSON.stringify(json, null, 2).slice(0, 1000));
    } catch {}
  });

  await page.goto("https://www.kentexpress.co.uk/dental", { waitUntil: "networkidle", timeout: 40000 }).catch(() => {});
  await delay(3000);

  // Log all cookies set
  const cookies = await context.cookies();
  console.log("\nCookies:");
  cookies.filter(c => c.domain.includes("kent")).forEach(c => console.log(`  ${c.name}=${c.value.slice(0, 50)}`));

  await browser.close();
}
main().catch(console.error);
