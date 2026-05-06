import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const event_type = searchParams.get("event_type");
  const entity_type = searchParams.get("entity_type");

  let query = supabaseAdmin
    .from("events")
    .select("id, event_type, entity_type, entity_id, source, payload, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (event_type) query = query.eq("event_type", event_type);
  if (entity_type) query = query.eq("entity_type", entity_type);

  const { data: events, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: events ?? [], total: count ?? 0 });
}
