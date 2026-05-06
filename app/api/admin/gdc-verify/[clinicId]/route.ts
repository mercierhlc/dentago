import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, getAdminIdentifier } from "@/lib/admin-auth";
import { verifyGdcRegistration } from "@/lib/gdc-verify";
import { logEvent } from "@/lib/events";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { clinicId } = await params;

  // Fetch clinic profile — we need gdc_number and practice_name / dentist_name
  const { data: clinic, error: fetchErr } = await supabaseAdmin
    .from("clinic_profiles")
    .select("id, gdc_number, practice_name, dentist_name, dentist_surname")
    .eq("id", clinicId)
    .single();

  if (fetchErr || !clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  const gdcNumber: string | undefined = clinic.gdc_number ?? undefined;
  // Try dentist_surname first, fall back to splitting dentist_name or practice_name
  const surname: string =
    clinic.dentist_surname ??
    (clinic.dentist_name
      ? (clinic.dentist_name as string).split(/\s+/).pop()
      : null) ??
    (clinic.practice_name as string).split(/\s+/).pop() ??
    "";

  if (!gdcNumber) {
    return NextResponse.json(
      { error: "No GDC number on file for this clinic" },
      { status: 422 }
    );
  }

  const result = await verifyGdcRegistration(gdcNumber, surname);

  const gdcStatus = result.found ? "verified" : "failed";
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = { gdc_status: gdcStatus };
  if (result.found) {
    updatePayload.gdc_verified_at = now;
    if (result.name) updatePayload.gdc_verified_name = result.name;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("clinic_profiles")
    .update(updatePayload)
    .eq("id", clinicId);

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
