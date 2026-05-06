import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { path } = await request.json()
  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(path, 3600)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
