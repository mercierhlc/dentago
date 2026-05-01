/**
 * debug-kx.ts - Debug what API calls KX makes and what responses look like
 */
import { chromium } from "playwright";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const allResponses: string[] = [];

  page.on("response", async (res) => {
    const url = res.url();
    const status = res.status();
    const ct = res.headers()["content-type"] ?? "";
    if (ct.includes("json")) {
      allResponses.push(`${status} ${url}`);
      if (url.includes("search") || url.includes("product") || url.includes("catalog")) {
        try {
          const json = await res.json();
          console.log(`\nJSON from: ${url.slice(0, 100)}`);
          console.log(JSON.stringify(json).slice(0, 500));
        } catch {}
      }
    }
  });

  console.log("Loading KX search page...");
  await page.goto("https://www.kentexpress.co.uk/search?q=gloves", {
    waitUntil: "networkidle",
    timeout: 30000,
  }).catch(() => {});

  await delay(3000);
  console.log("\nAll JSON responses intercepted:");
  allResponses.forEach(r => console.log(" ", r));

  // Check if there's content in the DOM
  const productCount = await page.evaluate(() => {
    return document.querySelectorAll("[class*='product']").length;
  });
  console.log("\nDOM product elements:", productCount);

  // Get page title and h1
  const title = await page.title();
  const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent);
  console.log("Page title:", title);
  console.log("H1:", h1);

  await browser.close();
}
main().catch(console.error);
