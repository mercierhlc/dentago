import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getClinicId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

export async function GET(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("clinic_savings_log")
    .select("id, product_name, supplier_name, dentago_price, list_price, saving_amount, saving_pct, quantity, saved_at")
    .eq("clinic_id", clinicId)
    .order("saved_at", { ascending: false });

  if (error) {
    // Table may not exist yet — return graceful empty state
    if (error.code === "42P01") {
      return NextResponse.json({
        total_saved: 0,
        avg_saving_pct: 0,
        entries_count: 0,
        savings: [],
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = data ?? [];
  const total_saved = entries.reduce((sum, r) => sum + (r.saving_amount ?? 0), 0);
  const savingPcts = entries.filter(r => r.saving_pct != null).map(r => r.saving_pct as number);
  const avg_saving_pct = savingPcts.length > 0
    ? savingPcts.reduce((s, p) => s + p, 0) / savingPcts.length
    : 0;

  return NextResponse.json({
    total_saved: Math.round(total_saved * 100) / 100,
    avg_saving_pct: Math.round(avg_saving_pct * 10) / 10,
    entries_count: entries.length,
    savings: entries,
  });
}
