import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { ONBOARDING_CONNECT_SUPPLIER_SET } from "@/lib/supplier-branding";

async function clinicContextFromRequest(
  request: Request,
): Promise<{ clinicId: string; userId: string } | { error: string; status: number }> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Unauthorised", status: 401 };

  const {
    data: { user },
    error: authErr,
  } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user?.id) return { error: "Unauthorised", status: 401 };

  const { data: clinic, error } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message, status: 500 };
  if (!clinic?.id) return { error: "No clinic account for this user", status: 404 };

  return { clinicId: clinic.id as string, userId: user.id };
}

function clampStrings(arr: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

export async function GET(request: Request) {
  const ctx = await clinicContextFromRequest(request);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await supabaseAdmin
    .from("clinic_accounts")
    .select("onboarding_survey, onboarding_survey_at")
    .eq("id", ctx.clinicId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = data as { onboarding_survey?: unknown; onboarding_survey_at?: string | null } | null;

  const [gdcDoc, cred, conn, orderEvt] = await Promise.all([
    supabaseAdmin
      .from("clinic_documents")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("document_type", "gdc_registration")
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from("supplier_credentials").select("id").eq("clinic_id", ctx.clinicId).limit(1).maybeSingle(),
    supabaseAdmin.from("supplier_connections").select("id").eq("user_id", ctx.userId).limit(1).maybeSingle(),
    supabaseAdmin
      .from("events")
      .select("id")
      .eq("event_type", "order_placed")
      .eq("entity_id", ctx.clinicId)
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    survey: row?.onboarding_survey ?? null,
    submitted_at: row?.onboarding_survey_at ?? null,
    onboarding_progress: {
      gdc_document: Boolean(gdcDoc.data),
      supplier_connected: Boolean(cred.data || conn.data),
      first_order: Boolean(orderEvt.data),
    },
  });
}

export async function POST(request: Request) {
  const id = await clinicContextFromRequest(request);
  if ("error" in id) return NextResponse.json({ error: id.error }, { status: id.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const keys = new Set(Object.keys(body));

  const touches =
    keys.has("spend") ||
    keys.has("chairs") ||
    keys.has("pains") ||
    keys.has("suppliers") ||
    keys.has("connect_targets");
  if (!touches) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  const { data: row, error: readErr } = await supabaseAdmin
    .from("clinic_accounts")
    .select("onboarding_survey")
    .eq("id", id.clinicId)
    .maybeSingle();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const prevRaw = row?.onboarding_survey;
  const prev =
    prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw) ? (prevRaw as Record<string, unknown>) : {};

  const prevSpend = typeof prev.spend === "string" ? prev.spend : null;
  const spend =
    keys.has("spend") && typeof body.spend === "string" ? body.spend.trim().slice(0, 80) || null : prevSpend;

  const prevChairs = typeof prev.chairs === "string" ? prev.chairs : null;
  const chairs =
    keys.has("chairs") && typeof body.chairs === "string" ? body.chairs.trim().slice(0, 32) || null : prevChairs;

  const pains = keys.has("pains") ? clampStrings(body.pains, 24, 240) : asStringArray(prev.pains);
  const suppliers = keys.has("suppliers") ? clampStrings(body.suppliers, 32, 120) : asStringArray(prev.suppliers);

  const rawConnect = keys.has("connect_targets") ? clampStrings(body.connect_targets, 12, 120) : asStringArray(prev.connect_targets);
  const connect_targets = rawConnect.filter((s) => ONBOARDING_CONNECT_SUPPLIER_SET.has(s));

  const survey = {
    spend,
    pains,
    suppliers,
    chairs,
    connect_targets,
  };

  const { error } = await supabaseAdmin
    .from("clinic_accounts")
    .update({
      onboarding_survey: survey,
      onboarding_survey_at: new Date().toISOString(),
    })
    .eq("id", id.clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent({
    event_type: "onboarding_survey_saved",
    entity_type: "clinic",
    entity_id: id.clinicId,
    payload: {
      spend: survey.spend,
      chairs: survey.chairs,
      pain_count: pains.length,
      supplier_count: suppliers.length,
      connect_targets_count: connect_targets.length,
    },
    source: "clinic_survey_api",
  });

  return NextResponse.json({ ok: true, survey });
}
