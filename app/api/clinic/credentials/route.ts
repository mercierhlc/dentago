import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";

async function getClinicId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

// Look up UUID in `suppliers` table by dentago_suppliers integer id (via name match)
async function getSupplierUuid(dentaGoId: number): Promise<string | null> {
  const { data: ds } = await supabaseAdmin
    .from("dentago_suppliers").select("name").eq("id", dentaGoId).single();
  if (!ds) return null;
  const { data: sup } = await supabaseAdmin
    .from("suppliers").select("id").eq("name", ds.name).single();
  return sup?.id ?? null;
}

// GET — list connected supplier credentials (passwords redacted)
export async function GET(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("supplier_credentials")
    .select("id, supplier_id, username, last_synced, created_at, suppliers(id, name)")
    .eq("clinic_id", clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Map UUID supplier back to dentago_suppliers integer id so frontend can match
  const supplierNames = (data ?? []).map((c: any) => c.suppliers?.name).filter(Boolean);
  let nameToIntId: Record<string, number> = {};
  if (supplierNames.length > 0) {
    const { data: ds } = await supabaseAdmin
      .from("dentago_suppliers").select("id, name").in("name", supplierNames);
    (ds ?? []).forEach((s: any) => { nameToIntId[s.name] = s.id; });
  }

  const credentials = (data ?? []).map((c: any) => ({
    id: c.id,
    supplier_id: nameToIntId[c.suppliers?.name] ?? null, // integer id for frontend
    username: c.username,
    last_synced: c.last_synced,
    dentago_suppliers: {
      id: nameToIntId[c.suppliers?.name] ?? null,
      name: c.suppliers?.name ?? "",
    },
  }));

  return NextResponse.json({ credentials });
}

// POST — save or update credentials for a supplier
export async function POST(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { supplierId, username, password } = await request.json();
  if (!supplierId || !username || !password) {
    return NextResponse.json({ error: "supplierId, username and password are required" }, { status: 400 });
  }

  // Get UUID for this supplier
  const supplierUuid = await getSupplierUuid(supplierId);
  if (!supplierUuid) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  // Check if credential already exists, then update or insert
  const { data: existing } = await supabaseAdmin
    .from("supplier_credentials")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("supplier_id", supplierUuid)
    .maybeSingle();

  const credPayload = {
    clinic_id: clinicId,
    supplier_id: supplierUuid,
    username,
    encrypted_password: encrypt(password),
  };

  let credError;
  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("supplier_credentials")
      .update({ username, encrypted_password: encrypt(password) })
      .eq("id", existing.id);
    credError = error;
  } else {
    const { error } = await supabaseAdmin
      .from("supplier_credentials")
      .insert(credPayload);
    credError = error;
  }

  if (credError) return NextResponse.json({ error: credError.message }, { status: 500 });

  // Also ensure clinic_suppliers row exists (uses integer dentago_suppliers id)
  await supabaseAdmin
    .from("clinic_suppliers")
    .upsert({ clinic_id: clinicId, supplier_id: supplierId }, { onConflict: "clinic_id,supplier_id" });

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE — remove credentials for a supplier
export async function DELETE(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { supplierId } = await request.json();
  if (!supplierId) return NextResponse.json({ error: "supplierId required" }, { status: 400 });

  const supplierUuid = await getSupplierUuid(supplierId);

  await Promise.all([
    supplierUuid
      ? supabaseAdmin
          .from("supplier_credentials")
          .delete()
          .eq("clinic_id", clinicId)
          .eq("supplier_id", supplierUuid)
      : Promise.resolve(),
    supabaseAdmin
      .from("clinic_suppliers")
      .delete()
      .eq("clinic_id", clinicId)
      .eq("supplier_id", supplierId),
  ]);

  return NextResponse.json({ success: true });
}
