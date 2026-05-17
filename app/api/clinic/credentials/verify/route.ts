/**
 * POST /api/clinic/credentials/verify
 *
 * Tests supplier credentials without saving them. Returns whether the
 * login succeeded. Used by the UI to give immediate feedback after
 * a clinic connects a supplier.
 *
 * Body: { supplierId: number, username: string, password: string }
 * Response: { ok: boolean, verified: boolean, error?: string }
 *
 * Uses a trivial product search to confirm authentication — not a price
 * lookup. Returns within the scraper timeout (12s).
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// One known search term per supplier that reliably returns results when logged in
const VERIFY_SEARCH: Record<string, string> = {
  "Henry Schein":      "nitrile gloves",
  "Dental Sky":        "nitrile gloves",
  "Kent Express":      "nitrile gloves",
  "Dental Directory":  "nitrile gloves",
  "Clark Dental":      "nitrile gloves",
  "Trycare":           "nitrile gloves",
  "Optident":          "nitrile gloves",
  "DHB":               "nitrile gloves",
  "Wrights":           "nitrile gloves",
  "DD Group":          "nitrile gloves",
};

async function getClinicId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

export async function POST(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  const { supplierId, username, password } = await request.json().catch(() => ({}));
  if (!supplierId || !username || !password) {
    return NextResponse.json({ ok: false, error: "supplierId, username and password are required" }, { status: 400 });
  }

  // Look up supplier name from integer id
  const { data: ds } = await supabaseAdmin
    .from("dentago_suppliers").select("name").eq("id", supplierId).single();
  if (!ds) return NextResponse.json({ ok: false, error: "Supplier not found" }, { status: 404 });

  const supplierName: string = ds.name;
  const searchTerm = VERIFY_SEARCH[supplierName] ?? "nitrile gloves";

  const { hasLivePriceScraper, fetchAuthenticatedPrices } = await import("@/lib/scrapers");

  if (!hasLivePriceScraper(supplierName)) {
    return NextResponse.json({
      ok: true,
      verified: true,
      skippedAutomatedCheck: true,
    });
  }

  try {
    const result = await fetchAuthenticatedPrices(
      [{ supplierName, username, password }],
      searchTerm
    );

    // fetchAuthenticatedPrices returns a Map<supplierName, price>
    // If the map has an entry for this supplier, login worked
    const verified = result.has(supplierName);

    return NextResponse.json({ ok: true, verified });
  } catch {
    // Scrape failed (e.g. network, timeout) — treat as unverified, not a hard error
    return NextResponse.json({ ok: true, verified: false });
  }
}
