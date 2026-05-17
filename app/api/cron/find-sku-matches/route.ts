/**
 * GET /api/cron/find-sku-matches
 *
 * Scheduled daily at 06:00 UTC (see vercel.json).
 * Loads all supplier products, runs cross-supplier name similarity,
 * and upserts new match candidates into sku_match_candidates.
 * Existing pairs (either order) are skipped to avoid duplicates.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { findSkuMatches } from "@/lib/sku-matcher";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Load all products
  const { data: products, error: fetchErr } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select("id, name, supplier_id");

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!products || products.length === 0) {
    return NextResponse.json({ ok: true, candidates_inserted: 0, message: "No products found" });
  }

  // 2. Run matcher
  const candidates = findSkuMatches(
    products.map((p) => ({
      id: p.id as number,
      name: p.name as string,
      supplier_id: p.supplier_id as number,
    }))
  );

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, candidates_inserted: 0 });
  }

  // 3. Load existing pairs to skip duplicates
  const { data: existing } = await supabaseAdmin
    .from("sku_match_candidates")
    .select("product_a_id, product_b_id");

  const existingPairs = new Set<string>();
  for (const row of existing ?? []) {
    existingPairs.add(`${row.product_a_id}:${row.product_b_id}`);
    existingPairs.add(`${row.product_b_id}:${row.product_a_id}`);
  }

  // 4. Filter new pairs
  const newCandidates = candidates.filter(
    (c) =>
      !existingPairs.has(`${c.productA_id}:${c.productB_id}`) &&
      !existingPairs.has(`${c.productB_id}:${c.productA_id}`)
  );

  if (newCandidates.length === 0) {
    return NextResponse.json({ ok: true, candidates_inserted: 0, message: "All pairs already exist" });
  }

  // 5. Upsert
  const { error: insertErr } = await supabaseAdmin.from("sku_match_candidates").insert(
    newCandidates.map((c) => ({
      product_a_id: c.productA_id,
      product_b_id: c.productB_id,
      confidence:   c.confidence,
      reason:       c.reason,
    }))
  );

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, candidates_inserted: newCandidates.length });
}
