/**
 * Runs all public-catalog price refresh crons in sequence (no new tables).
 *
 * Covers the **public-feed** core suppliers: DD Group, Dental Sky, DHB.
 * (Henry Schein + Kent Express use clinic logins — see sync-prices / admin force-sync.)
 *
 * Uses existing API routes — same logic as production GitHub Actions refresh.
 *
 *   NEXT_PUBLIC_SITE_URL or DENTAGO_BASE_URL — e.g. https://www.dentago.co.uk
 *   CRON_SECRET — must match Vercel env
 *
 *   npx tsx scripts/refresh-all-public-supplier-prices.ts
 */
import "dotenv/config";
import { PUBLIC_PRICE_CRON_ROUTES } from "../lib/main-suppliers";

const BASE =
  process.env.DENTAGO_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "";
const SECRET = process.env.CRON_SECRET || "";

const ROUTES = PUBLIC_PRICE_CRON_ROUTES;

async function main() {
  if (!BASE) {
    console.error(
      "Set DENTAGO_BASE_URL or NEXT_PUBLIC_SITE_URL (e.g. https://www.dentago.co.uk)",
    );
    process.exit(1);
  }
  if (!SECRET) {
    console.error("Set CRON_SECRET");
    process.exit(1);
  }

  const results: Record<string, unknown>[] = [];

  for (const path of ROUTES) {
    const url = `${BASE}${path}`;
    console.log(`\n→ ${path}`);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(600_000),
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (!res.ok) {
      console.error(`  HTTP ${res.status}`, body);
      process.exit(1);
    }
    console.log(JSON.stringify(body, null, 2));
    results.push({ path, ...(typeof body === "object" && body && !Array.isArray(body) ? (body as object) : { raw: body }) });
  }

  console.log("\n✅ All public supplier price refreshes completed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
