import * as https from "https";

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith("http") ? res.headers.location : "https://www.ddgroup.com" + res.headers.location;
        fetchHtml(loc).then(resolve).catch(reject); return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

async function main() {
  const html = await fetchHtml("https://www.ddgroup.com/anaesthetics--pharmaceuticals/");

  // Search for 29.77 (known price for AAD440)
  const idx = html.indexOf("29.77");
  console.log("29.77 found at index:", idx);
  if (idx > -1) console.log("Context:", html.substring(idx - 200, idx + 200));

  // Search for "RetailPrice" or "retail" in the HTML
  const retailIdx = html.toLowerCase().indexOf("retailprice");
  console.log("\nretailprice found at:", retailIdx);
  if (retailIdx > -1) console.log("Context:", html.substring(retailIdx - 50, retailIdx + 200));

  // Look for JSON with product data in script tags
  const scriptMatches = html.match(/<script[^>]*>([\s\S]{100,5000}?)<\/script>/g);
  console.log(`\nScript tags found: ${scriptMatches?.length}`);
  scriptMatches?.forEach((s, i) => {
    if (s.includes("AAD440") || s.includes("29.77") || s.includes("Price")) {
      console.log(`\nScript ${i} (relevant):`, s.substring(0, 300));
    }
  });

  // Look for all product links
  const links = html.match(/href="(\/[^"]+\/[a-zA-Z]{2,5}\d{3,5}[^"]*\/)"/g) ?? [];
  console.log(`\nProduct links found: ${links.length}`);
  console.log("First 5:", links.slice(0, 5));

  // Look for data- attributes with prices
  const dataPrice = html.match(/data-[a-z-]*price[^=]*="([^"]+)"/gi);
  console.log("\ndata-price attributes:", dataPrice?.slice(0, 5));
}

main().catch(console.error);
