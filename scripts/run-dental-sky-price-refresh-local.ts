/**
 * Run the same Dental Sky price sync as the production cron, locally (service role from .env).
 *
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required.
 *
 *   npx tsx scripts/run-dental-sky-price-refresh-local.ts
 *   npx tsx scripts/run-dental-sky-price-refresh-local.ts 355-0117 355-0118
 *
 * With SKUs: skips the long category crawl and only GraphQL-fetches those SKUs.
 */
import "dotenv/config";
import { runDentalSkyPriceRefresh } from "@/lib/run-dental-sky-price-refresh";

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const fromArgs = process.argv.slice(2).filter(Boolean);
  const skusOnly = fromArgs.length > 0 ? fromArgs : undefined;
  const out = await runDentalSkyPriceRefresh(skusOnly ? { skusOnly } : undefined);
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
