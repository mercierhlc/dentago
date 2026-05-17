import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { welcomeEmail } from "@/emails/welcome";
import { ensureClinicProfileForAdmin } from "@/lib/sync-clinic-profile-for-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * For users who already have a Supabase session (e.g. Google OAuth) but no
 * `clinic_accounts` row yet — creates the tenant row so `/api/clinic/me` works.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const {
    data: { user },
    error: authErr,
  } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const clinic_name = typeof body?.clinic_name === "string" ? body.clinic_name.trim() : "";
  if (clinic_name.length < 2) {
    return NextResponse.json({ error: "Practice name is required (at least 2 characters)." }, { status: 400 });
  }

  const { data: existing, error: exErr } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  if (existing?.id) {
    return NextResponse.json({ error: "Workspace already exists for this account." }, { status: 409 });
  }

  const email = (user.email ?? "").trim() || "unknown@dentago.invalid";

  const { data: row, error: insErr } = await supabaseAdmin
    .from("clinic_accounts")
    .insert({
      auth_user_id: user.id,
      clinic_name,
      email,
    })
    .select("id, clinic_name, email, product_plan")
    .maybeSingle();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });

  const profileSync = await ensureClinicProfileForAdmin(supabaseAdmin, {
    authUserId: user.id,
    practiceName: clinic_name,
  });
  if (!profileSync.ok) {
    await supabaseAdmin.from("clinic_accounts").delete().eq("id", (row as { id: string }).id);
    return NextResponse.json(
      { error: `Workspace created but admin profile sync failed: ${profileSync.message}` },
      { status: 500 },
    );
  }

  const planRaw = (row as { product_plan?: string | null }).product_plan;
  const product_plan = planRaw === "pro" ? "pro" : "free";

  // Send welcome email — fire and forget, don't block the response
  if (email && !email.includes("dentago.invalid")) {
    const firstName = email.split("@")[0].split(".")[0];
    const { subject, html } = welcomeEmail({ name: firstName, practiceName: clinic_name });
    void resend.emails.send({
      from: "Dentago <support@dentago.co.uk>",
      to: email,
      subject,
      html,
    });
  }

  return NextResponse.json({
    clinic: {
      id: row.id,
      clinic_name: row.clinic_name,
      email: row.email,
      product_plan,
    },
  });
}
