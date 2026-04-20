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

    // Full-text search using the GIN index on search_vector
    if (query) {
      // Convert query to tsquery — append :* to last word for prefix matching
      const tsQuery = query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, "") + ":*")
        .join(" & ");

      if (tsQuery) {
        productQuery = productQuery.textSearch("search_vector", tsQuery, {
          type: "websearch",
          config: "english",
        });
      }
    }

    const { data: products, error } = await productQuery;

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Shape + filter in JS (price/stock filters need aggregated data) ────
    let results = (products ?? []).map((p: any) => {
      let supplierRows = (p.dentago_supplier_products ?? []).map((sp: any) => ({
        name:     sp.dentago_suppliers?.name ?? "Unknown",
        id:       sp.dentago_suppliers?.id,
        price:    parseFloat(sp.price),
        stock:    sp.stock,
        delivery: sp.delivery,
        sku:      sp.sku,
        packSize: sp.pack_size ?? p.pack_size,
      }));

      // If clinic is logged in and has connected suppliers, only show those
      if (connectedSupplierIds !== null && connectedSupplierIds.length > 0) {
        supplierRows = supplierRows.filter((s: any) => connectedSupplierIds.includes(s.id));
      }

      const inStockSuppliers = supplierRows.filter((s: any) => s.stock);
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
        suppliers:   supplierRows,
        bestPrice,
        bestSupplier,
        saving,
        inStockCount: inStockSuppliers.length,
        totalSuppliers: supplierRows.length,
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
