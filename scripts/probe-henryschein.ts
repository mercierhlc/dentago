import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture ALL network requests
  const apiCalls: { method: string; url: string; body?: string }[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.endsWith(".woff2") && !url.endsWith(".css") && !url.endsWith(".js") &&
        !url.includes("google") && !url.includes("analytics") && !url.includes("fonts")) {
      apiCalls.push({ method: req.method(), url });
    }
  });

  const responses: { url: string; status: number; snippet: string }[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (ct.includes("json") && !url.includes("google") && !url.includes("analytics")) {
      try {
        const text = await res.text();
        responses.push({ url, status: res.status(), snippet: text.slice(0, 300) });
      } catch {}
    }
  });

  console.log("Loading Henry Schein...");
  await page.goto("https://www.henryschein.co.uk/dental/Products/c/DEN", {
    waitUntil: "domcontentloaded",
    timeout: 40000,
  });

  // Wait for Angular to hydrate
  await page.waitForTimeout(8000);

  console.log(`\n📡 ${apiCalls.length} network requests total`);
  console.log("Sample URLs:");
  apiCalls.slice(0, 20).forEach((c) => console.log(`  ${c.method} ${c.url}`));

  console.log(`\n📦 ${responses.length} JSON responses:`);
  responses.forEach((r) => console.log(`  [${r.status}] ${r.url}\n    ${r.snippet}\n`));

  await browser.close();
}

main().catch(console.error);
