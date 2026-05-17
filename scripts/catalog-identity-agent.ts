/**
 * Scan dentago_products (bucketed by normalised brand) for cross-supplier duplicate candidates.
 * Writes rows to catalog_identity_suggestions for human review in Supplier Ops → Identity.
 *
 * Usage:
 *   npx tsx scripts/catalog-identity-agent.ts --dry-run
 *   npx tsx scripts/catalog-identity-agent.ts --write-db
 *   npx tsx scripts/catalog-identity-agent.ts --write-db --max-pairs 2000
 *   npx tsx scripts/catalog-identity-agent.ts --write-db --brand-key "3m"
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  brandsMatchForCatalogIdentity,
  catalogBrandIdentityKey,
  catalogIdentityConfidenceTier,
  scoreCatalogIdentityNamePair,
} from "../lib/catalog-identity-match";

dotenv.config();

type ProductRow = {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  supplier_ids: number[];
  skus: { supplier_id: number; supplier_name: string; sku: string | null; price: number | null }[];
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const dryRun = !argv.includes("--write-db");
  let maxPairs = Infinity;
  let brandKeyFilter: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--max-pairs" && argv[i + 1]) {
      maxPairs = Math.max(1, parseInt(argv[i + 1], 10));
      i++;
    }
    if (argv[i] === "--brand-key" && argv[i + 1]) {
      brandKeyFilter = argv[i + 1].toLowerCase();
      i++;
    }
  }
  return { dryRun, maxPairs, brandKeyFilter };
}

function distinctSupplierCount(a: ProductRow, b: ProductRow): number {
  const s = new Set([...a.supplier_ids, ...b.supplier_ids]);
  return s.size;
}

function shouldCompareCrossSupplier(a: ProductRow, b: ProductRow): boolean {
  if (a.supplier_ids.length === 0 || b.supplier_ids.length === 0) return false;
  if (distinctSupplierCount(a, b) < 2) return false;
  const sa = new Set(a.supplier_ids);
  const sb = new Set(b.supplier_ids);
  for (const id of sa) if (!sb.has(id)) return true;
  for (const id of sb) if (!sa.has(id)) return true;
  return false;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { dryRun, maxPairs, brandKeyFilter } = parseArgs();
  const sb = createClient(url, key);

  console.log(dryRun ? "Dry run (no DB writes). Pass --write-db to upsert suggestions." : "Writing to catalog_identity_suggestions…");

  const { data: productsRaw, error } = await sb
    .from("dentago_products")
    .select(
      `
      id,
      name,
      brand,
      category,
      image,
      dentago_supplier_products (
        supplier_id,
        sku,
        price,
        dentago_suppliers ( id, name )
      )
    `,
    );
  if (error) throw error;

  const byBrand = new Map<string, ProductRow[]>();

  for (const row of productsRaw ?? []) {
    const brand = (row.brand as string) ?? "";
    const bk = catalogBrandIdentityKey(brand);
    if (!bk) continue;

    const sps = (row as { dentago_supplier_products?: unknown[] }).dentago_supplier_products ?? [];
    const supplier_ids: number[] = [];
    const skus: ProductRow["skus"] = [];
    for (const sp of sps as {
      supplier_id: number;
      sku: string | null;
      price: number | null;
      dentago_suppliers?: { name?: string } | null;
    }[]) {
      if (!supplier_ids.includes(sp.supplier_id)) supplier_ids.push(sp.supplier_id);
      skus.push({
        supplier_id: sp.supplier_id,
        supplier_name: sp.dentago_suppliers?.name ?? `Supplier ${sp.supplier_id}`,
        sku: sp.sku,
        price: sp.price != null ? Number(sp.price) : null,
      });
    }

    const pr: ProductRow = {
      id: row.id as number,
      name: (row.name as string) ?? "",
      brand,
      category: (row.category as string) ?? null,
      image: (row.image as string) ?? null,
      supplier_ids,
      skus,
    };

    if (brandKeyFilter && bk !== brandKeyFilter) continue;

    const list = byBrand.get(bk);
    if (list) list.push(pr);
    else byBrand.set(bk, [pr]);
  }

  let comparisons = 0;
  let written = 0;
  const batch: Record<string, unknown>[] = [];
  let stopScan = false;

  outer: for (const [bk, list] of byBrand) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (comparisons >= maxPairs) {
          stopScan = true;
          break outer;
        }
        const A = list[i];
        const B = list[j];
        comparisons++;

        if (!brandsMatchForCatalogIdentity(A.brand ?? "", B.brand ?? "")) continue;
        if (!shouldCompareCrossSupplier(A, B)) continue;

        const scored = scoreCatalogIdentityNamePair(A.name, A.brand ?? "", B.name, B.brand ?? "");
        if (!scored) continue;

        const lo = Math.min(A.id, B.id);
        const hi = Math.max(A.id, B.id);
        const loRow = A.id < B.id ? A : B;
        const hiRow = A.id < B.id ? B : A;

        const tier = catalogIdentityConfidenceTier(scored.score, scored.distinguishingConflict);
        const payload = {
          product_lo: {
            id: loRow.id,
            name: loRow.name,
            brand: loRow.brand,
            category: loRow.category,
            image: loRow.image,
            supplier_skus: loRow.skus,
          },
          product_hi: {
            id: hiRow.id,
            name: hiRow.name,
            brand: hiRow.brand,
            category: hiRow.category,
            image: hiRow.image,
            supplier_skus: hiRow.skus,
          },
          score: {
            name_similarity: scored.score,
            distinguishing_conflict: scored.distinguishingConflict,
            token_jaccard_full: scored.tokenJaccardFull,
            token_jaccard_stripped: scored.tokenJaccardStripped,
            dice: scored.dice,
          },
        };

        batch.push({
          product_id_lo: lo,
          product_id_hi: hi,
          brand_key: bk,
          name_similarity: scored.score,
          category_lo: loRow.category,
          category_hi: hiRow.category,
          confidence_tier: tier,
          distinguishing_conflict: scored.distinguishingConflict,
          status: "pending_review",
          payload,
        });
        written++;

        if (!dryRun && batch.length >= 50) {
          const { error: upErr } = await sb.from("catalog_identity_suggestions").upsert(batch, {
            onConflict: "product_id_lo,product_id_hi",
          });
          if (upErr) throw upErr;
          batch.length = 0;
        }
      }
    }
  }

  if (!dryRun && batch.length > 0) {
    const { error: upErr } = await sb.from("catalog_identity_suggestions").upsert(batch, {
      onConflict: "product_id_lo,product_id_hi",
    });
    if (upErr) throw upErr;
  }

  console.log(
    JSON.stringify(
      {
        brands: byBrand.size,
        pairs_compared: comparisons,
        suggestions: written,
        dryRun,
        stopped_early: stopScan,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
