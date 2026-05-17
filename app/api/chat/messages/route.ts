import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

// POST — visitor sends a message
export async function POST(request: Request) {
  const { session_id, content, role } = await request.json();
  if (!session_id || !content) {
    return NextResponse.json({ error: "session_id and content required" }, { status: 400 });
  }

  const msgRole = role === "agent" ? "agent" : "visitor";

  // Verify session exists
  const { data: session } = await supabaseAdmin
    .from("chat_sessions")
    .select("id, status")
    .eq("id", session_id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: msg, error } = await supabaseAdmin
    .from("chat_messages")
    .insert({ session_id, role: msgRole, content: content.trim() })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update last_message_at on session
  await supabaseAdmin
    .from("chat_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", session_id);

  // Log first visitor message as an event
  if (msgRole === "visitor") {
    await logEvent({
      event_type: "feature_used",
      entity_type: "chat",
      entity_id: session_id,
      payload: { message_preview: content.slice(0, 100) },
      source: "chat_widget",
    });
  }

  return NextResponse.json({ id: msg.id, created_at: msg.created_at });
}

// GET — fetch messages for a session (admin)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("*")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}
