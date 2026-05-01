import * as https from "https";

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

async function main() {
  const url = "https://www.ddgroup.com/anaesthetics--pharmaceuticals/local-anaesthetic/aad440--septanest-1100000/";
  const html = await fetchHtml(url);

  const priceMatch = html.match(/£\s*(\d+\.\d{2})/);
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  const skuMatch = url.match(/\/([a-zA-Z]{2,4}\d{3,5})--/i);
  const packMatch = html.match(/\((\d+\s*x\s*[^)]+)\)/) || html.match(/((?:Box|Pack|Bag)\s+(?:of\s+)?\d+[^<,\n]*)/i);

  console.log("Price:", priceMatch?.[1]);
  console.log("Name:", nameMatch?.[1]?.trim());
  console.log("SKU:", skuMatch?.[1]?.toUpperCase());
  console.log("Pack:", packMatch?.[1]);

  // Show context around price
  const idx = html.indexOf("29.77");
  if (idx > -1) console.log("\nContext:", html.substring(idx - 150, idx + 100));

  // Show first product link pattern
  const linkMatch = html.match(/href="(\/[^"]+\/[a-zA-Z]{2,4}\d{3,5}--[^"]+\/)"/i);
  console.log("\nSample product link found:", linkMatch?.[1]);
}

main().catch(console.error);
