import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

// POST — create or resume a chat session
export async function POST(request: Request) {
  const { visitor_id, page_url, email, name } = await request.json();
  if (!visitor_id) return NextResponse.json({ error: "visitor_id required" }, { status: 400 });

  // Resume existing open session for this visitor if within 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from("chat_sessions")
    .select("id")
    .eq("visitor_id", visitor_id)
    .eq("status", "open")
    .gte("last_message_at", cutoff)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return NextResponse.json({ session_id: existing.id });

  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .insert({ visitor_id, page_url: page_url ?? null, email: email ?? null, name: name ?? null })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session_id: data.id }, { status: 201 });
}

// GET — list sessions (admin, uses OS cookie auth)
export async function GET(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";

  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .select("*")
    .eq("status", status)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
