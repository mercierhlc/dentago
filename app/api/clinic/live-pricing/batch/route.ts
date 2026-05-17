/**
 * GET /api/clinic/live-pricing/batch?ids=id1,id2,...
 * Authorization: Bearer {token}
 *
 * Returns cached/static prices for multiple products in one request.
 * Auth + clinicId resolved once. Cache-only — no scraping on the homepage.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const STATIC_PRICES: Record<string, { supplier: string; price: number; stock: boolean }[]> = {
  "nitrile-gloves-large": [
    { supplier: "Dental Sky",   price: 4.85, stock: true  },
    { supplier: "DHB",          price: 4.95, stock: false },
    { supplier: "Kent Express", price: 5.20, stock: true  },
    { supplier: "Henry Schein", price: 5.65, stock: true  },
  ],
  "septanest-articaine": [
    { supplier: "Henry Schein", price: 28.40, stock: true  },
    { supplier: "Kent Express", price: 29.80, stock: true  },
    { supplier: "Dental Sky",   price: 31.20, stock: false },
  ],
  "face-masks-iir": [
    { supplier: "Dental Sky",   price: 3.45, stock: true },
    { supplier: "Kent Express", price: 3.65, stock: true },
  ],
  "filtek-z250-a1": [
    { supplier: "Henry Schein", price: 18.75, stock: true },
    { supplier: "Kent Express", price: 19.40, stock: true },
  ],
  "protaper-gold-f1": [
    { supplier: "Kent Express", price: 34.00, stock: true  },
    { supplier: "Henry Schein", price: 35.60, stock: true  },
  ],
  "optim33-wipes": [
    { supplier: "Dental Sky",   price: 11.90, stock: true },
    { supplier: "Henry Schein", price: 13.20, stock: true },
  ],
};

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({});

  // Resolve auth once
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  const clinicId = clinic?.id;
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Read cache for all requested products in one query
  const { data: cacheRows } = await supabaseAdmin
    .from("price_cache")
    .select("product_id, supplier, price, stock, authenticated, fetched_at, expires_at")
    .eq("clinic_id", clinicId)
    .in("product_id", ids);

  const now = Date.now();
  const freshByProduct = new Map<string, any[]>();
  for (const row of cacheRows ?? []) {
    if (new Date((row as any).expires_at).getTime() > now) {
      const pid = (row as any).product_id;
      if (!freshByProduct.has(pid)) freshByProduct.set(pid, []);
      freshByProduct.get(pid)!.push(row);
    }
  }

  const result: Record<string, any> = {};
  const fetchedAt = new Date().toISOString();

  for (const id of ids) {
    const staticData = STATIC_PRICES[id];
    if (!staticData) continue;

    const cached = freshByProduct.get(id);
    if (cached?.length) {
      const authMap = new Map(cached.map((r: any) => [r.supplier, r]));
      result[id] = {
        prices: staticData.map(s => {
          const c = authMap.get(s.supplier) as any;
          return c
            ? { supplier: s.supplier, price: c.price, stock: c.stock, authenticated: c.authenticated, live: true, fromCache: true }
            : { ...s, authenticated: false, live: false, fromCache: false };
        }),
        source: cached.some((r: any) => r.authenticated) ? "authenticated" : "static",
        fetchedAt: cached[0].fetched_at,
        fromCache: true,
      };
    } else {
      result[id] = {
        prices: staticData.map(s => ({ ...s, authenticated: false, live: false, fromCache: false })),
        source: "static",
        fetchedAt,
        fromCache: false,
      };
    }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
