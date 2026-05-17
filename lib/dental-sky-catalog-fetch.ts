/**
 * Full Dental Sky catalog price map via Magento GraphQL (category pagination +
 * SKU backfill for rows missing from category listings).
 *
 * Coverage strategy:
 *  1. At startup, auto-discover ALL category IDs via `categoryList` GraphQL query —
 *     this includes every leaf subcategory, not just the 17 top-level ones.
 *  2. Fall back to the hardcoded list if the discovery query fails.
 *  3. Crawl all discovered categories with pagination (PAGE_SIZE=100, up to MAX_PAGES_PER_CATEGORY).
 *
 * Why this matters: Magento 2's `category_id` filter returns products assigned to that
 * specific category only — not to parent or sibling categories. Products assigned only
 * to a leaf subcategory (e.g. "Nitrile Gloves" under "Infection Control > Gloves") are
 * invisible when querying the parent ID. Adding all leaf IDs is the fix.
 */
import * as https from "https";
import { dentalSkyStoredExVatPromoFromGraphqlProduct } from "@/lib/dental-sky-graphql-price";

/** Hardcoded top-level category IDs — used as fallback if auto-discovery fails. */
export const DENTAL_SKY_GRAPHQL_CATEGORIES: Array<{ id: string; name: string }> = [
  { id: "1066", name: "Anaesthetics & Pharmaceuticals" },
  { id: "1033", name: "Burs & Abrasives" },
  { id: "1076", name: "Cements & Liners" },
  { id: "1029", name: "Clinical Workwear" },
  { id: "1078", name: "Crowns & Bridges" },
  { id: "1051", name: "Disposables" },
  { id: "1049", name: "Endodontics" },
  { id: "1069", name: "Dental Hand Instruments" },
  { id: "1053", name: "Handpieces & Equipment" },
  { id: "1037", name: "Impression Materials" },
  { id: "1058", name: "Infection Control" },
  { id: "1031", name: "Oral Hygiene" },
  { id: "1035", name: "Restoratives" },
  { id: "1040", name: "Orthodontics" },
  { id: "1071", name: "Surgery & Implantology" },
  { id: "1218", name: "Whitening" },
  { id: "1047", name: "X-Ray Materials" },
];

const PAGE_SIZE = 100;
/** Per-category page cap — raise if cron duration allows; avoids unbounded runs. */
const MAX_PAGES_PER_CATEGORY = 200;

/**
 * Query Dental Sky's GraphQL API to discover ALL category IDs (including every
 * leaf subcategory). Returns them deduplicated, falling back to the hardcoded list
 * on any failure.
 *
 * Root category ID 2 is Dental Sky's "Default Category" root — fetching its full
 * subtree gives us every category the site uses.
 */
async function discoverAllCategoryIds(): Promise<Array<{ id: string; name: string }>> {
  // Magento's categoryList supports recursive `children` up to a depth limit.
  // We request 4 levels deep which covers all real leaf categories on Dental Sky.
  const query = `{
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
  }`;

  try {
    const res = await gqlPost(query);
    const roots: any[] = res?.data?.categoryList ?? [];

    const collected: Array<{ id: string; name: string }> = [];

    function walk(nodes: any[]) {
      for (const node of nodes) {
        if (node.id && node.name) {
          collected.push({ id: String(node.id), name: node.name });
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children);
        }
      }
    }
    walk(roots);

    // Deduplicate by id, exclude root (id=1 and id=2) and any with id < 10
    const seen = new Set<string>();
    const result = collected.filter((c) => {
      const numId = parseInt(c.id, 10);
      if (numId < 10) return false; // skip root/system categories
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    if (result.length >= DENTAL_SKY_GRAPHQL_CATEGORIES.length) {
      return result;
    }
    // Discovery returned fewer than our hardcoded list — something went wrong
    return DENTAL_SKY_GRAPHQL_CATEGORIES;
  } catch {
    // Discovery failed — fall back to hardcoded list
    return DENTAL_SKY_GRAPHQL_CATEGORIES;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function gqlPost(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request(
      {
        hostname: "www.dentalsky.com",
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.write(body);
    req.end();
  });
}

async function fetchCategoryPage(
  categoryId: string,
  page: number,
): Promise<{ items: any[]; totalCount: number }> {
  const query = `{
    products(
      filter:{category_id:{eq:"${categoryId}"}}
      pageSize:${PAGE_SIZE}
      currentPage:${page}
    ){
      total_count
      items{
        sku
        price{regularPrice{amount{value}}}
        price_range{minimum_price{regular_price{value} final_price{value}}}
        stock_status
      }
    }
  }`;
  const res = await gqlPost(query);
  const products = res?.data?.products;
  if (!products) throw new Error("no products in GraphQL response");
  return { items: products.items ?? [], totalCount: products.total_count ?? 0 };
}

function ingestGraphqlItems(
  map: Map<string, { price: number; stock: boolean }>,
  items: any[],
) {
  for (const p of items) {
    const sku = p.sku?.toString().trim();
    const price = dentalSkyStoredExVatPromoFromGraphqlProduct(p);
    if (!sku || !price || price <= 0) continue;
    map.set(sku, {
      price,
      stock: (p.stock_status ?? "IN_STOCK") === "IN_STOCK",
    });
  }
}

/**
 * Ex-VAT trade list (GraphQL promotional `final_price` when present, converted ÷ 1.2) + stock per SKU.
 */
export async function fetchDentalSkySkuPriceMap(options?: {
  categoryConcurrency?: number;
  pageDelayMs?: number;
}): Promise<Map<string, { price: number; stock: boolean }>> {
  const categoryConcurrency = options?.categoryConcurrency ?? 5;
  const pageDelayMs = options?.pageDelayMs ?? 45;

  const out = new Map<string, { price: number; stock: boolean }>();

  async function runCategory(catId: string) {
    const first = await fetchCategoryPage(catId, 1);
    ingestGraphqlItems(out, first.items);
    const totalPages = Math.min(
      Math.ceil(first.totalCount / PAGE_SIZE),
      MAX_PAGES_PER_CATEGORY,
    );
    for (let pg = 2; pg <= totalPages; pg++) {
      if (pageDelayMs > 0) await delay(pageDelayMs);
      const more = await fetchCategoryPage(catId, pg);
      ingestGraphqlItems(out, more.items);
    }
  }

  // Auto-discover all leaf category IDs (including subcategories not in the
  // hardcoded fallback list) — this is what gets us from ~570 to 2,000+ SKUs.
  const discoveredCategories = await discoverAllCategoryIds();
  const queue = discoveredCategories.map((c) => c.id);
  const workers = Array.from({ length: categoryConcurrency }, async () => {
    while (queue.length > 0) {
      const catId = queue.shift();
      if (!catId) break;
      try {
        await runCategory(catId);
      } catch {
        /* category failed */
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Fill `map` for SKUs not returned by category pagination (configurable/legacy links, etc.).
 * Uses `sku: { in: [...] }` with per-SKU fallback on batch failure.
 */
export async function enrichDentalSkyMapWithMissingSkus(
  map: Map<string, { price: number; stock: boolean }>,
  skus: string[],
  options?: { batchSize?: number; delayMs?: number },
): Promise<{ skusAttempted: number; skusNewlyResolved: number }> {
  const unique = [
    ...new Set(
      skus
        .map((s) => s?.toString().trim())
        .filter(Boolean)
        .filter((s) => !map.has(s)),
    ),
  ];
  const batchSize = options?.batchSize ?? 25;
  const delayMs = options?.delayMs ?? 120;

  for (let i = 0; i < unique.length; i += batchSize) {
    const chunk = unique.slice(i, i + batchSize);
    const inList = chunk.map((s) => JSON.stringify(s)).join(",");
    const query = `{
      products(filter:{sku:{in:[${inList}]}},pageSize:${batchSize},currentPage:1){
        items{
          sku
          price{regularPrice{amount{value}}}
          price_range{minimum_price{regular_price{value} final_price{value}}}
          stock_status
        }
      }
    }`;
    try {
      const res = await gqlPost(query);
      const items = res?.data?.products?.items ?? [];
      ingestGraphqlItems(map, items);
    } catch {
      for (const sku of chunk) {
        try {
          const q = `{
            products(filter:{sku:{eq:${JSON.stringify(sku)}}},pageSize:1,currentPage:1){
              items{
                sku
                price{regularPrice{amount{value}}}
                price_range{minimum_price{regular_price{value} final_price{value}}}
                stock_status
              }
            }
          }`;
          const res = await gqlPost(q);
          ingestGraphqlItems(map, res?.data?.products?.items ?? []);
        } catch {
          /* skip */
        }
        if (delayMs > 0) await delay(Math.min(delayMs, 60));
      }
    }
    if (delayMs > 0 && i + batchSize < unique.length) await delay(delayMs);
  }

  const skusNewlyResolved = unique.filter((s) => map.has(s)).length;
  return { skusAttempted: unique.length, skusNewlyResolved };
}
