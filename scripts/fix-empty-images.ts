/**
 * Fix empty product images using Dental Sky GraphQL API.
 * For each product with no image, search DS by name and pull the image URL.
 */
import { createClient } from "@supabase/supabase-js";
import * as https from "https";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function gqlPost(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: "www.dentalsky.com",
      path: "/graphql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      }
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

async function searchDSForImage(name: string): Promise<string> {
  // Use first 3-4 words of name for search
  const searchTerm = name.split(" ").slice(0, 4).join(" ").replace(/[^a-zA-Z0-9 ]/g, "");
  const query = `{
    products(search: "${searchTerm}", pageSize: 1) {
      items {
        small_image { url }
        image { url }
      }
    }
  }`;
  const res = await gqlPost(query);
  const item = res?.data?.products?.items?.[0];
  return item?.small_image?.url || item?.image?.url || "";
}

async function main() {
  console.log("=== Fix Empty Images via Dental Sky GraphQL ===\n");

  const { data: emptyProducts } = await sb
    .from("dentago_products")
    .select("id, name, brand, category")
    .or("image.is.null,image.eq.");

  console.log(`Products with empty/null images: ${emptyProducts?.length}\n`);

  let fixed = 0, failed = 0;

  for (let i = 0; i < (emptyProducts?.length ?? 0); i++) {
    const product = emptyProducts![i];
    try {
      const imageUrl = await searchDSForImage(product.name);

      if (imageUrl) {
        await sb.from("dentago_products").update({ image: imageUrl }).eq("id", product.id);
        fixed++;
        console.log(`✅ [${i + 1}/${emptyProducts!.length}] ${product.name.slice(0, 55)}`);
      } else {
        failed++;
        console.log(`❌ [${i + 1}/${emptyProducts!.length}] No image: ${product.name.slice(0, 55)}`);
      }
    } catch (e: any) {
      failed++;
      console.log(`❌ [${i + 1}/${emptyProducts!.length}] Error (${e.message}): ${product.name.slice(0, 40)}`);
    }
    await delay(400);
  }

  console.log(`\n=== Done: ${fixed} fixed, ${failed} could not fix ===`);
}

main().catch(console.error);
