import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin `/api/admin/clinics` lists `clinic_profiles` (id = auth user id).
 * The modern workspace flow only inserted `clinic_accounts` — ensure a profile
 * row exists so new registrations appear in admin review.
 */
export async function ensureClinicProfileForAdmin(
  admin: SupabaseClient,
  params: { authUserId: string; practiceName: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: existing, error: exErr } = await admin
    .from("clinic_profiles")
    .select("id")
    .eq("id", params.authUserId)
    .maybeSingle();

  if (exErr) return { ok: false, message: exErr.message };
  if (existing?.id) return { ok: true };

  const name = params.practiceName.trim() || "Unnamed practice";
  const { error: insErr } = await admin.from("clinic_profiles").insert({
    id: params.authUserId,
    practice_name: name,
    gdc_number: "",
    practice_type: "Not specified",
    street_address: "",
    city: "",
    postcode: "",
    phone: "",
    status: "pending",
    is_deactivated: false,
  });

  if (insErr) return { ok: false, message: insErr.message };
  return { ok: true };
}
