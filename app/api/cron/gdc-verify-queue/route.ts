import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyGdcRegistration } from "@/lib/gdc-verify";
import { logEvent } from "@/lib/events";

const MAX_PER_RUN = 10;

export async function GET(request: Request) {
  const secret =
    request.headers.get("x-cron-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Fetch clinics that haven't been GDC-verified yet
  const { data: clinics, error } = await supabaseAdmin
    .from("clinic_profiles")
    .select("id, gdc_number, practice_name, dentist_name, dentist_surname, gdc_status")
    .or("gdc_status.eq.queued,gdc_status.is.null")
    .not("gdc_number", "is", null)
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("[gdc-verify-queue] fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = clinics ?? [];
  let verified = 0;
  let failed = 0;

  for (const clinic of rows) {
    try {
      const gdcNumber: string = clinic.gdc_number as string;
      const surname: string =
        (clinic.dentist_surname as string | null) ??
        (clinic.dentist_name
          ? (clinic.dentist_name as string).split(/\s+/).pop()!
          : null) ??
        (clinic.practice_name as string).split(/\s+/).pop() ??
        "";

      const result = await verifyGdcRegistration(gdcNumber, surname);
      const gdcStatus = result.found ? "verified" : "failed";
      const now = new Date().toISOString();

      const updatePayload: Record<string, unknown> = { gdc_status: gdcStatus };
      if (result.found) {
        updatePayload.gdc_verified_at = now;
        if (result.name) updatePayload.gdc_verified_name = result.name;
      }

      await supabaseAdmin
        .from("clinic_profiles")
        .update(updatePayload)
        .eq("id", clinic.id);

      await logEvent({
        event_type: result.found ? "gdc_verified" : "gdc_failed",
        entity_type: "clinic",
        entity_id: clinic.id as string,
        payload: {
          gdc_number: gdcNumber,
          surname_searched: surname,
          found: result.found,
          registrant_name: result.name ?? null,
          registrant_status: result.status ?? null,
          gdc_status: gdcStatus,
        },
        source: "cron_gdc_verify_queue",
      });

      if (result.found) verified++;
      else failed++;

      // Brief pause between GDC requests to be a polite HTTP citizen
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[gdc-verify-queue] error for clinic ${clinic.id}:`, err);
      failed++;
    }
  }

  await logEvent({
    event_type: "feature_used",
    entity_type: "system",
    entity_id: "cron",
    payload: {
      feature: "gdc_verify_queue_cron",
      clinics_checked: rows.length,
      verified,
      failed,
    },
    source: "cron_gdc_verify_queue",
  });

  return NextResponse.json({ checked: rows.length, verified, failed });
}
