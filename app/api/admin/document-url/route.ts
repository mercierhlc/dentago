import { NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { path } = await request.json()
  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(path, 3600)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
