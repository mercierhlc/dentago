import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

// Simple in-memory rate limiter keyed by token — 10 requests per hour per token
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(token: string): boolean {
  const now = Date.now();
  const state = rateLimits.get(token);
  if (!state || now > state.resetAt) {
    rateLimits.set(token, { count: 1, resetAt: now + 3_600_000 });
    return false;
  }
  if (state.count >= 10) return true;
  state.count++;
  return false;
}

// POST /api/public/staff-request?token=xxx
// No auth — nurse submits item request via QR link
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid link" }, { status: 401 });
  }

  if (isRateLimited(token)) {
    return NextResponse.json({ error: "Too many requests — try again later" }, { status: 429 });
  }

  // Look up clinic by staff_request_token
  const { data: clinic, error: ce } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id, clinic_name")
    .eq("staff_request_token", token)
    .maybeSingle();

  if (ce || !clinic) {
    return NextResponse.json({ error: "Invalid link" }, { status: 401 });
  }

  const body = await request.json();
  const { product_id, product_name, quantity = 1, note, requester_name } = body;

  if (!product_name && !product_id) {
    return NextResponse.json({ error: "product_name required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("clinic_staff_requests")
      .insert({
        clinic_id: clinic.id,
        product_id: product_id ?? null,
        product_name: product_name ?? null,
        quantity: Math.max(1, parseInt(quantity) || 1),
        note: note ?? null,
        requester_name: requester_name ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[public/staff-request] insert error:", error.message);
      return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
    }

    await logEvent({
      event_type: "agent_task_claimed", // reuse closest type; staff_request_created would be ideal
      entity_type: "clinic",
      entity_id: clinic.id,
      payload: { request_id: data.id, product_name, requester_name },
      source: "staff_qr",
    });

    return NextResponse.json({ success: true, request_id: data.id }, { status: 201 });
  } catch (err) {
    console.error("[public/staff-request] unexpected:", err);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}

// GET /api/public/staff-request?token=xxx — validate token, return clinic name for welcome
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token || token.length < 10) {
    return NextResponse.json({ valid: false });
  }

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("clinic_name")
    .eq("staff_request_token", token)
    .maybeSingle();

  return NextResponse.json({ valid: !!clinic, clinic_name: clinic?.clinic_name ?? null });
}
