import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id, clinic_name, email")
    .eq("auth_user_id", user.id)
    .single();

  return NextResponse.json({ clinic });
}
