import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, getAdminIdentifier } from "@/lib/admin-auth";
import { logEvent } from "@/lib/events";
import { setContactMarketingOptOut } from "@/lib/marketing-exclusions";

/**
 * One-shot: exclude every approved clinic (admin Applications) from cold marketing.
 * Matches emails from Auth users linked to clinic_profiles.
 */
export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { data: profiles, error } = await supabaseAdmin
    .from("clinic_profiles")
    .select("id")
    .eq("status", "approved");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const row of profiles ?? []) {
    const userId = (row as { id: string }).id;
    try {
      const { data: ud } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = ud?.user?.email?.toLowerCase().trim();
      if (!email) {
        skipped++;
        continue;
      }
      await setContactMarketingOptOut(supabaseAdmin, email, true);
      updated++;
    } catch {
      failures.push(userId);
    }
  }

  const adminId = getAdminIdentifier(request);
  await logEvent({
    event_type: "feature_used",
    entity_type: "system",
    entity_id: "admin",
    payload: {
      feature: "marketing_opt_out_bulk_approved_clinics",
      approved_profiles: (profiles ?? []).length,
      contacts_flagged: updated,
      skipped_no_email: skipped,
      failures: failures.length ? failures.slice(0, 20) : undefined,
      by: adminId,
    },
    source: "admin_marketing_opt_out_bulk",
  });

  return NextResponse.json({
    success: true,
    approved_profiles: (profiles ?? []).length,
    contacts_flagged: updated,
    skipped_no_email: skipped,
    failure_ids: failures,
  });
}
