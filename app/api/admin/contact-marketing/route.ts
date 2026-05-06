import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, getAdminIdentifier } from "@/lib/admin-auth";
import { logEvent } from "@/lib/events";
import { setContactMarketingOptOut } from "@/lib/marketing-exclusions";

/** Toggle cold-marketing exclusion for a clinic email (OS /crm contacts.marketing_opt_out). */
export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const marketing_opt_out = Boolean(body.marketing_opt_out);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  await setContactMarketingOptOut(supabaseAdmin, email, marketing_opt_out);

  const adminId = getAdminIdentifier(request);
  await logEvent({
    event_type: "feature_used",
    entity_type: "system",
    entity_id: "admin",
    payload: {
      feature: "contact_marketing_opt_out_toggle",
      email: email.toLowerCase(),
      marketing_opt_out,
      by: adminId,
    },
    source: "admin_contact_marketing",
  });

  return NextResponse.json({ success: true, email: email.toLowerCase(), marketing_opt_out });
}
