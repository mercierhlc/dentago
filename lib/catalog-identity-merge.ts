import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Move all dentago_supplier_products from `dropId` onto `keepId`, then delete the duplicate product.
 * When the same supplier exists on both sides, keep the cheaper row (same behaviour as dedup-merge).
 */
export async function mergeCatalogProductPair(
  sb: SupabaseClient,
  keepId: number,
  dropId: number,
): Promise<void> {
  if (keepId === dropId) throw new Error("keepId and dropId must differ");

  const { data: dropSPs, error: e1 } = await sb
    .from("dentago_supplier_products")
    .select("id, supplier_id, price")
    .eq("product_id", dropId);
  if (e1) throw e1;

  const { data: keepSPs, error: e2 } = await sb
    .from("dentago_supplier_products")
    .select("id, supplier_id, price")
    .eq("product_id", keepId);
  if (e2) throw e2;

  const keepBySup = new Map<number, { id: number; price: number }>();
  for (const r of keepSPs ?? []) {
    keepBySup.set(r.supplier_id, { id: r.id, price: Number(r.price) });
  }

  for (const sp of dropSPs ?? []) {
    const existing = keepBySup.get(sp.supplier_id);
    if (existing) {
      if (Number(sp.price) < existing.price) {
        await sb.from("dentago_supplier_products").delete().eq("id", existing.id);
        await sb.from("dentago_supplier_products").update({ product_id: keepId }).eq("id", sp.id);
        keepBySup.set(sp.supplier_id, { id: sp.id, price: Number(sp.price) });
      } else {
        await sb.from("dentago_supplier_products").delete().eq("id", sp.id);
      }
    } else {
      await sb.from("dentago_supplier_products").update({ product_id: keepId }).eq("id", sp.id);
      keepBySup.set(sp.supplier_id, { id: sp.id, price: Number(sp.price) });
    }
  }

  const { error: e3 } = await sb.from("dentago_products").delete().eq("id", dropId);
  if (e3) throw e3;
}

/** Prefer Dental Sky image, else any image, else lower id (caller passes sorted candidates). */
export function pickCanonicalProductId<T extends { id: number; image?: string | null }>(
  a: T,
  b: T,
): { keep: number; drop: number } {
  const score = (p: T) => {
    const img = (p.image ?? "").toLowerCase();
    const hasDs = img.includes("dentalsky.com") ? 2 : img.length > 20 ? 1 : 0;
    return hasDs * 1_000_000 - p.id;
  };
  if (score(a) > score(b)) return { keep: a.id, drop: b.id };
  if (score(b) > score(a)) return { keep: b.id, drop: a.id };
  return a.id <= b.id ? { keep: a.id, drop: b.id } : { keep: b.id, drop: a.id };
}
