/**
 * test-dental-sky-basket.ts
 *
 * One-off CLI script to verify the Dental Sky push-to-basket flow end-to-end
 * against a real account. Logs in, searches for the given SKU(s), adds each
 * to the basket, and reports per-item status. Then opens (well, prints) the
 * basket URL — log into Dental Sky in your browser to visually confirm the
 * items are sitting there waiting.
 *
 * Usage:
 *   DENTAL_SKY_USERNAME=clinic@example.com \
 *   DENTAL_SKY_PASSWORD='hunter2' \
 *   npx tsx scripts/test-dental-sky-basket.ts \
 *     --sku=1155428 --qty=1 \
 *     --sku=1192345 --qty=2
 *
 * Or with a single sku/qty pair via positional args:
 *   npx tsx scripts/test-dental-sky-basket.ts 1155428 1
 *
 * Defaults to a known-safe test sku at qty 1 if no items are passed.
 */

import "dotenv/config";
import { addToDentalSkyBasket, type BasketItem } from "../lib/scrapers-basket";

function parseArgs(argv: string[]): BasketItem[] {
  const items: BasketItem[] = [];
  const skus: string[] = [];
  const qtys: number[] = [];

  for (const arg of argv) {
    const skuMatch = arg.match(/^--sku=(.+)$/);
    const qtyMatch = arg.match(/^--qty=(\d+)$/);
    if (skuMatch) skus.push(skuMatch[1]);
    else if (qtyMatch) qtys.push(parseInt(qtyMatch[1], 10));
    else if (/^\d+$/.test(arg) && skus.length === qtys.length) {
      // Treat positional numeric args as alternating sku/qty
      if (skus.length === qtys.length) skus.push(arg);
    } else if (/^\d+$/.test(arg)) {
      qtys.push(parseInt(arg, 10));
    }
  }

  for (let i = 0; i < skus.length; i++) {
    items.push({
      searchTerm: skus[i],
      quantity: qtys[i] ?? 1,
      label: skus[i],
    });
  }
  return items;
}

async function main() {
  const username = process.env.DENTAL_SKY_USERNAME;
  const password = process.env.DENTAL_SKY_PASSWORD;

  if (!username || !password) {
    console.error("\n  Missing credentials. Set DENTAL_SKY_USERNAME and DENTAL_SKY_PASSWORD.\n");
    console.error("  Example:");
    console.error("    DENTAL_SKY_USERNAME=you@clinic.co.uk \\");
    console.error("    DENTAL_SKY_PASSWORD='secret' \\");
    console.error("    npx tsx scripts/test-dental-sky-basket.ts --sku=1155428 --qty=1\n");
    process.exit(1);
  }

  let items = parseArgs(process.argv.slice(2));
  if (items.length === 0) {
    // Sensible default — Affinis Black Edition we already know is in the catalog
    items = [{ searchTerm: "1155428", quantity: 1, label: "Affinis Black Edition (default test sku)" }];
    console.log("  No items passed — using default test SKU 1155428.\n");
  }

  console.log("─".repeat(70));
  console.log("  Dental Sky push-to-basket test");
  console.log("─".repeat(70));
  console.log(`  Account:   ${username}`);
  console.log(`  Items:     ${items.length}`);
  for (const it of items) {
    console.log(`             • ${it.searchTerm}  × ${it.quantity}   ${it.label ? `(${it.label})` : ""}`);
  }
  console.log("─".repeat(70));
  console.log("  Pushing… (login → search → add per item)\n");

  const t0 = Date.now();
  const result = await addToDentalSkyBasket(username, password, items);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`  Authenticated:  ${result.authenticated ? "✓" : "✗ login failed"}`);
  console.log(`  Items added:    ${result.added}/${result.items.length}`);
  console.log(`  Items failed:   ${result.failed}`);
  console.log(`  Elapsed:        ${elapsed}s`);
  console.log("");

  console.log("  Per-item:");
  for (const r of result.items) {
    const icon =
      r.status === "added" ? "✓" :
      r.status === "not_found" ? "?" :
      "✗";
    const ext = r.externalProductId ? `  → product_id ${r.externalProductId}` : "";
    const reason = r.reason ? `  [${r.reason}]` : "";
    console.log(`    ${icon} ${r.searchTerm}  × ${r.quantity}${ext}${reason}`);
  }

  console.log("");
  console.log("─".repeat(70));
  if (result.added > 0) {
    console.log(`  ✓ ${result.added} item(s) pushed. Verify by logging in and opening:`);
    console.log(`    ${result.basketUrl}`);
    console.log("");
    console.log("  → If you see the items in your Dental Sky basket: the round-trip works.");
  } else {
    console.log(`  ✗ Nothing added. Common causes:`);
    console.log(`    - Login failed (creds wrong, or 2FA enabled on account)`);
    console.log(`    - Product not found in search (try the product NAME instead of SKU)`);
    console.log(`    - Magento cart-add endpoint shape changed (needs scraper update)`);
  }
  console.log("─".repeat(70));

  process.exit(result.added > 0 ? 0 : 2);
}

main().catch(err => {
  console.error("\n  Unexpected error:", err);
  process.exit(1);
});
