import type { SupabaseClient } from "@supabase/supabase-js";
import { normaliseUkColourSpellingInProductText } from "@/lib/catalog-text-normalise";

export type SupplierProductRow = {
  id: number;
  product_id: number;
  supplier_id: number;
  sku: string | null;
  price: number | null;
};

export type ProductMeta = {
  id: number;
  image: string | null;
  name: string;
  supplier_row_count: number;
};

export function normaliseSkuKey(sku: string | null | undefined): string | null {
  if (sku == null) return null;
  const t = sku.trim();
  if (!t) return null;
  return t.toUpperCase();
}

function imageScore(image: string | null | undefined): number {
  const img = (image ?? "").toLowerCase();
  if (img.includes("dentalsky.com")) return 3;
  if (img.length > 24) return 2;
  if (img.length > 0) return 1;
  return 0;
}

/** Pick canonical dentago_products id: more supplier rows, then image, then lower id. */
export function pickCanonicalProductAmongMetas(metas: ProductMeta[]): number {
  if (metas.length === 1) return metas[0].id;
  const sorted = [...metas].sort((a, b) => {
    const sa = a.supplier_row_count * 1_000_000 + imageScore(a.image) * 10_000 - a.id * 0.0001;
    const sb = b.supplier_row_count * 1_000_000 + imageScore(b.image) * 10_000 - b.id * 0.0001;
    return sb - sa;
  });
  return sorted[0].id;
}

function priceNum(r: SupplierProductRow): number {
  const p = r.price;
  if (p == null || Number.isNaN(Number(p))) return Number.POSITIVE_INFINITY;
  return Number(p);
}

/**
 * Rows share supplier_id + same normalised SKU (usually different product_id).
 * Consolidates to one row on the best canonical product with minimum price in the group.
 */
export async function consolidateDuplicateSkuRowsForSupplier(
  sb: SupabaseClient,
  rows: SupplierProductRow[],
  productMetaById: Map<number, ProductMeta>,
): Promise<{ deleted: number; updated: number; skipped: boolean }> {
  if (rows.length < 2) return { deleted: 0, updated: 0, skipped: false };

  const supplierId = rows[0].supplier_id;
  const skuNorm = normaliseSkuKey(rows[0].sku);
  if (!skuNorm) return { deleted: 0, updated: 0, skipped: true };

  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const metas = productIds.map((id) => productMetaById.get(id));
  if (metas.some((m) => !m)) return { deleted: 0, updated: 0, skipped: true };

  const keepPid = pickCanonicalProductAmongMetas(metas as ProductMeta[]);
  const minPrice = Math.min(...rows.map(priceNum));

  const onKeep = rows.filter((r) => r.product_id === keepPid);
  const survivor: SupplierProductRow =
    onKeep.length > 0
      ? [...onKeep].sort((a, b) => priceNum(a) - priceNum(b))[0]
      : [...rows].sort((a, b) => priceNum(a) - priceNum(b))[0];

  let deleted = 0;
  let updated = 0;
  let survivorId = survivor.id;
  const alreadyRemoved = new Set<number>();

  const { data: clashRows, error: clashErr } = await sb
    .from("dentago_supplier_products")
    .select("id, sku, price")
    .eq("product_id", keepPid)
    .eq("supplier_id", supplierId)
    .limit(1);
  if (clashErr) throw clashErr;
  const clash = clashRows?.[0] ?? null;

  if (survivor.product_id !== keepPid) {
    if (clash && clash.id !== survivor.id) {
      const clashSku = normaliseSkuKey(clash.sku as string | null);
      if (clashSku !== skuNorm) return { deleted: 0, updated: 0, skipped: true };

      const clashPrice = Number((clash as { price?: number }).price ?? 1e15);
      const survPrice = priceNum(survivor);
      const bestPrice = Math.min(clashPrice, survPrice);

      if (survPrice <= clashPrice) {
        await sb.from("dentago_supplier_products").update({ price: bestPrice }).eq("id", survivor.id);
        const clashId = (clash as { id: number }).id;
        await sb.from("dentago_supplier_products").delete().eq("id", clashId);
        alreadyRemoved.add(clashId);
        deleted++;
        const { error: mvErr } = await sb
          .from("dentago_supplier_products")
          .update({ product_id: keepPid, price: bestPrice })
          .eq("id", survivor.id);
        if (mvErr) return { deleted: 0, updated: 0, skipped: true };
        updated++;
        survivorId = survivor.id;
      } else {
        await sb.from("dentago_supplier_products").update({ price: bestPrice }).eq("id", (clash as { id: number }).id);
        await sb.from("dentago_supplier_products").delete().eq("id", survivor.id);
        alreadyRemoved.add(survivor.id);
        deleted++;
        survivorId = (clash as { id: number }).id;
      }
    } else if (!clash) {
      const { error: upErr } = await sb.from("dentago_supplier_products").update({ product_id: keepPid }).eq("id", survivor.id);
      if (upErr) return { deleted: 0, updated: 0, skipped: true };
      updated++;
      survivorId = survivor.id;
    }
  }

  const { error: priceErr } = await sb.from("dentago_supplier_products").update({ price: minPrice }).eq("id", survivorId);
  if (priceErr) throw priceErr;
  updated++;

  for (const r of rows) {
    if (r.id === survivorId || alreadyRemoved.has(r.id)) continue;
    const { error: dErr } = await sb.from("dentago_supplier_products").delete().eq("id", r.id);
    if (dErr) throw dErr;
    deleted++;
  }

  const { data: leftovers } = await sb
    .from("dentago_supplier_products")
    .select("id, sku, price")
    .eq("product_id", keepPid)
    .eq("supplier_id", supplierId);

  const sameSkuRows = (leftovers ?? []).filter((x) => normaliseSkuKey(x.sku as string | null) === skuNorm);
  if (sameSkuRows.length > 1) {
    const sorted = [...sameSkuRows].sort(
      (a, b) => Number((a as { price?: number }).price ?? 1e15) - Number((b as { price?: number }).price ?? 1e15),
    );
    const keep = sorted[0] as { id: number; price?: number };
    for (const x of sorted.slice(1)) {
      const xi = x as { id: number; price?: number };
      const bp = Math.min(Number(keep.price ?? 1e15), Number(xi.price ?? 1e15));
      await sb.from("dentago_supplier_products").update({ price: bp }).eq("id", keep.id);
      await sb.from("dentago_supplier_products").delete().eq("id", xi.id);
      deleted++;
    }
  }

  return { deleted, updated, skipped: false };
}

export async function deleteSupplierRowsWithEmptySku(sb: SupabaseClient, dryRun: boolean): Promise<number> {
  const { data, error } = await sb.from("dentago_supplier_products").select("id, sku");
  if (error) throw error;
  const targets = (data ?? []).filter((r) => r.sku == null || String(r.sku).trim() === "");
  if (dryRun) return targets.length;
  let n = 0;
  for (const part of chunk(
    targets.map((t) => t.id as number),
    200,
  )) {
    const { error: dErr } = await sb.from("dentago_supplier_products").delete().in("id", part);
    if (dErr) throw dErr;
    n += part.length;
  }
  return n;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function applyUkColourSpellingToProductNames(sb: SupabaseClient, dryRun: boolean): Promise<number> {
  const { data, error } = await sb.from("dentago_products").select("id, name");
  if (error) throw error;
  let n = 0;
  for (const p of data ?? []) {
    const name = (p.name as string) ?? "";
    const nn = normaliseUkColourSpellingInProductText(name);
    if (nn === name) continue;
    n++;
    if (!dryRun) {
      const { error: uErr } = await sb.from("dentago_products").update({ name: nn }).eq("id", p.id);
      if (uErr) throw uErr;
    }
  }
  return n;
}

export async function deleteProductsWithNoSupplierRows(sb: SupabaseClient, dryRun: boolean): Promise<number> {
  const { data: sps, error } = await sb.from("dentago_supplier_products").select("product_id");
  if (error) throw error;
  const has = new Set((sps ?? []).map((r) => r.product_id as number));
  const { data: products, error: pErr } = await sb.from("dentago_products").select("id");
  if (pErr) throw pErr;
  const orphans = (products ?? []).map((p) => p.id as number).filter((id) => !has.has(id));
  if (dryRun) return orphans.length;
  let n = 0;
  for (const id of orphans) {
    const { error: dErr } = await sb.from("dentago_products").delete().eq("id", id);
    if (dErr) throw dErr;
    n++;
  }
  return n;
}
