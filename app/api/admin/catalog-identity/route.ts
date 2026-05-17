import { NextRequest, NextResponse } from "next/server";
import { getAdminIdentifier, requireAdminOrOsAuth } from "@/lib/admin-auth";
import { logEvent } from "@/lib/events";
import { mergeCatalogProductPair, pickCanonicalProductId } from "@/lib/catalog-identity-merge";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SuggestionRow = {
  id: string;
  product_id_lo: number;
  product_id_hi: number;
  brand_key: string;
  name_similarity: number;
  confidence_tier: string;
  distinguishing_conflict: boolean;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
};

/** GET ?status=pending_review|rejected|merged */
export async function GET(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  const status = request.nextUrl.searchParams.get("status") ?? "pending_review";
  if (!["pending_review", "rejected", "merged"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("catalog_identity_suggestions")
    .select("*")
    .eq("status", status)
    .gte("name_similarity", 0.90)
    .order("name_similarity", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []) as SuggestionRow[] });
}

/**
 * POST JSON:
 *  { "action": "reject", "suggestionId": "uuid" }
 *  { "action": "merge", "suggestionId": "uuid", "keepProductId"?: number }
 * keepProductId must be product_id_lo or product_id_hi when provided; otherwise canonical is auto-picked.
 */
export async function POST(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  let body: { action?: string; suggestionId?: string; keepProductId?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, suggestionId, keepProductId } = body;
  if (!suggestionId || (action !== "merge" && action !== "reject")) {
    return NextResponse.json({ error: "suggestionId and action (merge|reject) required" }, { status: 400 });
  }

  const { data: sug, error: fe } = await (supabaseAdmin as any)
    .from("catalog_identity_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .maybeSingle() as { data: { status: string; product_id_lo: number; product_id_hi: number } | null; error: any };

  if (fe) return NextResponse.json({ error: fe.message }, { status: 500 });
  if (!sug) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  if (sug.status !== "pending_review") {
    return NextResponse.json({ error: "Suggestion is not pending_review" }, { status: 400 });
  }

  const lo = sug.product_id_lo as number;
  const hi = sug.product_id_hi as number;
  const reviewer = getAdminIdentifier(request);
  const now = new Date().toISOString();

  if (action === "reject") {
    const { error: ue } = await supabaseAdmin
      .from("catalog_identity_suggestions")
      .update({
        status: "rejected",
        reviewed_at: now,
        reviewed_by: reviewer,
      })
      .eq("id", suggestionId);

    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });

    await logEvent({
      event_type: "catalog_identity_rejected",
      entity_type: "catalog_identity_suggestion",
      entity_id: suggestionId,
      payload: { product_id_lo: lo, product_id_hi: hi },
      source: "catalog_identity_api",
    });

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const { data: rows, error: pe } = await supabaseAdmin
    .from("dentago_products")
    .select("id, image")
    .in("id", [lo, hi]);

  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
  const pa = rows?.find((r) => r.id === lo);
  const pb = rows?.find((r) => r.id === hi);
  if (!pa || !pb) return NextResponse.json({ error: "Products missing" }, { status: 400 });

  let keep: number;
  let drop: number;
  if (keepProductId != null) {
    if (keepProductId !== lo && keepProductId !== hi) {
      return NextResponse.json({ error: "keepProductId must be one of the pair ids" }, { status: 400 });
    }
    keep = keepProductId;
    drop = keep === lo ? hi : lo;
  } else {
    const picked = pickCanonicalProductId(
      { id: pa.id as number, image: pa.image as string | null },
      { id: pb.id as number, image: pb.image as string | null },
    );
    keep = picked.keep;
    drop = picked.drop;
  }

  try {
    await mergeCatalogProductPair(supabaseAdmin, keep, drop);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await logEvent({
    event_type: "catalog_identity_merged",
    entity_type: "dentago_products",
    entity_id: String(keep),
    payload: {
      dropped_product_id: drop,
      suggestion_id: suggestionId,
      product_id_lo: lo,
      product_id_hi: hi,
    },
    source: "catalog_identity_api",
  });

  return NextResponse.json({ ok: true, status: "merged", keepProductId: keep, droppedProductId: drop });
}
