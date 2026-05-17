/**
 * Emails belonging to signed-up clinics (product tenants). Use to block cold outreach.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchRegisteredClinicEmailSet(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<Set<string>> {
  const out = new Set<string>();

  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from("clinic_accounts").select("email").range(from, from + PAGE - 1);
    if (error) {
      console.warn("[registered-clinic-emails] clinic_accounts:", error.message);
      break;
    }
    if (!data?.length) break;
    for (const r of data as { email: string }[]) {
      const e = r.email?.toLowerCase().trim();
      if (e) out.add(e);
    }
    from += PAGE;
    if (data.length < PAGE) break;
  }

  for (let page = 1; page < 500; page++) {
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!authRes.ok) {
      console.warn("[registered-clinic-emails] auth admin:", authRes.status);
      break;
    }
    const data = (await authRes.json()) as { users?: { email?: string }[] };
    const users = data.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      const e = u.email?.toLowerCase().trim();
      if (e) out.add(e);
    }
    if (users.length < 1000) break;
  }

  return out;
}
