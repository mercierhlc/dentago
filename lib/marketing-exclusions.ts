import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRegisteredClinicEmailSet } from "@/lib/registered-clinic-emails";

/**
 * Emails that must never receive cold/marketing blasts:
 * signed-up clinics (accounts + Auth) ∪ CRM contacts with marketing_opt_out.
 */
export async function fetchColdMarketingExcludedEmails(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<Set<string>> {
  const merged = await fetchRegisteredClinicEmailSet(supabase, supabaseUrl, serviceRoleKey);

  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("contacts")
      .select("email")
      .eq("marketing_opt_out", true)
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn("[marketing-exclusions] contacts:", error.message);
      break;
    }
    if (!data?.length) break;
    for (const r of data as { email: string }[]) {
      const e = r.email?.toLowerCase().trim();
      if (e) merged.add(e);
    }
    from += PAGE;
    if (data.length < PAGE) break;
  }

  return merged;
}

/** Set CRM marketing flag without wiping other columns */
export async function setContactMarketingOptOut(
  supabase: SupabaseClient,
  emailRaw: string,
  optOut: boolean
): Promise<void> {
  const email = emailRaw.toLowerCase().trim();
  if (!email) return;

  const { data: row } = await supabase.from("contacts").select("id").eq("email", email).maybeSingle();

  if (row) {
    await supabase
      .from("contacts")
      .update({ marketing_opt_out: optOut, updated_at: new Date().toISOString() })
      .eq("email", email);
    return;
  }

  if (optOut) {
    await supabase.from("contacts").insert({
      email,
      marketing_opt_out: true,
      source: "admin_marketing_opt_out",
      updated_at: new Date().toISOString(),
    });
  }
}
