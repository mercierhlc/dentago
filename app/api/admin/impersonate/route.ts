import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ADMIN_PASSWORD = "dentago-admin-2024";

export async function POST(request: Request) {
  const { clinicId, password } = await request.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId required" }, { status: 400 });
  }

  // clinicId is the auth user id (from clinic_profiles) — look up their email directly
  const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(clinicId);

  if (userError || !user?.email) {
    console.error("User lookup error:", userError);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Generate a one-time magic link for this user
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });

  if (error || !data?.properties?.action_link) {
    console.error("Supabase generateLink error:", error, "data:", JSON.stringify(data));
    return NextResponse.json({ error: error?.message ?? "Failed to generate link", detail: JSON.stringify(data) }, { status: 500 });
  }

  return NextResponse.json({ link: data.properties.action_link });
}
