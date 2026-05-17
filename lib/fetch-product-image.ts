/**
 * Fetch a product image from Dental Sky's GraphQL API by product name.
 * Used to backfill missing/cleared product images.
 */
export async function fetchDentalSkyImage(name: string): Promise<string> {
  const search = name
    .split(/\s+/)
    .slice(0, 5)
    .join(" ")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim();

  if (!search) return "";

  const safeSearch = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch("https://www.dentalsky.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DentagoBot/1.0 (+https://www.dentago.co.uk)",
      },
      body: JSON.stringify({
        query: `{
          products(search: "${safeSearch}", pageSize: 1) {
            items {
              small_image { url }
              image { url }
            }
          }
        }`,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return "";
    const body = await res.json().catch(() => null);
    const item = body?.data?.products?.items?.[0];
    return item?.small_image?.url || item?.image?.url || "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}
