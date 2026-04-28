import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
  const sortBy     = searchParams.get("sort") ?? "best_price"; // best_price | name | saving
  const page       = parseInt(searchParams.get("page") ?? "1") || 1;
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "30") || 30, 100);
  const offset     = (page - 1) * limit;

  try {
    // ── Resolve clinic's connected suppliers (if authed) ──────────────────
    const connectedSupplierIds = await getConnectedSupplierIds(request);
    // null = not logged in (show all suppliers); [] = logged in but no connections yet

    // ── Fetch products with their supplier pricing ─────────────────────────
    let productQuery = supabaseAdmin
      .from("dentago_products")
      .select(`
        id, name, brand, category, image, pack_size, description, similars,
        dentago_supplier_products (
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
      const { data: skuRows } = await supabaseAdmin
        .from("dentago_supplier_products")
        .select("product_id")
        .ilike("sku", `%${query}%`);
      skuProductIds = [...new Set((skuRows ?? []).map((r: any) => r.product_id))];
    }

    // Full-text search using the GIN index on search_vector
    if (query) {
      const tsQuery = query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ""))
        .filter(Boolean)
        .map(w => `${w}:*`)
        .join(" & ");

      if (tsQuery) {
        productQuery = productQuery.textSearch("search_vector", tsQuery, {
          config: "english",
        });
      }
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
          dentago_supplier_products (
            price, stock, delivery, sku, pack_size,
            dentago_suppliers ( id, name )
          )
        `, { count: "exact" });

      if (category && category !== "All") {
        pageQuery = pageQuery.eq("category", category);
      }

      if (query) {
        const tsQuery = query
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(w => w.replace(/[^a-zA-Z0-9]/g, ""))
          .filter(Boolean)
          .map(w => `${w}:*`)
          .join(" & ");
        if (tsQuery) {
          pageQuery = pageQuery.textSearch("search_vector", tsQuery, { config: "english" });
        }
      }

      if (sortBy === "name") {
        pageQuery = pageQuery.order("name");
      }

      // Fetch text-search results page
      const { data: pageData, count: dbCount, error: pageErr } = await pageQuery.range(offset, offset + limit - 1);
      if (pageErr) fetchError = pageErr;
      else products = pageData ?? [];

      // Fetch any SKU-matched products not already in the text results
      if (skuProductIds.length > 0) {
        const existingIds = new Set((products ?? []).map((p: any) => p.id));
        const missingIds = skuProductIds.filter(id => !existingIds.has(id));
        if (missingIds.length > 0) {
          const { data: skuProducts } = await supabaseAdmin
            .from("dentago_products")
            .select(`
              id, name, brand, category, image, pack_size, description, similars,
              dentago_supplier_products (
                price, stock, delivery, sku, pack_size,
                dentago_suppliers ( id, name )
              )
            `)
            .in("id", missingIds);
          if (skuProducts) products = [...(skuProducts), ...(products ?? [])];
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
        })).filter((s: any) => !isNaN(s.price));

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
      }).filter((p: any) => p.totalSuppliers > 0);

      // JS sort for non-name sorts (need aggregated price data)
      if (sortBy !== "name") {
        if (sortBy === "saving") {
          results.sort((a: any, b: any) => b.saving - a.saving);
        } else if (sortBy === "price_asc") {
          results.sort((a: any, b: any) => (a.bestPrice ?? 9999) - (b.bestPrice ?? 9999));
        } else if (sortBy === "price_desc") {
          results.sort((a: any, b: any) => (b.bestPrice ?? 0) - (a.bestPrice ?? 0));
        } else {
          results.sort((a: any, b: any) => {
            if (a.bestPrice !== null && b.bestPrice === null) return -1;
            if (a.bestPrice === null && b.bestPrice !== null) return 1;
            return (a.bestPrice ?? 0) - (b.bestPrice ?? 0);
          });
        }
      }

      // Use DB count (exact total before pagination), fall back to page size
      const total = dbCount ?? results.length;

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
            dentago_supplier_products (
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

    // Always filter out products with no supplier pricing
    results = results.filter((p: any) => p.totalSuppliers > 0);

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
