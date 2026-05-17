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

// GET /api/clinic/staff-requests — list requests for this clinic
export async function GET(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";

  try {
    const { data, error } = await supabaseAdmin
      .from("clinic_staff_requests")
      .select("id, product_id, product_name, quantity, note, requester_name, status, reviewed_at, created_at, dentago_products(id, name, brand, category)")
      .eq("clinic_id", clinicId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Table may not exist yet — return empty gracefully
      console.error("[staff-requests] GET error:", error.message);
      return NextResponse.json({ requests: [] });
    }

    return NextResponse.json({ requests: data ?? [] });
  } catch (err) {
    console.error("[staff-requests] unexpected error:", err);
    return NextResponse.json({ requests: [] });
  }
}

// PATCH /api/clinic/staff-requests — approve or reject a request
// Body: { id: string, status: "approved" | "rejected" }
export async function PATCH(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token!);

  const body = await request.json();
  const { id, status } = body;

  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "id and status (approved|rejected) required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("clinic_staff_requests")
      .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select("id, status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
