/**
 * POST /api/admin/delete-user
 * Hard-deletes a user from Supabase Auth and all related public tables.
 * Body: { userId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, getAdminIdentifier } from "@/lib/admin-auth";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { userId } = await request.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Snapshot email before deletion (for the audit log)
  let email: string | null = null;
  try {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = u?.user?.email ?? null;
  } catch {}

  // Clear all public-schema rows that reference this user.
  // Order matters: child rows before parent rows.
  const cleanups: Array<[string, string]> = [
    ["clinic_documents",   "user_id"],
    ["supplier_connections","user_id"],
    ["verification_audit", "clinic_id"],
    ["clinic_activity_log","clinic_id"],
    ["clinic_profiles",    "id"],
    ["clinic_accounts",    "auth_user_id"],
  ];

  for (const [table, col] of cleanups) {
    const { error } = await supabaseAdmin.from(table).delete().eq(col, userId);
    if (error && !error.message.includes("not exist") && !error.message.includes("no rows")) {
      console.warn(`[delete-user] cleanup ${table}.${col}:`, error.message);
    }
  }

  // Hard-delete from Supabase Auth
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  await logEvent({
    event_type: "feature_used",
    entity_type: "clinic",
    entity_id: userId,
    payload: {
      feature: "admin_delete_user",
      deleted_email: email,
      by: getAdminIdentifier(request),
    },
    source: "admin_delete_user",
  });

  return NextResponse.json({ ok: true });
}
