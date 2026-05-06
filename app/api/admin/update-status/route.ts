import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { requireAdminAuth, getAdminIdentifier } from "@/lib/admin-auth";
import { setContactMarketingOptOut } from "@/lib/marketing-exclusions";

export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { userId, status, rejection_reason, notes } = await request.json()

  const { error } = await supabaseAdmin
    .from('clinic_profiles')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      ...(rejection_reason ? { rejection_reason } : {}),
    })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let loginEmailForCrm: string | null = null;
  try {
    const { data: userLookup } = await supabaseAdmin.auth.admin.getUserById(userId);
    loginEmailForCrm = userLookup?.user?.email?.toLowerCase().trim() ?? null;
  } catch {
    loginEmailForCrm = null;
  }

  if (status === "approved" && loginEmailForCrm) {
    try {
      await setContactMarketingOptOut(supabaseAdmin, loginEmailForCrm, true);
    } catch (e) {
      console.error("[admin] marketing opt-out on approve:", e);
    }
  }

  // Append-only audit record
  const adminId = getAdminIdentifier(request);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  await supabaseAdmin.from('verification_audit').insert({
    admin_user_id: adminId,
    clinic_id: userId,
    action: status,
    notes: notes ?? rejection_reason ?? null,
    ip_address: ip,
  });

  // Log GDC verification outcome to the OS event log
  const eventType = status === 'approved'
    ? 'gdc_verified'
    : status === 'rejected'
    ? 'gdc_failed'
    : status === 'pending'
    ? 'gdc_queued'
    : 'gdc_status_changed';

  let summaryLines: string[] = [];
  if (status === "approved") {
    summaryLines = [
      "Admin approved this clinic application (GDC / verification pathway). They can proceed as a verified practice.",
      loginEmailForCrm
        ? `Their login email (${loginEmailForCrm}) was marked in CRM to opt out of cold and blast-style marketing emails, so automated prospecting skips them.`
        : "We could not read a login email from Auth, so the CRM marketing-opt-out step may have been skipped; check the CRM contact manually.",
      "Operational and product emails (orders, resets, alerts) are controlled elsewhere; this flag only affects prospecting-style campaigns.",
    ];
  } else if (status === "rejected") {
    summaryLines = [
      "Admin rejected this clinic application.",
      rejection_reason
        ? `Reason emailed or recorded in admin: ${rejection_reason}`
        : "No rejection reason text was supplied on this request.",
    ];
  } else {
    summaryLines = [`Verification status moved to "${status}".`];
  }
  await logEvent({
    event_type: eventType,
    entity_type: 'clinic',
    entity_id: userId,
    payload: {
      status,
      rejection_reason: rejection_reason ?? null,
      audited_by: adminId,
      login_email_used_for_crm: loginEmailForCrm,
      crm_marketing_opt_out_attempted: status === "approved" && Boolean(loginEmailForCrm),
      summary_lines: summaryLines,
    },
    source: 'admin_update_status',
  });

  return NextResponse.json({ success: true })
}
