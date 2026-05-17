import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClinicProductPlan, getOnboardingStatus } from "@/lib/onboarding";

async function getClinicFromToken(request: Request): Promise<string | null> {
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

export async function GET(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const plan = await getClinicProductPlan(clinicId);
  const steps = await getOnboardingStatus(clinicId, plan);
  const allComplete = steps.length > 0 && steps.every((s) => s.completed);

  return NextResponse.json({ steps, allComplete, plan });
}
