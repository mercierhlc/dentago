import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { variationDisplayLabel } from "@/lib/product-variations";
import { logEvent } from "@/lib/events";
import { mapSupplierJoinRow } from "@/lib/map-supplier-join-row";
import { supplierPriceCompareIncVat, tradeListExVatIncVat } from "@/lib/supplier-price-compare";
import { MARKETPLACE_SUPPLIER_SET } from "@/lib/marketplace-suppliers";
import { fetchDentalSkyImage } from "@/lib/fetch-product-image";

/** Always read live catalogue prices from Postgres (no CDN / Data Cache). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getClinicContext(request: Request): Promise<{ connectedSupplierIds: number[]; credentialCount: number } | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  if (!clinic) return null;
  const [suppliersRes, credentialsRes] = await Promise.all([
    supabaseAdmin.from("clinic_suppliers").select("supplier_id").eq("clinic_id", clinic.id),
    supabaseAdmin.from("supplier_credentials").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id),
  ]);
  return {
    connectedSupplierIds: (suppliersRes.data ?? []).map((r: any) => r.supplier_id),
    credentialCount: credentialsRes.count ?? 0,
  };
}

function bestPriceFromSupplierRows(spList: unknown): number | null {
  const rows = (Array.isArray(spList) ? spList : []).map((sp: any) => ({
    name: sp.dentago_suppliers?.name ?? "Unknown",
    price: parseFloat(sp.price),
    stock: sp.stock as boolean,
  })).filter((r) => !isNaN(r.price) && MARKETPLACE_SUPPLIER_SET.has(r.name));

  const inStock = rows.filter((r) => r.stock);
  if (!inStock.length) return null;
  return Math.min(...inStock.map((r) => tradeListExVatIncVat(r.price).priceExVat));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const { data: product, error } = await supabaseAdmin
    .from("dentago_products")
    .select(`
      id, name, brand, category, image, pack_size, description, specs, similars, variations, created_at, updated_at, canonical_slug,
      dentago_supplier_products (
        price, stock, delivery, sku, pack_size, supplier_sku,
        price_per_unit_ex_vat, last_synced_at, stock_status,
        dentago_suppliers ( id, name )
      )
    `)
    .eq("id", productId)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Backfill missing image from Dental Sky
  if (!product.image?.trim()) {
    const img = await fetchDentalSkyImage(product.name);
    if (img) {
      (product as any).image = img;
      supabaseAdmin.from("dentago_products").update({ image: img }).eq("id", productId).then(() => {});
    }
  }

  // Resolve clinic's connected suppliers (if authed)
  const clinicCtx = await getClinicContext(request);
  const connectedSupplierIds = clinicCtx ? clinicCtx.connectedSupplierIds : null;

  // Shape supplier data — always return the full marketplace (same as /api/search).
  // When a clinic has linked suppliers, non-linked rows still appear so SKUs are never
  // hidden just because that practice hasn’t connected the listing supplier.
  const suppliers = (product.dentago_supplier_products ?? []).map((sp: any) =>
    mapSupplierJoinRow(sp, product.pack_size, connectedSupplierIds),
  )
    .filter((s: any) => MARKETPLACE_SUPPLIER_SET.has(s.name))
    .sort((a: any, b: any) => {
    if (a.stock && !b.stock) return -1;
    if (!a.stock && b.stock) return 1;
    return a.priceCompareIncVat - b.priceCompareIncVat;
  });

  const inStockSuppliers = suppliers.filter((s: any) => s.stock);
  const bestCompare = inStockSuppliers.length
    ? Math.min(...inStockSuppliers.map((s: any) => s.priceCompareIncVat))
    : null;
  const bestSupplierRow = bestCompare !== null
    ? inStockSuppliers.find((s: any) => Math.abs(s.priceCompareIncVat - bestCompare) < 0.001) ?? null
    : null;
  /** Best in-stock trade list price (ex-VAT). */
  const bestPrice = bestSupplierRow ? bestSupplierRow.price : null;
  const bestPriceIncVat = bestCompare;

  // Fetch similar products (lightweight)
  let similars: any[] = [];
  if (product.similars?.length) {
    const { data: simData } = await supabaseAdmin
      .from("dentago_products")
      .select(`
        id, name, brand, category, image, pack_size,
        dentago_supplier_products ( price, stock, dentago_suppliers ( name ) )
      `)
      .in("id", product.similars);

    similars = (simData ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      brand: s.brand,
      category: s.category,
      image: s.image,
      packSize: s.pack_size,
      bestPrice: bestPriceFromSupplierRows(s.dentago_supplier_products),
    }));
  }

  const rawVariations = (product as { variations?: number[] | null }).variations;
  const variationIds = Array.isArray(rawVariations)
    ? [...new Set(
      rawVariations
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x !== productId),
    )]
    : [];

  let variations: Array<{
    id: number;
    label: string;
    name: string;
    brand: string;
    category: string;
    image: string;
    packSize: string;
    bestPrice: number | null;
  }> = [];

  if (variationIds.length > 0) {
    const { data: varData } = await supabaseAdmin
      .from("dentago_products")
      .select(`
        id, name, brand, category, image, pack_size, specs,
        dentago_supplier_products (
          price, stock,
          dentago_suppliers ( id, name )
        )
      `)
      .in("id", variationIds);

    variations = (varData ?? []).map((v: any) => ({
      id: v.id as number,
      label: variationDisplayLabel({
        name: v.name,
        pack_size: v.pack_size,
        specs: v.specs,
      }),
      name: v.name as string,
      brand: v.brand as string,
      category: v.category as string,
      image: v.image as string,
      packSize: v.pack_size as string,
      bestPrice: bestPriceFromSupplierRows(v.dentago_supplier_products),
    }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }

  // Log product view (fire-and-forget)
  logEvent({
    event_type: 'product_viewed',
    entity_type: 'clinic',
    payload: {
      product_id: product.id,
      product_name: product.name,
      brand: product.brand,
      category: product.category,
      best_price: bestPriceIncVat ?? bestPrice,
      suppliers_count: suppliers.length,
    },
    source: 'products_api',
  }).catch(() => {});

  const res = NextResponse.json({
    id:          product.id,
    canonicalSlug: (product as { canonical_slug?: string | null }).canonical_slug ?? null,
    name:        product.name,
    brand:       product.brand,
    category:    product.category,
    image:       product.image,
    packSize:    product.pack_size,
    description: product.description,
    specs:       product.specs,
    suppliers,
    bestPrice,
    bestPriceIncVat,
    bestSupplier: bestSupplierRow
      ? {
          id: bestSupplierRow.id,
          name: bestSupplierRow.name,
          price: bestSupplierRow.price,
          priceCompareIncVat: bestSupplierRow.priceCompareIncVat,
          priceIncVat: bestSupplierRow.priceIncVat,
          sku: bestSupplierRow.sku,
          supplierSku: bestSupplierRow.supplierSku,
          stock: bestSupplierRow.stock,
          stockStatus: bestSupplierRow.stockStatus,
          pricePerUnitExVat: bestSupplierRow.pricePerUnitExVat,
          lastSyncedAt: bestSupplierRow.lastSyncedAt,
        }
      : null,
    variations,
    similars,
    updatedAt:   product.updated_at,
    clinicFiltered: connectedSupplierIds !== null,
    connectedSupplierCount: clinicCtx?.credentialCount ?? null,
  });
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}
