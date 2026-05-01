import { chromium } from "playwright";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const jsonResponses: string[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    const skipDomains = ["usercentrics", "dynamicyield", "powerreviews", "applicationinsights", "go-mpulse", "dc.services"];
    if (ct.includes("json") && !skipDomains.some(d => url.includes(d))) {
      try {
        const json = await res.json();
        const jsonStr = JSON.stringify(json).slice(0, 300);
        jsonResponses.push(`${res.status()} ${url.slice(0, 100)}\n   ${jsonStr}`);
      } catch {
        jsonResponses.push(`${res.status()} ${url.slice(0, 100)} [parse error]`);
      }
    }
  });

  console.log("Loading KX homepage...");
  await page.goto("https://www.kentexpress.co.uk/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await delay(2000);

  console.log("Navigating to /dental...");
  await page.goto("https://www.kentexpress.co.uk/dental", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await delay(3000);

  console.log("\nJSON responses:");
  jsonResponses.forEach(r => console.log(r));

  const title = await page.title();
  const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim());
  const productEls = await page.evaluate(() => document.querySelectorAll("[class*='product']").length);
  console.log("\nPage title:", title);
  console.log("H1:", h1);
  console.log("Product elements:", productEls);

  await browser.close();
}
main().catch(console.error);
