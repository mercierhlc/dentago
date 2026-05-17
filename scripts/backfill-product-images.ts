import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PRODUCTS } from "../lib/products";

type SupplierProductRow = {
  sku: string | null;
  dentago_suppliers: { name: string } | { name: string }[] | null;
};

type ProductRow = {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  dentago_supplier_products?: SupplierProductRow[];
};

type ImageMaps = {
  byName: Map<string, string>;
  bySupplierSku: Map<string, string>;
  byBrandCategory: Map<string, string>;
  byCategory: Map<string, string>;
  byKeyword: Map<string, string>;
  generic: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const sb = createClient(supabaseUrl, serviceRole);

const STATIC_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p.image]));
const STATIC_BY_NAME = new Map(PRODUCTS.map((p) => [p.name.trim().toLowerCase(), p.image]));

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const useCatalog = args.has("--catalog");
const skipSearch = args.has("--skip-search");
const categoryFallback = args.has("--category-fallback");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? "", 10) : Number.POSITIVE_INFINITY;
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = Math.max(1, Math.min(parseInt(concurrencyArg?.split("=")[1] ?? "6", 10) || 6, 12));
const PAGE_SIZE = 100;
const MAX_PAGES_PER_CATEGORY = 200;
const DENTAL_SKY_FALLBACK_CATEGORY_IDS = [
  "1066",
  "1033",
  "1076",
  "1029",
  "1078",
  "1051",
  "1049",
  "1069",
  "1053",
  "1037",
  "1058",
  "1031",
  "1035",
  "1040",
  "1071",
  "1218",
  "1047",
];
const IMAGE_KEYWORDS = [
  "needle",
  "anaesthetic",
  "syringe",
  "sharps",
  "glove",
  "mask",
  "apron",
  "eye",
  "disinfect",
  "sterilis",
  "surface",
  "wipe",
  "hand",
  "waterline",
  "instrument",
  "probe",
  "carver",
  "excavator",
  "scaler",
  "curette",
  "bur",
  "handpiece",
  "turbine",
  "motor",
  "x-ray",
  "imaging",
  "composite",
  "restorative",
  "bond",
  "impression",
  "alginate",
  "orthodont",
  "endo",
  "cement",
  "whitening",
  "lab",
  "barrier",
  "saliva",
];

function supplierName(row: SupplierProductRow) {
  const s = row.dentago_suppliers;
  if (Array.isArray(s)) return s[0]?.name ?? "";
  return s?.name ?? "";
}

function isUsableImage(url: string) {
  const u = url.trim();
  return /^https?:\/\//i.test(u) && !/placeholder|no[_-]?image|missing/i.test(u);
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function supplierSkuKey(supplierName: string, sku: string) {
  return `${supplierName.trim().toLowerCase()}::${sku.trim().toLowerCase()}`;
}

function fallbackKey(...parts: Array<string | null | undefined>) {
  return parts.map((part) => (part ?? "").trim().toLowerCase()).join("::");
}

function imageKeywordsFor(...parts: Array<string | null | undefined>) {
  const haystack = parts.join(" ").toLowerCase();
  return IMAGE_KEYWORDS.filter((keyword) => haystack.includes(keyword));
}

function escapeGraphqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function gql(query: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch("https://www.dentalsky.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DentagoBot/1.0 (+https://www.dentago.co.uk)",
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function dentalSkyImageBySku(sku: string): Promise<string> {
  const safeSku = escapeGraphqlString(sku);
  const res = await gql(`{
    products(filter:{sku:{eq:"${safeSku}"}}, pageSize:1) {
      items { small_image { url } image { url } }
    }
  }`);
  const item = res?.data?.products?.items?.[0];
  const image = item?.small_image?.url || item?.image?.url || "";
  return isUsableImage(image) ? image : "";
}

async function ddGroupImageBySku(sku: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`https://www.ddgroup.com/search?q=${encodeURIComponent(sku)}`, {
      headers: { "User-Agent": "DentagoBot/1.0 (+https://www.dentago.co.uk)" },
      signal: controller.signal,
    });
    if (!res.ok) return "";
    const html = await res.text();
    const marker = 'window[Symbol.for("InstantSearchInitialResults")] = ';
    const start = html.indexOf(marker);
    if (start < 0) return "";
    const jsonStart = start + marker.length;
    const jsonEnd = html.indexOf("</script>", jsonStart);
    if (jsonEnd < 0) return "";

    const payload = JSON.parse(html.slice(jsonStart, jsonEnd));
    const hits = payload?.prod_dd?.results?.flatMap((result: any) => result?.hits ?? []) ?? [];
    const lowerSku = sku.trim().toLowerCase();
    const hit = hits.find((item: any) => {
      const name = String(item?.name ?? "").toLowerCase();
      const url = String(item?.url ?? "").toLowerCase();
      return name.includes(lowerSku) || url.includes(lowerSku);
    });
    const image = hit?.mainImage ?? "";
    return isUsableImage(image) ? image : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverDentalSkyCategoryIds(): Promise<string[]> {
  const res = await gql(`{
    categoryList(filters: { ids: { eq: "2" } }) {
      id name
      children {
        id name
        children {
          id name
          children {
            id name
            children { id name }
          }
        }
      }
    }
  }`);

  const out: string[] = [];
  function walk(nodes: any[]) {
    for (const node of nodes ?? []) {
      const id = String(node?.id ?? "");
      const numericId = parseInt(id, 10);
      if (numericId >= 10) out.push(id);
      if (Array.isArray(node?.children)) walk(node.children);
    }
  }

  walk(res?.data?.categoryList ?? []);
  const discovered = [...new Set(out)];
  return discovered.length > 0 ? discovered : DENTAL_SKY_FALLBACK_CATEGORY_IDS;
}

async function fetchDentalSkyCategoryImages(categoryId: string, page: number) {
  const res = await gql(`{
    products(filter:{category_id:{eq:"${escapeGraphqlString(categoryId)}"}}, pageSize:${PAGE_SIZE}, currentPage:${page}) {
      total_count
      items { sku small_image { url } image { url } }
    }
  }`);

  const products = res?.data?.products;
  return {
    totalCount: Number(products?.total_count ?? 0),
    items: (products?.items ?? []) as Array<{ sku?: string; small_image?: { url?: string }; image?: { url?: string } }>,
  };
}

async function fetchDentalSkyImageMap() {
  const map = new Map<string, string>();
  const categories = await discoverDentalSkyCategoryIds();
  console.log(`Dental Sky image crawl: ${categories.length} categories`);

  let categoryIndex = 0;
  async function worker() {
    while (categoryIndex < categories.length) {
      const categoryId = categories[categoryIndex++];
      try {
        const first = await fetchDentalSkyCategoryImages(categoryId, 1);
        for (const item of first.items) {
          const sku = item.sku?.trim();
          const image = item.small_image?.url || item.image?.url || "";
          if (sku && isUsableImage(image)) map.set(sku, image);
        }

        const totalPages = Math.min(Math.ceil(first.totalCount / PAGE_SIZE), MAX_PAGES_PER_CATEGORY);
        for (let page = 2; page <= totalPages; page++) {
          const more = await fetchDentalSkyCategoryImages(categoryId, page);
          for (const item of more.items) {
            const sku = item.sku?.trim();
            const image = item.small_image?.url || item.image?.url || "";
            if (sku && isUsableImage(image)) map.set(sku, image);
          }
        }
      } catch (error) {
        console.warn(`Dental Sky category ${categoryId} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 6 }, () => worker()));
  console.log(`Dental Sky image crawl complete: ${map.size} SKU images`);
  return map;
}

function searchTerms(product: ProductRow) {
  const base = product.name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\b(box|pack|pk|x|of|single|assorted|kit)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const firstFive = base.split(/\s+/).slice(0, 5).join(" ");
  const firstThree = base.split(/\s+/).slice(0, 3).join(" ");
  return [...new Set([product.name, firstFive, firstThree, `${product.brand ?? ""} ${firstThree}`.trim()].filter((t) => t.length >= 3))];
}

async function dentalSkyImageBySearch(product: ProductRow): Promise<string> {
  for (const term of searchTerms(product)) {
    const safeTerm = escapeGraphqlString(term.replace(/[^a-zA-Z0-9 %+/.-]/g, " ").replace(/\s+/g, " ").trim());
    if (!safeTerm) continue;
    const res = await gql(`{
      products(search:"${safeTerm}", pageSize:3) {
        items { name sku small_image { url } image { url } }
      }
    }`);
    const items = res?.data?.products?.items ?? [];
    for (const item of items) {
      const image = item?.small_image?.url || item?.image?.url || "";
      if (isUsableImage(image)) return image;
    }
  }
  return "";
}

async function loadExistingImageMaps(): Promise<ImageMaps> {
  const byName = new Map<string, string>();
  const bySupplierSku = new Map<string, string>();
  const byBrandCategory = new Map<string, string>();
  const byCategory = new Map<string, string>();
  const byKeyword = new Map<string, string>();
  let generic = "/dentago-logo.png";

  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb
      .from("dentago_products")
      .select(`
        id, name, brand, category, image,
        dentago_supplier_products (
          sku,
          dentago_suppliers ( name )
        )
      `)
      .not("image", "is", null)
      .neq("image", "")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data as ProductRow[]) {
      const image = row.image?.trim() ?? "";
      if (!isUsableImage(image)) continue;
      generic = generic === "/dentago-logo.png" ? image : generic;

      byName.set(normalizeName(row.name), image);
      if (row.brand || row.category) byBrandCategory.set(fallbackKey(row.brand, row.category), image);
      if (row.category) byCategory.set(fallbackKey(row.category), image);
      for (const keyword of imageKeywordsFor(row.name, row.brand, row.category)) {
        if (!byKeyword.has(keyword)) byKeyword.set(keyword, image);
      }
      for (const supplierRow of row.dentago_supplier_products ?? []) {
        const sku = supplierRow.sku?.trim();
        if (!sku) continue;
        bySupplierSku.set(supplierSkuKey(supplierName(supplierRow), sku), image);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Existing image maps: ${byName.size} names, ${bySupplierSku.size} supplier SKUs, ${byBrandCategory.size} brand/categories, ${byCategory.size} categories, ${byKeyword.size} keywords`);
  return { byName, bySupplierSku, byBrandCategory, byCategory, byKeyword, generic };
}

function broadFallbackImage(product: ProductRow, existingImages: ImageMaps) {
  for (const keyword of imageKeywordsFor(product.name, product.brand, product.category)) {
    const image = existingImages.byKeyword.get(keyword);
    if (image) return { image, source: "existing_keyword" };
  }
  return { image: existingImages.generic, source: "existing_generic" };
}

async function imageForProduct(
  product: ProductRow,
  dentalSkyImageMap: Map<string, string>,
  existingImages: ImageMaps,
): Promise<{ image: string; source: string }> {
  const byId = STATIC_BY_ID.get(product.id);
  if (byId && isUsableImage(byId)) return { image: byId, source: "static_id" };

  const byName = STATIC_BY_NAME.get(normalizeName(product.name));
  if (byName && isUsableImage(byName)) return { image: byName, source: "static_name" };

  const supplierRows = product.dentago_supplier_products ?? [];
  const existingByName = existingImages.byName.get(normalizeName(product.name));
  if (existingByName) return { image: existingByName, source: "existing_name" };

  for (const supplierRow of supplierRows) {
    const sku = supplierRow.sku?.trim();
    if (!sku) continue;
    const image = existingImages.bySupplierSku.get(supplierSkuKey(supplierName(supplierRow), sku));
    if (image) return { image, source: "existing_supplier_sku" };
  }

  if (categoryFallback && skipSearch) {
    const byBrandCategory = existingImages.byBrandCategory.get(fallbackKey(product.brand, product.category));
    if (byBrandCategory) return { image: byBrandCategory, source: "existing_brand_category" };

    const byCategory = existingImages.byCategory.get(fallbackKey(product.category));
    if (byCategory) return { image: byCategory, source: "existing_category" };

    return broadFallbackImage(product, existingImages);
  }

  const dentalSkySkus = supplierRows
    .filter((row) => supplierName(row) === "Dental Sky")
    .map((row) => row.sku?.trim())
    .filter((sku): sku is string => !!sku && !sku.includes("/"));

  for (const sku of dentalSkySkus) {
    const image = dentalSkyImageMap.get(sku);
    if (image) return { image, source: "dentalsky_catalog_sku" };
  }

  for (const sku of dentalSkySkus) {
    const image = await dentalSkyImageBySku(sku);
    if (image) return { image, source: "dentalsky_sku" };
  }

  const ddSkus = supplierRows
    .filter((row) => ["DD Group", "Dental Directory"].includes(supplierName(row)))
    .map((row) => row.sku?.trim())
    .filter((sku): sku is string => !!sku);

  for (const sku of ddSkus) {
    const image = await ddGroupImageBySku(sku);
    if (image) return { image, source: "ddgroup_sku" };
  }

  if (categoryFallback) {
    const byBrandCategory = existingImages.byBrandCategory.get(fallbackKey(product.brand, product.category));
    if (byBrandCategory) return { image: byBrandCategory, source: "existing_brand_category" };

    const byCategory = existingImages.byCategory.get(fallbackKey(product.category));
    if (byCategory) return { image: byCategory, source: "existing_category" };

    return broadFallbackImage(product, existingImages);
  }

  if (skipSearch) return { image: "", source: "none" };

  const searched = await dentalSkyImageBySearch(product);
  if (searched) return { image: searched, source: "dentalsky_search" };

  return { image: "", source: "none" };
}

async function loadMissingProducts(maxRows: number): Promise<ProductRow[]> {
  const rows: ProductRow[] = [];
  const pageSize = 500;
  let from = 0;

  while (rows.length < maxRows) {
    const to = from + pageSize - 1;
    const { data, error } = await sb
      .from("dentago_products")
      .select(`
        id, name, brand, category, image,
        dentago_supplier_products (
          sku,
          dentago_suppliers ( name )
        )
      `)
      .or("image.is.null,image.eq.")
      .order("id")
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...(data as ProductRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows.slice(0, maxRows);
}

async function worker(
  products: ProductRow[],
  index: { value: number },
  stats: Record<string, number>,
  dentalSkyImageMap: Map<string, string>,
  existingImages: ImageMaps,
) {
  while (index.value < products.length) {
    const product = products[index.value++];
    const current = index.value;

    try {
      const { image, source } = await imageForProduct(product, dentalSkyImageMap, existingImages);
      if (!image) {
        stats.missing++;
        if (current % 50 === 0) console.log(`[${current}/${products.length}] missing so far=${stats.missing}`);
        continue;
      }

      if (!dryRun) {
        const { error } = await sb.from("dentago_products").update({ image }).eq("id", product.id);
        if (error) throw error;
      }

      stats.fixed++;
      stats[source] = (stats[source] ?? 0) + 1;
      console.log(`fixed ${product.id} (${source}) ${product.name.slice(0, 72)}`);
    } catch (error) {
      stats.errors++;
      console.warn(`error ${product.id} ${product.name.slice(0, 72)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function main() {
  const { count: missingBefore } = await sb
    .from("dentago_products")
    .select("*", { count: "exact", head: true })
    .or("image.is.null,image.eq.");

  const maxRows = Number.isFinite(limit) ? limit : missingBefore ?? 0;
  const products = await loadMissingProducts(maxRows);
  const existingImages = await loadExistingImageMaps();
  const dentalSkyImageMap = useCatalog ? await fetchDentalSkyImageMap() : new Map<string, string>();

  console.log(`Backfilling images: ${products.length}/${missingBefore ?? 0} missing rows, concurrency=${concurrency}${dryRun ? " DRY RUN" : ""}`);

  const stats: Record<string, number> = { fixed: 0, missing: 0, errors: 0 };
  const index = { value: 0 };
  await Promise.all(Array.from({ length: concurrency }, () => worker(products, index, stats, dentalSkyImageMap, existingImages)));

  const { count: missingAfter } = await sb
    .from("dentago_products")
    .select("*", { count: "exact", head: true })
    .or("image.is.null,image.eq.");

  console.log(JSON.stringify({ missingBefore, missingAfter, stats }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
