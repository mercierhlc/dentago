import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);

async function clinicUserFromRequest(
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

/**
 * POST multipart/form-data: field `file` = GDC registration certificate.
 * Mirrors legacy `public/onboarding/step3.html`: upload to `documents` bucket,
 * then upsert `clinic_documents` on (user_id, document_type = gdc_registration).
 */
export async function POST(request: Request) {
  const ctx = await clinicUserFromRequest(request);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data with a `file` field" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  if (file.size <= 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Only PDF, JPG, or PNG files are accepted" }, { status: 400 });
  }

  const rawName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "certificate";
  const path = `${ctx.userId}/gdc_registration_${Date.now()}_${rawName}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabaseAdmin.storage.from("documents").upload(path, buf, {
    contentType: mime === "image/jpg" ? "image/jpeg" : mime,
  });

  if (upErr) {
    console.error("[gdc-document] storage upload:", upErr);
    return NextResponse.json({ error: upErr.message ?? "Upload failed" }, { status: 500 });
  }

  const { data: existing } = await supabaseAdmin
    .from("clinic_documents")
    .select("storage_path")
    .eq("user_id", ctx.userId)
    .eq("document_type", "gdc_registration")
    .maybeSingle();

  const oldPath = existing && typeof (existing as { storage_path?: string }).storage_path === "string"
    ? (existing as { storage_path: string }).storage_path
    : null;

  const { error: rowErr } = await supabaseAdmin
    .from("clinic_documents")
    .upsert(
      {
        user_id: ctx.userId,
        document_type: "gdc_registration",
        storage_path: path,
      },
      { onConflict: "user_id,document_type" },
    );

  if (rowErr) {
    console.error("[gdc-document] clinic_documents upsert:", rowErr);
    await supabaseAdmin.storage.from("documents").remove([path]).catch(() => {});
    return NextResponse.json({ error: rowErr.message ?? "Could not save document record" }, { status: 500 });
  }

  if (oldPath && oldPath !== path) {
    await supabaseAdmin.storage.from("documents").remove([oldPath]).catch(() => {});
  }

  await logEvent({
    event_type: "feature_used",
    entity_type: "clinic",
    entity_id: ctx.clinicId,
    payload: { feature: "gdc_certificate_onboarding_upload", storage_path: path, bytes: file.size, mime },
    source: "clinic_onboarding_gdc_api",
  });

  return NextResponse.json({ ok: true, storage_path: path });
}
