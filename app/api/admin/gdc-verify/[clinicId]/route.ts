import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, getAdminIdentifier } from "@/lib/admin-auth";
import { verifyGdcRegistration } from "@/lib/gdc-verify";
import { inferSurnameForGdcSearch } from "@/lib/gdc-surname";
import { logEvent } from "@/lib/events";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  let bodyJson: Record<string, unknown> = {};
  try {
    bodyJson = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty or non-JSON */
  }

  const { clinicId } = await params;

  // clinic_profiles.id = auth_user_id, not clinic_accounts.id.
  // Look up auth_user_id via clinic_accounts first, then fetch the profile.
  const { data: account } = await supabaseAdmin
    .from("clinic_accounts")
    .select("auth_user_id")
    .eq("id", clinicId)
    .maybeSingle();

  const profileId = account?.auth_user_id ?? clinicId; // fallback: caller may pass auth_user_id directly

  const { data: clinic, error: fetchErr } = await supabaseAdmin
    .from("clinic_profiles")
    .select("id, gdc_number, practice_name")
    .eq("id", profileId)
    .maybeSingle();

  if (fetchErr || !clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  const gdcNumber: string | undefined = clinic.gdc_number ?? undefined;

  const bodySurname = String(bodyJson.surname ?? "").trim();
  const surname =
    bodySurname ||
    inferSurnameForGdcSearch(clinic.practice_name as string | null) ||
    "";

  if (!gdcNumber) {
    return NextResponse.json(
      { error: "No GDC number on file for this clinic" },
      { status: 422 }
    );
  }

  if (!surname.trim()) {
    return NextResponse.json(
      {
        error:
          "GDC search requires a registrant surname. Pass JSON { \"surname\": \"Smith\" } or set a parseable practice name on the profile.",
      },
      { status: 422 },
    );
  }

  const result = await verifyGdcRegistration(gdcNumber, surname);

  const gdcStatus = result.found ? "verified" : "failed";
  const now = new Date().toISOString();

  // clinic_profiles uses 'status' (pending/approved/rejected) — update to approved on verify
  const updatePayload: Record<string, unknown> = {};
  if (result.found) {
    updatePayload.status = "approved";
    updatePayload.reviewed_at = now;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("clinic_profiles")
    .update(updatePayload)
    .eq("id", profileId);

  if (updateErr) {
    console.error("[gdc-verify] update error:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const adminId = getAdminIdentifier(request);
  const eventType = result.found ? "gdc_verified" : "gdc_failed";

  await logEvent({
    event_type: eventType,
    entity_type: "clinic",
    entity_id: clinicId,
    payload: {
      gdc_number: gdcNumber,
      surname_searched: surname,
      found: result.found,
      registrant_name: result.name ?? null,
      registrant_status: result.status ?? null,
      gdc_status: gdcStatus,
      triggered_by: adminId,
    },
    source: "admin_gdc_verify",
  });

  return NextResponse.json({
    clinicId,
    gdc_status: gdcStatus,
    found: result.found,
    name: result.name ?? null,
    status: result.status ?? null,
  });
}
