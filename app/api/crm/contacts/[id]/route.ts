import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [contactRes, messagesRes] = await Promise.all([
    supabaseAdmin.from('contacts').select('*').eq('id', id).single(),
    supabaseAdmin.from('messages').select('*').eq('contact_id', id).order('sent_at', { ascending: true }),
  ]);

  if (contactRes.error) return NextResponse.json({ error: contactRes.error.message }, { status: 404 });
  return NextResponse.json({ contact: contactRes.data, messages: messagesRes.data ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
