import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getClinicFromToken(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

// GET /api/clinic/budget — returns monthly_budget + current month spend
export async function GET(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("monthly_budget")
    .eq("id", clinicId)
    .single();

  // Calculate current month spend from orders
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: orders } = await supabaseAdmin
    .from("dentago_orders")
    .select("total_amount")
    .eq("clinic_id", clinicId)
    .neq("status", "cancelled")
    .gte("created_at", monthStart.toISOString());

  const currentSpend = (orders ?? []).reduce((sum, o) => sum + parseFloat(o.total_amount || "0"), 0);

  return NextResponse.json({
    monthly_budget: clinic?.monthly_budget ?? null,
    current_month_spend: currentSpend,
  });
}

// PUT /api/clinic/budget — set monthly budget
export async function PUT(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { monthly_budget } = await request.json();
  const budget = monthly_budget === null ? null : parseFloat(monthly_budget);

  if (budget !== null && (isNaN(budget) || budget < 0)) {
    return NextResponse.json({ error: "Invalid budget value" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("clinic_accounts")
    .update({ monthly_budget: budget })
    .eq("id", clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, monthly_budget: budget });
}
