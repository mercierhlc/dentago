import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { syncResendContactsToCrm } from "@/lib/resend-crm-sync";
import { logEvent } from "@/lib/events";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  try {
    const result = await syncResendContactsToCrm(supabaseAdmin, process.env.RESEND_API_KEY, {
      onProgress: (line) => console.log(`[sync-resend-contacts] ${line}`),
    });

    await logEvent({
      event_type: "feature_used",
      entity_type: "system",
      entity_id: "cron",
      payload: {
        feature: "sync_resend_contacts_cron",
        ...result,
      },
      source: "cron_sync_resend_contacts",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[sync-resend-contacts]", e);
    await logEvent({
      event_type: "feature_used",
      entity_type: "system",
      entity_id: "cron",
      payload: { feature: "sync_resend_contacts_cron", error: message },
      source: "cron_sync_resend_contacts",
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
