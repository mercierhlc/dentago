import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, password, clinicName } = await request.json();

    if (!email || !password || !clinicName) {
      return NextResponse.json({ error: "Email, password and clinic name are required" }, { status: 400 });
    }

    // Create Supabase auth user
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? "Signup failed" }, { status: 400 });
    }

    // Create clinic_account row
    const { error: accountError } = await supabaseAdmin
      .from("clinic_accounts")
      .insert({
        auth_user_id: authData.user.id,
        clinic_name: clinicName,
        email,
      });

    if (accountError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Failed to create clinic account" }, { status: 500 });
    }

    return NextResponse.json({
      user: { id: authData.user.id, email },
      session: authData.session,
    }, { status: 201 });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
