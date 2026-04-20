import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Simple reversible encryption using AES-like XOR with a server secret.
// In production, replace with proper AES-256-GCM via Node crypto.
function encrypt(text: string): string {
  const secret = process.env.CREDENTIAL_SECRET ?? "dentago-secret-key-change-in-prod";
  const encoded = Buffer.from(text, "utf8");
  const result = Buffer.alloc(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ secret.charCodeAt(i % secret.length);
  }
  return result.toString("base64");
}

function decrypt(enc: string): string {
  const secret = process.env.CREDENTIAL_SECRET ?? "dentago-secret-key-change-in-prod";
  const encoded = Buffer.from(enc, "base64");
  const result = Buffer.alloc(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ secret.charCodeAt(i % secret.length);
  }
  return result.toString("utf8");
}

async function getClinicId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

// GET — list connected supplier credentials (passwords redacted)
export async function GET(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("supplier_credentials")
    .select("id, supplier_id, username, last_synced, created_at, dentago_suppliers(id, name)")
    .eq("clinic_id", clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Never return encrypted password to client
  return NextResponse.json({ credentials: data ?? [] });
}

// POST — save or update credentials for a supplier
export async function POST(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { supplierId, username, password } = await request.json();
  if (!supplierId || !username || !password) {
    return NextResponse.json({ error: "supplierId, username and password are required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("supplier_credentials")
    .upsert({
      clinic_id: clinicId,
      supplier_id: supplierId,
      username,
      password_enc: encrypt(password),
      updated_at: new Date().toISOString(),
    }, { onConflict: "clinic_id,supplier_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also ensure clinic_suppliers row exists
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

  await supabaseAdmin
    .from("supplier_credentials")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("supplier_id", supplierId);

  return NextResponse.json({ success: true });
}
