import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { clinicId } = await request.json();

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId required" }, { status: 400 });
  }

  // clinicId is the auth user id (from clinic_profiles) — look up their email directly
  const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(clinicId);

  if (userError || !user?.email) {
    console.error("User lookup error:", userError);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin.replace(/\/$/, "");

  // Finish on /auth/complete so dentago_clinic + dentago_token match the new session
  const redirectTo = `${siteUrl}/auth/complete`;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    console.error("Supabase generateLink error:", error, "data:", JSON.stringify(data));
    return NextResponse.json({ error: error?.message ?? "Failed to generate link", detail: JSON.stringify(data) }, { status: 500 });
  }

  return NextResponse.json({ link: data.properties.action_link });
}
