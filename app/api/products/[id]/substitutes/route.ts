/**
 * GET /api/products/[id]/substitutes
 *
 * Returns clinical equivalent substitutes for a given product.
 *
 * Strategy (scored, in priority order):
 *   40 pts — same category (hard requirement; cross-category never returned)
 *   20 pts — same brand (shares material spec baseline)
 *   20 pts — same material type (from specs)
 *   Higher-scoring substitutes rank first; ties broken by best price ascending.
 *
 * Stock source: `dentago_supplier_products.stock` (live) combined with the
 * denormalised `dentago_products.in_stock` flag (indexed, updated by trigger).
 * The API filters on in-stock supplier rows so results are always orderable.
 *
 * Safety rationale: substitutes are scoped to the same dental category
 * (e.g. "Impression Materials") to avoid cross-category mismatches.
 * Same-brand and same-material suggestions are preferred as they share
 * clinical specifications. Clinicians must verify suitability before substituting.
 *
 * Query parameters:
 *   limit  — max results (default 6, max 12)
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { rankSubstitutes } from "@/lib/substitute-scoring";
import type { CandidateProduct, SourceProduct } from "@/lib/substitute-scoring";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = parseInt(searchParams.get("limit") ?? "6");
  const limit = isNaN(rawLimit) ? 6 : Math.min(Math.max(1, rawLimit), 12);

  // ── 1. Fetch the source product ───────────────────────────────────────────
  const { data: product, error: productErr } = await supabaseAdmin
    .from("dentago_products")
    .select("id, name, brand, category, variations, similars, specs, in_stock")
    .eq("id", productId)
    .single();

  if (productErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // ── 2. If product is in stock, return empty (no substitution needed) ──────
  //
  // We check the live supplier rows rather than the denormalized flag to ensure
  // accuracy (the flag can lag by one cron cycle).
  const { data: liveStockCheck } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select("stock")
    .eq("product_id", productId)
    .eq("stock", true)
    .limit(1);

  const isInStockLive = (liveStockCheck ?? []).length > 0;
  if (isInStockLive) {
    return NextResponse.json({
      productId,
      category: product.category,
      substitutes: [],
      inStock: true,
      safetyNote: null,
    });
  }

  // ── 3. Determine excluded IDs (self + variations) ─────────────────────────
  const variationIds: number[] = Array.isArray(product.variations)
    ? product.variations.map((x: unknown) => Number(x)).filter((x: number) => Number.isFinite(x))
    : [];
  const excludeIds = [productId, ...variationIds];

  // ── 4. Fetch candidates — same category, in_stock = true (denormalised) ──
  //
  // Using in_stock index for efficiency. We still verify against live supplier
  // rows in step 5 to handle any flag lag.
  const { data: candidateRows, error: candErr } = await supabaseAdmin
    .from("dentago_products")
    .select(`
      id, name, brand, category, image, pack_size, specs,
      dentago_supplier_products ( price, stock )
    `)
    .eq("category", product.category)
    .eq("in_stock", true)
    .not("id", "in", `(${excludeIds.join(",")})`)
    .limit(200);

  if (candErr) {
    return NextResponse.json({ error: "Failed to fetch substitutes" }, { status: 500 });
  }

  // ── 5. Shape candidates — only include products with live in-stock prices ─
  const source: SourceProduct = {
    id: product.id,
    category: product.category,
    brand: product.brand ?? null,
    specs: product.specs ?? null,
  };

  const candidates: CandidateProduct[] = (candidateRows ?? []).flatMap(c => {
    const spList = (c.dentago_supplier_products ?? []) as { price: string | number; stock: boolean }[];
    const inStockPrices = spList
      .filter(sp => sp.stock)
      .map(sp => parseFloat(String(sp.price)))
      .filter(p => Number.isFinite(p));

    // Skip products with no live in-stock supplier (catches flag lag)
    if (inStockPrices.length === 0) return [];

    return [{
      id: c.id,
      name: c.name,
      brand: c.brand ?? null,
      category: c.category,
      image: c.image,
      pack_size: c.pack_size ?? null,
      specs: c.specs ?? null,
      inStockPrices,
    }];
  });

  // ── 6. Rank using scored substitution logic ───────────────────────────────
  const substitutes = rankSubstitutes(source, candidates, limit);

  // ── 7. Log event (fire-and-forget) ───────────────────────────────────────
  logEvent({
    event_type: "substitute_lookup",
    entity_type: "product",
    entity_id: String(productId),
    payload: {
      product_id: productId,
      product_name: product.name,
      category: product.category,
      substitutes_found: substitutes.length,
      top_score: substitutes[0]?.score ?? null,
    },
    source: "substitutes_api",
  }).catch(() => {});

  return NextResponse.json({
    productId,
    category: product.category,
    substitutes,
    inStock: false,
    safetyNote:
      "Clinical equivalents are within the same product category. Always verify suitability for your specific clinical indication before substituting.",
  });
}
