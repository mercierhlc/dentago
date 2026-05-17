import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/** Resolve clinic_accounts from Bearer JWT — same identity as other /api/clinic/* routes */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: clinic, error: ce } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id, clinic_name, email, product_plan")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
  if (!clinic) return NextResponse.json({ error: "No clinic account for this user" }, { status: 404 });

  const planRaw = (clinic as { product_plan?: string | null }).product_plan;
  const product_plan = planRaw === "pro" ? "pro" : "free";

  return NextResponse.json({
    clinic: {
      id: clinic.id,
      clinic_name: clinic.clinic_name,
      email: clinic.email,
      product_plan,
    },
  });
}

export async function PATCH(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const clinic_name = typeof body?.clinic_name === "string" ? body.clinic_name.trim() : null;

  if (!clinic_name || clinic_name.length < 2) {
    return NextResponse.json({ error: "clinic_name required" }, { status: 400 });
  }

  const { data: updated, error: ue } = await supabaseAdmin
    .from("clinic_accounts")
    .update({ clinic_name })
    .eq("auth_user_id", user.id)
    .select("id, clinic_name, email, product_plan")
    .maybeSingle();

  if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "No clinic account for this user" }, { status: 404 });

  const planRaw = (updated as { product_plan?: string | null }).product_plan;
  const product_plan = planRaw === "pro" ? "pro" : "free";

  return NextResponse.json({
    clinic: {
      id: updated.id,
      clinic_name: updated.clinic_name,
      email: updated.email,
      product_plan,
    },
  });
}
