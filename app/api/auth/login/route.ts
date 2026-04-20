import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error || !data.user || !data.session) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Fetch clinic profile
    const { data: clinic } = await supabaseAdmin
      .from("clinic_accounts")
      .select("id, clinic_name, email")
      .eq("auth_user_id", data.user.id)
      .single();

    return NextResponse.json({
      session: data.session,
      clinic,
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
