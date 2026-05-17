/**
 * /api/cron/refresh-dental-sky-prices
 *
 * Re-fetches Dental Sky GraphQL (category crawl + SKU backfill), then for every
 * `dentago_supplier_products` row with a matching feed SKU:
 *   - UPDATE price (trade ex-VAT: promo GraphQL `final_price` inc → ÷ 1.2), stock, updated_at
 *   - Writes `dentago_price_history` only when price or stock actually changed
 */
import { NextResponse } from "next/server";
import { runDentalSkyPriceRefresh } from "@/lib/run-dental-sky-price-refresh";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await runDentalSkyPriceRefresh();
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
