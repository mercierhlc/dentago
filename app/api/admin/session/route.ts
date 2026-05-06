import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getEffectiveAdminSecret,
  isAllowedAdminEmail,
  requireAdminAuth,
} from "@/lib/admin-auth";

const ADMIN_COOKIE_OPTS: {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax";
  path: string;
  maxAge: number;
} = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  path: "/",
  maxAge: 60 * 60 * 8,
};

/** Lightweight auth check for admin shell pages */
export async function GET(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;
  return NextResponse.json({ ok: true });
}

/**
 * Exchange a Supabase access_token (from signInWithPassword) for an httpOnly admin cookie.
 * Middleware + APIs continue to use admin-auth === effective secret.
 */
export async function POST(request: NextRequest) {
  let body: { access_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const access_token = typeof body.access_token === "string" ? body.access_token.trim() : "";
  if (!access_token) {
    return NextResponse.json({ error: "access_token required" }, { status: 400 });
  }

  const { data: userData, error } = await supabaseAdmin.auth.getUser(access_token);
  if (error || !userData?.user?.email) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  if (!isAllowedAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not an authorized admin account" }, { status: 403 });
  }

  const secret = getEffectiveAdminSecret();
  if (!secret) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin-auth", secret, ADMIN_COOKIE_OPTS);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("admin-auth");
  return response;
}
