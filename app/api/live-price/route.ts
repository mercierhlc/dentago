import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import * as https from "https";

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
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
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku")?.toUpperCase().trim();
  if (!sku) return NextResponse.json({ error: "sku required" }, { status: 400 });

  try {
    // Search DD Group for this SKU — results embed Algolia JSON with current price
    const html = await fetchHtml(`https://www.ddgroup.com/search/?query=${encodeURIComponent(sku)}`);

    // Extract hits array
    const hitsIdx = html.indexOf('"hits":[{"name"');
    if (hitsIdx === -1) return NextResponse.json({ error: "no hits" }, { status: 404 });

    const arrayStart = html.indexOf("[", hitsIdx);
    let depth = 0, i = arrayStart, end = -1;
    while (i < html.length && i < arrayStart + 600000) {
      const c = html[i];
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") { depth--; if (depth === 0) { end = i; break; } }
      i++;
    }
    if (end === -1) return NextResponse.json({ error: "parse error" }, { status: 500 });

    const hits = JSON.parse(html.substring(arrayStart, end + 1));
    const hit = hits.find((h: any) => (h.code || "").toString().toUpperCase() === sku);
    if (!hit) return NextResponse.json({ error: "sku not found" }, { status: 404 });

    const livePrice = parseFloat(hit.catalogPrice ?? 0);
    if (!livePrice) return NextResponse.json({ error: "no price" }, { status: 404 });

    // Update DB in background if price changed
    const { data: row } = await supabaseAdmin
      .from("dentago_supplier_products")
      .select("price, supplier_id")
      .eq("sku", sku)
      .eq("supplier_id", 76)  // DD Group
      .maybeSingle();

    if (row && Math.abs(livePrice - row.price) > 0.001) {
      supabaseAdmin
        .from("dentago_supplier_products")
        .update({ price: livePrice, updated_at: new Date().toISOString() })
        .eq("sku", sku)
        .eq("supplier_id", 76)
        .then(() => {});
    }

    return NextResponse.json({ sku, price: livePrice, inStock: hit.stockStatus !== "oos" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
