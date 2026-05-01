/**
 * Manual QA: supplier credential scraping (≥2 portals).
 *
 * Proves negotiated-price scrapers succeed for YOUR trade logins — without
 * committing credentials to git. Not run automatically in CI.
 *
 * Prerequisites: from repo root `dentago/`
 *
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/verify-supplier-live-pricing.ts
 *
 * Or export vars in your shell — use names exactly as in `dentago_suppliers`
 * / My Suppliers UI (e.g. "Dental Sky", "Kent Express", "Henry Schein").
 *
 *   VERIFY_SEARCH_TERM=nitrile gloves        # optional — default matches home carousel scraping
 *
 *   VERIFY_SUPPLIER_1_NAME=Dental Sky
 *   VERIFY_SUPPLIER_1_USER=your@practice.uk
 *   VERIFY_SUPPLIER_1_PASS=...
 *
 *   VERIFY_SUPPLIER_2_NAME=Kent Express
 *   VERIFY_SUPPLIER_2_USER=your@practice.uk
 *   VERIFY_SUPPLIER_2_PASS=...
 *
 * Exit code 0 iff at least TWO suppliers are configured AND each returns a price > 0.
 * Exit 1 otherwise (prints what's missing).
 *
 * Implemented scrapers live in ../lib/scrapers.ts — if a supplier is not listed there,
 * this script will warn and fail for that slot.
 */

import { fetchAuthenticatedPrices, type SupplierName } from "../lib/scrapers";

const DEFAULT_TERM = "cranberry nitrile gloves large 100";

function slot(n: 1 | 2) {
  const name = process.env[`VERIFY_SUPPLIER_${n}_NAME`]?.trim();
  const username = process.env[`VERIFY_SUPPLIER_${n}_USER`]?.trim();
  const password = process.env[`VERIFY_SUPPLIER_${n}_PASS`];
  if (!name || !username || !password) return null;
  return { supplierName: name as SupplierName, username, password };
}

async function main() {
  const one = slot(1);
  const two = slot(2);
  const configured = [one, two].filter(Boolean) as {
    supplierName: SupplierName;
    username: string;
    password: string;
  }[];

  console.log("");
  console.log("Dentago — supplier live pricing scrape check");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (configured.length < 2) {
    console.error(
      "\nNeed VERIFY_SUPPLIER_1_* and VERIFY_SUPPLIER_2_* (name, user, pass) for two different suppliers.\n"
    );
    process.exit(1);
  }

  if (configured[0].supplierName === configured[1].supplierName) {
    console.error("\nConfigure two different VERIFY_SUPPLIER_*_NAME values.\n");
    process.exit(1);
  }

  const term = process.env.VERIFY_SEARCH_TERM?.trim() || DEFAULT_TERM;
  console.log(`Search term: "${term}"\n`);

  for (const c of configured) {
    console.log(`→ ${c.supplierName} (${c.username})`);
  }
  console.log("");

  const map = await fetchAuthenticatedPrices(configured, term);

  let failed = false;
  for (const c of configured) {
    const p = map.get(c.supplierName);
    if (p != null && p > 0) {
      console.log(`  ✓ ${c.supplierName}: £${p.toFixed(2)}`);
    } else {
      console.log(`  ✗ ${c.supplierName}: no price (login failed, CAPTCHA, HTML change, or no scraper)`);
      failed = true;
    }
  }

  console.log("");
  if (failed) {
    console.error("FAIL — fix credentials or scraping for suppliers marked ✗\n");
    process.exit(1);
  }

  console.log("PASS — two suppliers returned authenticated prices.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
