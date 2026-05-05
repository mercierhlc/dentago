import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

async function getConnectedSupplierIds(request: Request): Promise<number[] | null> {
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

  const { data: rows } = await supabaseAdmin
    .from("clinic_suppliers")
    .select("supplier_id")
    .eq("clinic_id", clinic.id);

  return (rows ?? []).map((r: any) => r.supplier_id);
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
    // ── Resolve clinic's connected suppliers (if authed) ──────────────────
    const connectedSupplierIds = await getConnectedSupplierIds(request);
    // null = not logged in (show all suppliers); [] = logged in but no connections yet

    // ── Fetch products with their supplier pricing ─────────────────────────
    // NOTE: `match_status` / match_confidence live in migration
    // `20260504_sku_match_confidence.sql`. Do not reference them in PostgREST
    // selects until that DDL has been applied to the Supabase project; otherwise
    // search 500s with "column ... match_status does not exist".
    // After migration: restore approved-only filter via .or() on foreignTable.
    let productQuery = supabaseAdmin
      .from("dentago_products")
      .select(`
        id, name, brand, category, image, pack_size, description, similars,
        dentago_supplier_products!inner (
          price, stock, delivery, sku, pack_size,
          dentago_suppliers ( id, name )
        )
      `);

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
          .ilike("sku", `%${safeSku}%`);
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

    // When there are no JS-level filters (price/stock/supplier), we can paginate
    // at the DB level and avoid fetching thousands of rows.
    const needsJsFilter = inStock || supplier !== "" || minPrice > 0 || maxPrice > 0;

    let products: any[] = [];
    let fetchError = null;

    if (!needsJsFilter) {
      // Fast path: paginate at DB level, get count in same request
      let pageQuery = supabaseAdmin
        .from("dentago_products")
        .select(`
          id, name, brand, category, image, pack_size, description, similars,
          dentago_supplier_products!inner (
            price, stock, delivery, sku, pack_size,
            dentago_suppliers ( id, name )
          )
        `, { count: "exact" });

      if (category && category !== "All") {
        pageQuery = pageQuery.eq("category", category);
      }

      // Lenient per-word ILIKE on name/brand/category
      for (const w of queryWords) {
        pageQuery = pageQuery.or(
          `name.ilike.%${w}%,brand.ilike.%${w}%,category.ilike.%${w}%`
        );
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
              id, name, brand, category, image, pack_size, description, similars,
              dentago_supplier_products!inner (
                price, stock, delivery, sku, pack_size,
                dentago_suppliers ( id, name )
              )
            `)
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

      // Shape results
      let results = (products ?? []).map((p: any) => {
        const supplierRows = (p.dentago_supplier_products ?? []).map((sp: any) => ({
          name:     sp.dentago_suppliers?.name ?? "Unknown",
          id:       sp.dentago_suppliers?.id,
          price:    parseFloat(sp.price),
          stock:    sp.stock,
          delivery: sp.delivery,
          sku:      sp.sku,
          packSize: sp.pack_size ?? p.pack_size,
        })).filter((s: any) => !isNaN(s.price) && s.price > 0);

        // Always show all suppliers — mark connected ones so the UI can highlight them
        const displaySuppliers = supplierRows.map((s: any) => ({
          ...s,
          isConnected: connectedSupplierIds !== null && connectedSupplierIds.includes(s.id),
        }));

        const inStockSuppliers = displaySuppliers.filter((s: any) => s.stock);
        const bestPrice = inStockSuppliers.length ? Math.min(...inStockSuppliers.map((s: any) => s.price)) : null;
        const maxInStock = inStockSuppliers.length ? Math.max(...inStockSuppliers.map((s: any) => s.price)) : null;
        const saving = bestPrice !== null && maxInStock !== null ? parseFloat((maxInStock - bestPrice).toFixed(2)) : 0;
        const bestSupplier = inStockSuppliers.find((s: any) => s.price === bestPrice) ?? null;

        return {
          id: p.id, name: p.name, brand: p.brand, category: p.category,
          image: p.image, packSize: p.pack_size, description: p.description,
          similars: p.similars ?? [], suppliers: displaySuppliers,
          bestPrice, bestSupplier, saving,
          inStockCount: inStockSuppliers.length,
          totalSuppliers: displaySuppliers.length,
        };
      });

      // JS sort for non-DB sorts (need aggregated price data) — name and
      // category_az already came back ordered from Postgres above.
      if (sortBy !== "name" && sortBy !== "category_az") {
        if (sortBy === "saving") {
          results.sort((a: any, b: any) => b.saving - a.saving);
        } else if (sortBy === "price_asc") {
          results.sort((a: any, b: any) => (a.bestPrice ?? 9999) - (b.bestPrice ?? 9999));
        } else if (sortBy === "price_desc") {
          results.sort((a: any, b: any) => (b.bestPrice ?? 0) - (a.bestPrice ?? 0));
        } else {
          // best_price (default for query-driven searches)
          results.sort((a: any, b: any) => {
            if (a.bestPrice !== null && b.bestPrice === null) return -1;
            if (a.bestPrice === null && b.bestPrice !== null) return 1;
            return (a.bestPrice ?? 0) - (b.bestPrice ?? 0);
          });
        }
      }

      // Total = DB text-search count + any extra SKU-only matches
      const total = (dbCount ?? results.length) + skuExtraCount;

      // Log search event (non-blocking, fire-and-forget)
      if (query || category) {
        logEvent({
          event_type: 'search_performed',
          entity_type: 'clinic',
          payload: { query, category, supplier, sort: sortBy, results_count: total, page },
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
        connectedSupplierCount: connectedSupplierIds?.length ?? null,
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
            id, name, brand, category, image, pack_size, description, similars,
            dentago_supplier_products!inner (
              price, stock, delivery, sku, pack_size,
              dentago_suppliers ( id, name )
            )
          `)
          .in("id", missingIds);
        if (skuProducts) allProducts.unshift(...skuProducts);
      }
    }

    // ── Shape + filter in JS (price/stock filters need aggregated data) ────
    let results = (allProducts ?? []).map((p: any) => {
      let supplierRows = (p.dentago_supplier_products ?? []).map((sp: any) => ({
        name:     sp.dentago_suppliers?.name ?? "Unknown",
        id:       sp.dentago_suppliers?.id,
        price:    parseFloat(sp.price),
        stock:    sp.stock,
        delivery: sp.delivery,
        sku:      sp.sku,
        packSize: sp.pack_size ?? p.pack_size,
      }));

      // Always show all suppliers — mark connected ones so the UI can highlight them
      const displaySuppliers = supplierRows.map((s: any) => ({
        ...s,
        isConnected: connectedSupplierIds !== null && connectedSupplierIds.includes(s.id),
      }));

      const inStockSuppliers = displaySuppliers.filter((s: any) => s.stock);
      const bestPrice = inStockSuppliers.length
        ? Math.min(...inStockSuppliers.map((s: any) => s.price))
        : null;
      const maxInStock = inStockSuppliers.length
        ? Math.max(...inStockSuppliers.map((s: any) => s.price))
        : null;
      const saving = bestPrice !== null && maxInStock !== null
        ? parseFloat((maxInStock - bestPrice).toFixed(2))
        : 0;
      const bestSupplier = inStockSuppliers.find((s: any) => s.price === bestPrice) ?? null;

      return {
        id:          p.id,
        name:        p.name,
        brand:       p.brand,
        category:    p.category,
        image:       p.image,
        packSize:    p.pack_size,
        description: p.description,
        similars:    p.similars ?? [],
        suppliers:   displaySuppliers,
        bestPrice,
        bestSupplier,
        saving,
        inStockCount: inStockSuppliers.length,
        totalSuppliers: displaySuppliers.length,
      };
    });

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
      results = results.filter((p: any) => p.bestPrice === null || p.bestPrice >= minPrice);
    }
    if (maxPrice > 0) {
      results = results.filter((p: any) => p.bestPrice === null || p.bestPrice <= maxPrice);
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
      results.sort((a: any, b: any) => (a.bestPrice ?? 9999) - (b.bestPrice ?? 9999));
    } else if (sortBy === "price_desc") {
      results.sort((a: any, b: any) => (b.bestPrice ?? 0) - (a.bestPrice ?? 0));
    } else {
      // Default: best_price (cheapest in-stock first, then out of stock)
      results.sort((a: any, b: any) => {
        if (a.bestPrice !== null && b.bestPrice === null) return -1;
        if (a.bestPrice === null && b.bestPrice !== null) return 1;
        return (a.bestPrice ?? 0) - (b.bestPrice ?? 0);
      });
    }

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    if (query || category) {
      logEvent({
        event_type: 'search_performed',
        entity_type: 'clinic',
        payload: { query, category, supplier, sort: sortBy, results_count: total, page },
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
      connectedSupplierCount: connectedSupplierIds?.length ?? null,
    });
  } catch (err) {
    console.error("Search route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
