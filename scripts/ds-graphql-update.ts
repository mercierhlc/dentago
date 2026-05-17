/**
 * Dental Sky full price update via existing GraphQL lib.
 * No login needed — DS GraphQL is public.
 *
 * Run: cd ~/dentago && npx tsx scripts/ds-graphql-update.ts
 */
import "dotenv/config";
import { runDentalSkyPriceRefresh } from "@/lib/run-dental-sky-price-refresh";

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  DENTAL SKY — GraphQL Price Update");
  console.log("═══════════════════════════════════════\n");

  const result = await runDentalSkyPriceRefresh();
  console.log("\n" + JSON.stringify(result, null, 2));

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DENTAL SKY UPDATE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SKUs fetched from GraphQL:   ${result.skusFetched}
  DB rows considered:          ${result.rowsConsidered}
  Rows refreshed:              ${result.rowsRefreshed}
  Price/stock changed:         ${result.priceOrStockChanged}
  Missing from feed:           ${result.missingFromFeed}
  Elapsed:                     ${(result.elapsedMs / 1000).toFixed(1)}s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
