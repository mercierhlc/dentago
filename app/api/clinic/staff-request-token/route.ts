import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { randomBytes } from "crypto";

async function getClinicFromToken(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

// GET /api/clinic/staff-request-token — returns existing token or generates one
export async function GET(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("staff_request_token")
    .eq("id", clinicId)
    .single();

  if (clinic?.staff_request_token) {
    return NextResponse.json({ token: clinic.staff_request_token });
  }

  // Generate new token
  const token = randomBytes(16).toString("hex");
  await supabaseAdmin
    .from("clinic_accounts")
    .update({ staff_request_token: token })
    .eq("id", clinicId);

  return NextResponse.json({ token });
}

// POST /api/clinic/staff-request-token — regenerate token (invalidates old QR)
export async function POST(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const token = randomBytes(16).toString("hex");
  const { error } = await supabaseAdmin
    .from("clinic_accounts")
    .update({ staff_request_token: token })
    .eq("id", clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}
