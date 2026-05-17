import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { mapSupplierJoinRow } from "@/lib/map-supplier-join-row";
import { tradeListExVatIncVat } from "@/lib/supplier-price-compare";
import { extractUnitCount, perUnitPrice, formatPerUnit } from "@/lib/pricing";
import { findEquivalents } from "@/lib/clinical-equivalents";
import { PRODUCTS } from "@/lib/products";
import { MARKETPLACE_SUPPLIER_SET, ACTIVE_SUPPLIER_IDS_PG } from "@/lib/marketplace-suppliers";
import { fetchDentalSkyImage } from "@/lib/fetch-product-image";

const STATIC_PRODUCT_IMAGES_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p.image]));
const STATIC_PRODUCT_IMAGES_BY_NAME = new Map(
  PRODUCTS.map((p) => [p.name.trim().toLowerCase(), p.image]),
);

function productImageFallback(p: { id?: number; name?: string; image?: string | null }) {
  const savedImage = typeof p.image === "string" ? p.image.trim() : "";
  if (savedImage) return savedImage;

  if (typeof p.id === "number") {
    const byId = STATIC_PRODUCT_IMAGES_BY_ID.get(p.id);
    if (byId) return byId;
  }

  const byName = p.name ? STATIC_PRODUCT_IMAGES_BY_NAME.get(p.name.trim().toLowerCase()) : null;
  return byName ?? "";
}


async function backfillMissingImages<T extends { id: number; name: string; image?: string | null }>(products: T[]): Promise<T[]> {
  const missing = products.filter((p) => !p.image?.trim()).slice(0, 30);
  if (!missing.length) return products;

  await Promise.allSettled(
    missing.map(async (product) => {
      const image = await fetchDentalSkyImage(product.name);
      if (!image) return;

      product.image = image;
      await supabaseAdmin
        .from("dentago_products")
        .update({ image })
        .eq("id", product.id);
    }),
  );

  return products;
}

function compactSearchProducts<T>(rows: (T | null)[]): T[] {
  return rows.filter((r): r is T => r != null);
}

function shapeSearchProduct(
  p: any,
  clinicCachedPrices: Map<number, Map<string, { price: number; authenticated: boolean }>>,
  connectedSupplierIds: number[] | null,
  supplierFilter?: string, // when set, only include this supplier's row
) {
  const supplierRows = (p.dentago_supplier_products ?? []).map((sp: any) =>
    mapSupplierJoinRow(sp, p.pack_size, connectedSupplierIds),
  )
    .filter((s: any) => !isNaN(s.price) && s.price > 0)
    .filter((s: any) => MARKETPLACE_SUPPLIER_SET.has(s.name))
    .filter((s: any) => !supplierFilter || s.name === supplierFilter);

  if (supplierRows.length === 0) return null;

  const productCacheMap = clinicCachedPrices.get(p.id as number);
  const unitCount = extractUnitCount(p.name as string);

  const displaySuppliers = supplierRows.map((s: any) => {
    const cached = productCacheMap?.get(s.name);
    const storedExVat = cached ? cached.price : s.price;
    const { priceExVat, priceIncVat } = tradeListExVatIncVat(storedExVat);
    const priceCompareIncVat = priceIncVat;
    const price = priceExVat;
    const per_unit_price = unitCount ? parseFloat(perUnitPrice(priceExVat, unitCount).toFixed(4)) : null;
    return {
      ...s,
      price,
      priceExVat,
      priceIncVat,
      priceCompareIncVat,
      authenticated: cached?.authenticated ?? false,
      per_unit_price,
    };
  });

  const inStockSuppliers = displaySuppliers.filter((s: any) => s.stock);
  const bestCompare = inStockSuppliers.length
    ? Math.min(...inStockSuppliers.map((s: any) => s.priceCompareIncVat))
    : null;
  const maxCompare = inStockSuppliers.length
    ? Math.max(...inStockSuppliers.map((s: any) => s.priceCompareIncVat))
    : null;
  const saving = bestCompare !== null && maxCompare !== null
    ? parseFloat((maxCompare - bestCompare).toFixed(2))
    : 0;
  const bestSupplier = bestCompare !== null
    ? inStockSuppliers.find((s: any) => Math.abs(s.priceCompareIncVat - bestCompare) < 0.001) ?? null
    : null;
  const bestPrice = bestSupplier ? bestSupplier.price : null;

  // Determine best-value supplier: lowest per_unit_price among in-stock, or lowest total price if no unit counts
  const inStockWithUnit = inStockSuppliers.filter((s: any) => s.per_unit_price !== null);
  let bestValueName: string | null = null;
  if (inStockWithUnit.length > 0) {
    const minPerUnit = Math.min(...inStockWithUnit.map((s: any) => s.per_unit_price as number));
    const bvSupplier = inStockWithUnit.find((s: any) => Math.abs((s.per_unit_price as number) - minPerUnit) < 0.0001);
    bestValueName = bvSupplier?.name ?? null;
  } else if (inStockSuppliers.length > 0) {
    bestValueName = bestSupplier?.name ?? null;
  }

  // Add is_best_value flag to each supplier and compute formatted per-unit for best value
  const suppliersWithBestValue = displaySuppliers.map((s: any) => ({
    ...s,
    is_best_value: s.name === bestValueName,
  }));

  const bestValueFormatted = bestValueName && unitCount
    ? formatPerUnit(
        (suppliersWithBestValue.find((s: any) => s.name === bestValueName)?.per_unit_price as number) ?? 0,
        p.name as string
      )
    : null;

  const syncMs = supplierRows
    .map((s: any) => {
      const t = s.lastSyncedAt ?? s.last_synced_at;
      return t ? new Date(String(t)).getTime() : NaN;
    })
    .filter((n: number) => Number.isFinite(n));
  const priceFreshness =
    syncMs.length === 0
      ? { oldestSupplierPriceSync: null as string | null, newestSupplierPriceSync: null as string | null }
      : {
          oldestSupplierPriceSync: new Date(Math.min(...syncMs)).toISOString(),
          newestSupplierPriceSync: new Date(Math.max(...syncMs)).toISOString(),
        };

  return {
    id: p.id,
    canonicalSlug: p.canonical_slug ?? null,
    name: p.name,
    brand: p.brand,
    category: p.category,
    image: productImageFallback(p),
    packSize: p.pack_size,
    description: p.description,
    similars: p.similars ?? [],
    suppliers: suppliersWithBestValue,
    bestPrice,
    bestPriceCompareIncVat: bestCompare,
    bestSupplier,
    saving,
    inStockCount: inStockSuppliers.length,
    totalSuppliers: suppliersWithBestValue.length,
    bestValueName,
    bestValueFormatted,
    /** Oldest / newest `last_synced_at` among marketplace supplier rows for this product (staleness bounds). */
    priceFreshness,
  };
}

/**
 * Fetch cached authenticated prices for a clinic for a given set of product IDs.
 * price_cache stores product_id as a string; we store integer IDs as their
 * string representation ("42") for dynamic products.
 *
 * Returns a nested Map: productId (integer) → supplierName → { price, authenticated }
 */
async function getClinicCachedPrices(
  clinicId: string,
  productIds: number[]
): Promise<Map<number, Map<string, { price: number; authenticated: boolean }>>> {
  const result = new Map<number, Map<string, { price: number; authenticated: boolean }>>();
  if (!productIds.length) return result;

  // price_cache stores IDs as strings: "42" for dynamic, "nitrile-gloves-large" for legacy
  const idStrings = productIds.map(String);
  const { data } = await supabaseAdmin
    .from("price_cache")
    .select("product_id, supplier, price, authenticated")
    .eq("clinic_id", clinicId)
    .in("product_id", idStrings);

  if (!data?.length) return result;

  for (const row of data) {
    const productId = parseInt(row.product_id as string);
    if (isNaN(productId)) continue;
    if (!result.has(productId)) result.set(productId, new Map());
    result.get(productId)!.set(row.supplier as string, {
      price: row.price as number,
      authenticated: row.authenticated as boolean,
    });
  }

  return result;
}

/**
 * Background: scrape authenticated prices for products that have a connected
 * supplier but no cached price yet, then write to price_cache.
 * Fire-and-forget — never awaited.
 */
function backgroundScrapeProducts(
  clinicId: string,
  products: Array<{ id: number; name: string; supplierNames: string[] }>,
  credentials: Array<{ supplierName: string; username: string; password: string }>
) {
  (async () => {
    const { fetchAuthenticatedPrices } = await import("@/lib/scrapers");
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    for (const product of products) {
      try {
        const scraped = await fetchAuthenticatedPrices(
          credentials.filter(c => product.supplierNames.includes(c.supplierName)),
          product.name
        );
        if (!scraped.size) continue;

        const rows = [...scraped.entries()].map(([supplier, price]) => ({
          clinic_id: clinicId,
          product_id: String(product.id),
          supplier,
          price,
          stock: true,
          authenticated: true,
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt,
        }));

        await supabaseAdmin
          .from("price_cache")
          .upsert(rows, { onConflict: "clinic_id,product_id,supplier" });
      } catch {
        // continue on per-product errors
      }
    }
  })().catch(() => {});
}

async function getClinicContext(request: Request): Promise<{ clinicId: string; connectedSupplierIds: number[]; credentialCount: number } | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!clinic) return null;

  // Run both queries in parallel
  const [suppliersRes, credentialsRes] = await Promise.all([
    supabaseAdmin.from("clinic_suppliers").select("supplier_id").eq("clinic_id", clinic.id),
    supabaseAdmin.from("supplier_credentials").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id),
  ]);

  return {
    clinicId: clinic.id as string,
    connectedSupplierIds: (suppliersRes.data ?? []).map((r: any) => r.supplier_id),
    credentialCount: credentialsRes.count ?? 0,
  };
}

// Backwards-compat wrapper — returns just the supplier IDs list
async function getConnectedSupplierIds(request: Request): Promise<number[] | null> {
  const ctx = await getClinicContext(request);
  return ctx ? ctx.connectedSupplierIds : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query      = searchParams.get("q")?.trim() ?? "";
  const category   = searchParams.get("category") ?? "";
  const supplier   = searchParams.get("supplier") ?? "";
  const inStock    = searchParams.get("inStock") === "true";
  const minPrice   = parseFloat(searchParams.get("minPrice") ?? "0") || 0;
  const maxPrice   = parseFloat(searchParams.get("maxPrice") ?? "0") || 0;
  // Sort options: category_az (default browse), best_price, saving, name, price_asc, price_desc
  const sortBy     = searchParams.get("sort") ?? "category_az";
  const page       = parseInt(searchParams.get("page") ?? "1") || 1;
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "30") || 30, 100);
  const offset     = (page - 1) * limit;

  // ── Build a lenient word list for substring matching ─────────────────────
  // Each word must match somewhere in name+brand+category, but doesn't have
  // to be a whole word — handles plurals, partial brand names, missing words.
  // PostgREST .or() values can't contain commas/parens unless escaped, so we
  // strip those + a few risky chars before interpolating.
  function toIlikeTerm(w: string) {
    return w.replace(/[%_,()\\]/g, "").trim();
  }
  const queryWords = query
    .split(/\s+/)
    .map(toIlikeTerm)
    .filter(w => w.length >= 2)
    .slice(0, 6); // cap to keep query plan sane

  try {
    // ── Resolve clinic context (supplier connections + cached prices) ──────
    const clinicCtx = await getClinicContext(request);
    const connectedSupplierIds = clinicCtx ? clinicCtx.connectedSupplierIds : null;
    // null = not logged in (show all suppliers); [] = logged in but no connections yet

    // Load clinic credentials for background scraping (only when logged in with connections)
    let clinicCredentials: Array<{ supplierName: string; username: string; password: string }> = [];
    if (clinicCtx?.clinicId && connectedSupplierIds?.length) {
      try {
        const { decrypt } = await import("@/lib/crypto");
        const { data: creds } = await supabaseAdmin
          .from("supplier_credentials")
          .select("username, encrypted_password, suppliers(name)")
          .eq("clinic_id", clinicCtx.clinicId);
        clinicCredentials = (creds ?? []).flatMap((c: any) => {
          const sup = Array.isArray(c.suppliers) ? c.suppliers[0] : c.suppliers;
          if (!sup?.name || !c.username || !c.encrypted_password) return [];
          try { return [{ supplierName: sup.name, username: c.username, password: decrypt(c.encrypted_password) }]; }
          catch { return []; }
        });
      } catch { /* non-fatal */ }
    }

    // Cached prices will be fetched after we know which products are in the results
    // (placeholder — populated below after first fetch)
    let clinicCachedPrices = new Map<number, Map<string, { price: number; authenticated: boolean }>>();

    // ── Resolve supplier filter to an integer ID for DB-level filtering ───────
    let supplierIntId: number | null = null;
    if (supplier) {
      const { data: dsRow } = await supabaseAdmin
        .from("dentago_suppliers").select("id").eq("name", supplier).maybeSingle();
      supplierIntId = dsRow?.id ?? null;
    }

    // Build the supplier_id filter string: single supplier or full active set
    const supplierIdFilter = supplierIntId != null
      ? `(${supplierIntId})`
      : ACTIVE_SUPPLIER_IDS_PG;

    // ── Fetch products with their supplier pricing ─────────────────────────
    let productQuery = supabaseAdmin
      .from("dentago_products")
      .select(`
        id, name, brand, category, image, pack_size, description, similars, canonical_slug,
        dentago_supplier_products!inner (
          price, stock, delivery, sku, pack_size, supplier_sku,
          price_per_unit_ex_vat, last_synced_at, stock_status,
          dentago_suppliers ( id, name )
        )
      `)
      .filter("dentago_supplier_products.supplier_id", "in", supplierIdFilter);

    // Category filter
    if (category && category !== "All") {
      productQuery = productQuery.eq("category", category);
    }

    // ── SKU lookup — run in parallel with text search ────────────────────────
    // SKUs live in dentago_supplier_products, not in the product search_vector.
    // Any query could be a SKU (e.g. "SEPT-4100-10"), so always check both.
    let skuProductIds: number[] = [];
    if (query) {
      const safeSku = toIlikeTerm(query);
      if (safeSku) {
        const { data: skuRows } = await supabaseAdmin
          .from("dentago_supplier_products")
          .select("product_id")
          .or(`sku.ilike.%${safeSku}%,supplier_sku.ilike.%${safeSku}%`);
        skuProductIds = [...new Set((skuRows ?? []).map((r: any) => r.product_id))];
      }
    }

    // ── Lenient text matching ────────────────────────────────────────────────
    // For each word in the query, require it to appear (substring, case-
    // insensitive) in the product name OR brand OR category. Multiple words
    // chain as AND. This matches plurals, partial brand names, mid-word hits
    // — far more forgiving than the tsvector exact-prefix approach.
    for (const w of queryWords) {
      productQuery = productQuery.or(
        `name.ilike.%${w}%,brand.ilike.%${w}%,category.ilike.%${w}%`
      );
    }

    // Always use the fast DB-paginated path. inStock is filtered at the DB level;
    // price range is applied in JS after shaping the returned page (count may not
    // reflect price filter but avoids the 10s Vercel timeout from fetching all 22k rows).
    const needsJsFilter = false;

    let products: any[] = [];
    let fetchError = null;

    if (!needsJsFilter) {
      // Fast path: paginate at DB level, get count in same request
      let pageQuery = supabaseAdmin
        .from("dentago_products")
        .select(`
          id, name, brand, category, image, pack_size, description, similars, canonical_slug,
          dentago_supplier_products!inner (
            price, stock, delivery, sku, pack_size, supplier_sku,
            price_per_unit_ex_vat, last_synced_at, stock_status,
            dentago_suppliers ( id, name )
          )
        `, { count: "exact" })
        .filter("dentago_supplier_products.supplier_id", "in", supplierIdFilter);

      if (category && category !== "All") {
        pageQuery = pageQuery.eq("category", category);
      }

      // Lenient per-word ILIKE on name/brand/category
      for (const w of queryWords) {
        pageQuery = pageQuery.or(
          `name.ilike.%${w}%,brand.ilike.%${w}%,category.ilike.%${w}%`
        );
      }

      // DB-level stock filter — eliminates the slow-path entirely for inStock
      if (inStock) {
        pageQuery = pageQuery.filter("dentago_supplier_products.stock", "eq", "true");
      }

      // DB-level sorts that don't need aggregated price data
      if (sortBy === "name") {
        pageQuery = pageQuery.order("name");
      } else if (sortBy === "category_az") {
        pageQuery = pageQuery.order("category").order("name");
      }

      // Fetch text-search results page
      const { data: pageData, count: dbCount, error: pageErr } = await pageQuery.range(offset, offset + limit - 1);
      if (pageErr) fetchError = pageErr;
      else products = pageData ?? [];

      // Fetch any SKU-matched products not already in the text results
      let skuExtraCount = 0;
      if (skuProductIds.length > 0) {
        const existingIds = new Set((products ?? []).map((p: any) => p.id));
        const missingIds = skuProductIds.filter(id => !existingIds.has(id));
        if (missingIds.length > 0) {
          const { data: skuProducts } = await supabaseAdmin
            .from("dentago_products")
            .select(`
              id, name, brand, category, image, pack_size, description, similars, canonical_slug,
              dentago_supplier_products!inner (
                price, stock, delivery, sku, pack_size, supplier_sku,
                price_per_unit_ex_vat, last_synced_at, stock_status,
                dentago_suppliers ( id, name )
              )
            `)
            .filter("dentago_supplier_products.supplier_id", "in", supplierIdFilter)
            .in("id", missingIds);
          if (skuProducts) {
            products = [...(skuProducts), ...(products ?? [])];
            skuExtraCount = skuProducts.length;
          }
        }
      }

      if (fetchError) {
        console.error("Search error:", fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      // Fetch authenticated cached prices for the products we got back
      if (clinicCtx?.clinicId && products.length) {
        const productIds = (products ?? []).map((p: any) => p.id as number);
        clinicCachedPrices = await getClinicCachedPrices(clinicCtx.clinicId, productIds).catch(() => new Map());

        // Queue background scrapes for any product+supplier pair with no cache entry
        if (clinicCredentials.length) {
          const connectedSupplierNames = clinicCredentials.map(c => c.supplierName);
          const toScrape = (products ?? []).flatMap((p: any) => {
            const supplierNames = (p.dentago_supplier_products ?? [])
              .map((sp: any) => sp.dentago_suppliers?.name as string)
              .filter((name: string) => name && connectedSupplierNames.includes(name));
            const cached = clinicCachedPrices.get(p.id as number);
            const missing = supplierNames.filter((name: string) => !cached?.has(name));
            return missing.length ? [{ id: p.id as number, name: p.name as string, supplierNames: missing }] : [];
          });
          if (toScrape.length > 0) {
            backgroundScrapeProducts(clinicCtx.clinicId, toScrape, clinicCredentials);
          }
        }
      }

      let results = compactSearchProducts(
        (products ?? []).map((p: any) => shapeSearchProduct(p, clinicCachedPrices, connectedSupplierIds, supplier || undefined)),
      );

      // JS sort for non-DB sorts (need aggregated price data) — name and
      // category_az already came back ordered from Postgres above.
      if (sortBy !== "name" && sortBy !== "category_az") {
        if (sortBy === "saving") {
          results.sort((a: any, b: any) => b.saving - a.saving);
        } else if (sortBy === "price_asc") {
          results.sort((a: any, b: any) => (a.bestPriceCompareIncVat ?? 9999) - (b.bestPriceCompareIncVat ?? 9999));
        } else if (sortBy === "price_desc") {
          results.sort((a: any, b: any) => (b.bestPriceCompareIncVat ?? 0) - (a.bestPriceCompareIncVat ?? 0));
        } else {
          // best_price (default for query-driven searches)
          results.sort((a: any, b: any) => {
            if (a.bestPriceCompareIncVat !== null && b.bestPriceCompareIncVat === null) return -1;
            if (a.bestPriceCompareIncVat === null && b.bestPriceCompareIncVat !== null) return 1;
            return (a.bestPriceCompareIncVat ?? 0) - (b.bestPriceCompareIncVat ?? 0);
          });
        }
      }

      // Price range filter — applied in JS after shaping (avoids full-scan slow path)
      if (minPrice > 0) {
        results = results.filter((p: any) =>
          p.bestPriceCompareIncVat === null || p.bestPriceCompareIncVat >= minPrice,
        );
      }
      if (maxPrice > 0) {
        results = results.filter((p: any) =>
          p.bestPriceCompareIncVat === null || p.bestPriceCompareIncVat <= maxPrice,
        );
      }

      // Total = DB text-search count + any extra SKU-only matches
      const total = (dbCount ?? results.length) + skuExtraCount;
      // Fire image backfill in background — don't block the search response
      backfillMissingImages(results).catch(() => {});

      // Clinical equivalent substitution lookup
      const equivalentMatch = query ? findEquivalents(query) : null;
      const equivalents = equivalentMatch
        ? {
            found: true,
            equivalence_note: equivalentMatch.equivalence_note,
            confidence: equivalentMatch.confidence,
            category: equivalentMatch.category,
            equivalent_terms: equivalentMatch.equivalents,
          }
        : null;

      // Log search event (non-blocking, fire-and-forget)
      if (query || category) {
        logEvent({
          event_type: 'search_performed',
          entity_type: 'clinic',
          payload: { query, category, supplier, sort: sortBy, results_count: total, page },
          source: 'search_api',
        }).catch(() => {});
      }

      // Log substitute lookup event when equivalents are found
      if (equivalentMatch) {
        logEvent({
          event_type: 'substitute_lookup',
          entity_type: 'clinic',
          payload: { query, category: equivalentMatch.category, confidence: equivalentMatch.confidence, equivalent_terms: equivalentMatch.equivalents },
          source: 'search_api',
        }).catch(() => {});
      }

      return NextResponse.json({
        products: results,
        total,
        page,
        limit,
        pages: Math.ceil((total as number) / limit),
        query,
        filters: { category, supplier, inStock, minPrice, maxPrice, sortBy },
        clinicFiltered: connectedSupplierIds !== null,
        connectedSupplierCount: clinicCtx?.credentialCount ?? null,
        equivalents,
      });
    }

    // Slow path: JS filters need full result set — fetch all matching products
    const allProducts: any[] = [];
    const BATCH = 1000;
    let batchOffset = 0;
    while (true) {
      const { data: batch, error: batchErr } = await productQuery.range(batchOffset, batchOffset + BATCH - 1);
      if (batchErr) { fetchError = batchErr; break; }
      if (!batch || batch.length === 0) break;
      allProducts.push(...batch);
      if (batch.length < BATCH) break;
      batchOffset += BATCH;
    }

    if (fetchError) {
      console.error("Search error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Merge in SKU-matched products not already in text results
    if (skuProductIds.length > 0) {
      const existingIds = new Set(allProducts.map((p: any) => p.id));
      const missingIds = skuProductIds.filter(id => !existingIds.has(id));
      if (missingIds.length > 0) {
        const { data: skuProducts } = await supabaseAdmin
          .from("dentago_products")
          .select(`
            id, name, brand, category, image, pack_size, description, similars, canonical_slug,
            dentago_supplier_products!inner (
              price, stock, delivery, sku, pack_size, supplier_sku,
              price_per_unit_ex_vat, last_synced_at, stock_status,
              dentago_suppliers ( id, name )
            )
          `)
          .filter("dentago_supplier_products.supplier_id", "in", ACTIVE_SUPPLIER_IDS_PG)
          .in("id", missingIds);
        if (skuProducts) allProducts.unshift(...skuProducts);
      }
    }

    // Fetch authenticated cached prices for all slow-path products
    if (clinicCtx?.clinicId && allProducts.length) {
      const productIds = allProducts.map((p: any) => p.id as number);
      clinicCachedPrices = await getClinicCachedPrices(clinicCtx.clinicId, productIds).catch(() => new Map());

      if (clinicCredentials.length) {
        const connectedSupplierNames = clinicCredentials.map(c => c.supplierName);
        const toScrape = allProducts.flatMap((p: any) => {
          const supplierNames = (p.dentago_supplier_products ?? [])
            .map((sp: any) => sp.dentago_suppliers?.name as string)
            .filter((name: string) => name && connectedSupplierNames.includes(name));
          const cached = clinicCachedPrices.get(p.id as number);
          const missing = supplierNames.filter((name: string) => !cached?.has(name));
          return missing.length ? [{ id: p.id as number, name: p.name as string, supplierNames: missing }] : [];
        });
        if (toScrape.length > 0) {
          backgroundScrapeProducts(clinicCtx.clinicId, toScrape, clinicCredentials);
        }
      }
    }

    // ── Shape + filter in JS (price/stock filters need aggregated data) ────
    let results = compactSearchProducts(
      (allProducts ?? []).map((p: any) => shapeSearchProduct(p, clinicCachedPrices, connectedSupplierIds)),
    );

    // Filter: in-stock only
    if (inStock) {
      results = results.filter((p: any) => p.inStockCount > 0);
    }

    // Filter: supplier
    if (supplier) {
      results = results.filter((p: any) =>
        p.suppliers.some((s: any) => s.name === supplier)
      );
    }

    // Filter: price range (based on best price)
    if (minPrice > 0) {
      results = results.filter((p: any) =>
        p.bestPriceCompareIncVat === null || p.bestPriceCompareIncVat >= minPrice,
      );
    }
    if (maxPrice > 0) {
      results = results.filter((p: any) =>
        p.bestPriceCompareIncVat === null || p.bestPriceCompareIncVat <= maxPrice,
      );
    }

    // Sort
    if (sortBy === "name") {
      results.sort((a: any, b: any) => a.name.localeCompare(b.name));
    } else if (sortBy === "category_az") {
      results.sort((a: any, b: any) => {
        const c = (a.category ?? "").localeCompare(b.category ?? "");
        return c !== 0 ? c : a.name.localeCompare(b.name);
      });
    } else if (sortBy === "saving") {
      results.sort((a: any, b: any) => b.saving - a.saving);
    } else if (sortBy === "price_asc") {
      results.sort((a: any, b: any) => (a.bestPriceCompareIncVat ?? 9999) - (b.bestPriceCompareIncVat ?? 9999));
    } else if (sortBy === "price_desc") {
      results.sort((a: any, b: any) => (b.bestPriceCompareIncVat ?? 0) - (a.bestPriceCompareIncVat ?? 0));
    } else {
      // Default: best_price (cheapest in-stock first, then out of stock)
      results.sort((a: any, b: any) => {
        if (a.bestPriceCompareIncVat !== null && b.bestPriceCompareIncVat === null) return -1;
        if (a.bestPriceCompareIncVat === null && b.bestPriceCompareIncVat !== null) return 1;
        return (a.bestPriceCompareIncVat ?? 0) - (b.bestPriceCompareIncVat ?? 0);
      });
    }

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);
    backfillMissingImages(paginated).catch(() => {});

    // Clinical equivalent substitution lookup (slow path)
    const equivalentMatchSlow = query ? findEquivalents(query) : null;
    const equivalentsSlow = equivalentMatchSlow
      ? {
          found: true,
          equivalence_note: equivalentMatchSlow.equivalence_note,
          confidence: equivalentMatchSlow.confidence,
          category: equivalentMatchSlow.category,
          equivalent_terms: equivalentMatchSlow.equivalents,
        }
      : null;

    if (query || category) {
      logEvent({
        event_type: 'search_performed',
        entity_type: 'clinic',
        payload: { query, category, supplier, sort: sortBy, results_count: total, page },
        source: 'search_api',
      }).catch(() => {});
    }

    // Log substitute lookup event when equivalents are found (slow path)
    if (equivalentMatchSlow) {
      logEvent({
        event_type: 'substitute_lookup',
        entity_type: 'clinic',
        payload: { query, category: equivalentMatchSlow.category, confidence: equivalentMatchSlow.confidence, equivalent_terms: equivalentMatchSlow.equivalents },
        source: 'search_api',
      }).catch(() => {});
    }

    return NextResponse.json({
      products: paginated,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      query,
      filters: { category, supplier, inStock, minPrice, maxPrice, sortBy },
      clinicFiltered: connectedSupplierIds !== null,
      connectedSupplierCount: clinicCtx?.credentialCount ?? null,
      equivalents: equivalentsSlow,
    });
  } catch (err) {
    console.error("Search route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
