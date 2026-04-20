import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getClinicId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  return clinic?.id ?? null;
}

// GET — list connected suppliers for this clinic
export async function GET(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("clinic_suppliers")
    .select("supplier_id, account_number, connected_at, dentago_suppliers(id, name, website)")
    .eq("clinic_id", clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ suppliers: data ?? [] });
}

// POST — connect a supplier
export async function POST(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { supplierId, accountNumber } = await request.json();
  if (!supplierId) return NextResponse.json({ error: "supplierId required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("clinic_suppliers")
    .upsert({
      clinic_id: clinicId,
      supplier_id: supplierId,
      account_number: accountNumber ?? null,
    }, { onConflict: "clinic_id,supplier_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE — disconnect a supplier
export async function DELETE(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { supplierId } = await request.json();
  if (!supplierId) return NextResponse.json({ error: "supplierId required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("clinic_suppliers")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("supplier_id", supplierId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
