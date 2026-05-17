import { supabaseAdmin } from "@/lib/supabase";

export type ClinicSessionFromToken = {
  user: { id: string; email?: string };
  clinicId: string;
  clinicName: string;
  email: string;
  monthly_budget: number | null;
  parent_clinic_id: string | null;
  product_plan: "pro" | "free";
  role: "owner" | "manager" | "staff";
};

/** Same identity model as GET /api/orders/approve — owner, manager, or staff */
export async function getClinicSessionFromToken(token: string): Promise<ClinicSessionFromToken | null> {
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: primaryClinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id, clinic_name, email, product_plan, monthly_budget, parent_clinic_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (primaryClinic) {
    return {
      user: { id: user.id, email: user.email ?? undefined },
      clinicId: primaryClinic.id,
      clinicName: primaryClinic.clinic_name ?? "",
      email: primaryClinic.email ?? "",
      monthly_budget: primaryClinic.monthly_budget ?? null,
      parent_clinic_id: (primaryClinic as { parent_clinic_id?: string | null }).parent_clinic_id ?? null,
      product_plan: primaryClinic.product_plan === "pro" ? "pro" : "free",
      role: "owner",
    };
  }

  const { data: clinicUser } = await supabaseAdmin
    .from("clinic_users")
    .select("clinic_id, role, clinic_accounts(id, clinic_name, email, product_plan, monthly_budget, parent_clinic_id)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const caRaw = clinicUser?.clinic_accounts as unknown;
  const ca = (
    Array.isArray(caRaw) ? caRaw[0] : caRaw
  ) as {
    id: string;
    clinic_name?: string;
    email?: string;
    product_plan?: string | null;
    monthly_budget?: number | null;
    parent_clinic_id?: string | null;
  } | null;

  if (!clinicUser?.clinic_id || !ca?.id) return null;

  return {
    user: { id: user.id, email: user.email ?? undefined },
    clinicId: ca.id,
    clinicName: ca.clinic_name ?? "",
    email: ca.email ?? "",
    monthly_budget: ca.monthly_budget ?? null,
    parent_clinic_id: ca.parent_clinic_id ?? null,
    product_plan: ca.product_plan === "pro" ? "pro" : "free",
    role: clinicUser.role === "manager" ? "manager" : "staff",
  };
}
