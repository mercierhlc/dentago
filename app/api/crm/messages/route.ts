import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logEvent } from '@/lib/events';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get('contact_id');
  const channel = searchParams.get('channel') ?? '';

  let query = supabaseAdmin
    .from('messages')
    .select('*')
    .order('sent_at', { ascending: true });

  if (contactId) query = query.eq('contact_id', contactId);
  if (channel) query = query.eq('channel', channel);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { contact_id, channel, subject, message_body, direction = 'outbound' } = body;

  if (!contact_id || !channel || !message_body) {
    return NextResponse.json({ error: 'contact_id, channel, message_body required' }, { status: 400 });
  }

  // Fetch contact
  const { data: contact, error: contactErr } = await supabaseAdmin
    .from('contacts').select('*').eq('id', contact_id).single();
  if (contactErr || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  let metadata: Record<string, unknown> = {};
  let status = 'sent';

  // Send via appropriate channel
  if (channel === 'email' && direction === 'outbound') {
    if (!contact.email) return NextResponse.json({ error: 'Contact has no email' }, { status: 400 });
    try {
      const result = await resend.emails.send({
        from: 'Mercier at Dentago <mercier@dentago.co.uk>',
        to: contact.email,
        subject: subject ?? 'Following up from Dentago',
        text: message_body,
      });
      metadata = { resend_id: result.data?.id };
      status = 'sent';
    } catch (e) {
      status = 'failed';
      metadata = { error: String(e) };
    }
  }

  if (channel === 'whatsapp' && direction === 'outbound') {
    // Placeholder — connect Twilio or 360dialog API here
    // const result = await twilio.messages.create({ to: `whatsapp:${contact.whatsapp_id}`, from: 'whatsapp:+...' , body: message_body });
    status = 'sent';
    metadata = { note: 'WhatsApp API not yet connected — message queued' };
  }

  // Save message
  const { data: msg, error: msgErr } = await supabaseAdmin
    .from('messages')
    .insert({
      contact_id,
      channel,
      direction,
      subject,
      body: message_body,
      status,
      metadata,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  // Update contact last_contacted_at
  await supabaseAdmin.from('contacts').update({
    last_contacted_at: new Date().toISOString(),
    last_message_preview: message_body.slice(0, 100),
    total_messages_sent: (contact.total_messages_sent ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', contact_id);

  // Log to OS events
  if (direction === 'outbound') {
    await logEvent({
      event_type: 'outreach_sent',
      entity_type: 'contact',
      entity_id: String(contact_id),
      payload: {
        email: contact.email,
        channel,
        subject,
        status,
        resend_id: (metadata as Record<string, unknown>)?.resend_id ?? null,
      },
      source: 'crm_messages_api',
    });
  }

  return NextResponse.json({ data: msg });
}
