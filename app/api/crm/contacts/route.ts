import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const type = searchParams.get('type') ?? '';
  const status = searchParams.get('status') ?? '';
  const channel = searchParams.get('channel') ?? '';
  const limit = parseInt(searchParams.get('limit') ?? '100');
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = supabaseAdmin
    .from('contacts')
    .select(`
      id, email, name, practice_name, phone, whatsapp_id, linkedin_url,
      type, status, tags, source, notes, location,
      last_contacted_at, last_replied_at, last_message_preview,
      total_messages_sent, total_replies_received, created_at
    `, { count: 'exact' })
    .order('last_contacted_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,practice_name.ilike.%${search}%`);
  }
  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);
  if (channel) {
    // filter contacts that have at least one message on this channel
    const { data: channelContacts } = await supabaseAdmin
      .from('messages').select('contact_id').eq('channel', channel);
    const ids = [...new Set((channelContacts ?? []).map(m => m.contact_id))];
    if (ids.length) query = query.in('id', ids);
    else return NextResponse.json({ data: [], count: 0 });
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], count });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, name, practice_name, phone, whatsapp_id, linkedin_url, type, status, source, notes, location, tags } = body;

  if (!email && !whatsapp_id) {
    return NextResponse.json({ error: 'email or whatsapp_id required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .upsert({
      email: email?.toLowerCase(),
      name, practice_name, phone, whatsapp_id, linkedin_url,
      type: type ?? 'lead',
      status: status ?? 'cold',
      source, notes, location,
      tags: tags ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
