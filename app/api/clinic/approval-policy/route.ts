/**
 * GET/POST /api/clinic/approval-policy
 * Get or update the approval threshold for a clinic.
 * Only owners and managers can update.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getClinicContext(token: string) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: primary } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (primary) return { user, clinicId: primary.id, role: "owner" };

  const { data: cu } = await supabaseAdmin
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (cu) return { user, clinicId: cu.clinic_id, role: cu.role };
  return null;
}

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const ctx = await getClinicContext(token);
  if (!ctx) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: policy } = await supabaseAdmin
    .from("clinic_approval_policies")
    .select("approval_threshold, enabled, updated_at")
    .eq("clinic_id", ctx.clinicId)
    .single();

  // Return defaults if no policy row yet
  return NextResponse.json(policy ?? { approval_threshold: 500, enabled: false });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const ctx = await getClinicContext(token);
  if (!ctx) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  if (ctx.role === "staff") {
    return NextResponse.json({ error: "Only managers or owners can update approval policy" }, { status: 403 });
  }

  const { approval_threshold, enabled } = await request.json();

  if (typeof approval_threshold !== "number" || approval_threshold < 0) {
    return NextResponse.json({ error: "approval_threshold must be a non-negative number" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("clinic_approval_policies")
    .upsert(
      {
        clinic_id: ctx.clinicId,
        approval_threshold,
        enabled: enabled ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, approval_threshold, enabled });
}
