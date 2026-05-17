/**
 * Resend Inbound Email Webhook
 *
 * Receives replies to Dentago outreach emails, classifies them with Claude,
 * and logs them to the OS events table.
 *
 * Setup (one-time in Resend dashboard):
 *   1. resend.com/domains → Add inbound domain → dentago.co.uk
 *   2. Add MX record to DNS: dentago.co.uk → inbound.resend.com (priority 10)
 *   3. Resend → Inbound → Set webhook URL: https://dentago.co.uk/api/inbox
 *
 * Every reply to mercier@dentago.co.uk then fires this webhook automatically.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logEvent } from '@/lib/events';
import { supabaseAdmin } from '@/lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function classifyReply(from: string, subject: string, body: string) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: `Classify this reply to a Dentago outreach email.
Dentago is a free B2B dental procurement marketplace for UK dental clinics.

Classifications:
- INTERESTED: wants to know more, book a demo, or try the product
- NOT_NOW: not right now, come back later, busy
- WRONG_PERSON: not the right contact, forwarding, not relevant to their role
- UNSUBSCRIBE: wants to be removed, stop emailing, opt out
- QUESTION: asking a specific question before committing

Return JSON only: { "classification": string, "confidence": number (0-1), "suggested_response": string (1-2 sentences max, founder tone, direct) }`,
    messages: [{
      role: 'user',
      content: `From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 1500)}`,
    }],
  });

  try {
    const text = res.content[0].type === 'text' ? res.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Resend inbound payload
    const from: string = body.from ?? body.sender ?? '';
    const subject: string = body.subject ?? '';
    const text: string = body.text ?? body.plain_text ?? '';
    const html: string = body.html ?? '';
    const emailBody = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const to: string = Array.isArray(body.to) ? body.to[0] : (body.to ?? '');

    if (!from || !emailBody) {
      return NextResponse.json({ error: 'Missing from or body' }, { status: 400 });
    }

    // Extract plain email address from "Name <email@domain.com>"
    const fromEmail = from.match(/<(.+)>/)?.[1] ?? from;

    console.log(`[inbox] Reply from: ${fromEmail} | Subject: ${subject}`);

    // Classify with Claude
    const classification = await classifyReply(fromEmail, subject, emailBody);

    // Upsert contact in CRM + save message
    const nameMatch = from.match(/^([^<]+)</);
    const { data: crmContact } = await supabaseAdmin
      .from('contacts')
      .upsert({
        email: fromEmail.toLowerCase(),
        name: nameMatch?.[1]?.trim() || undefined,
        type: 'lead',
        status: classification?.classification === 'INTERESTED' ? 'interested'
          : classification?.classification === 'UNSUBSCRIBE' ? 'unsubscribed'
          : 'warm',
        last_replied_at: new Date().toISOString(),
        last_contacted_at: new Date().toISOString(),
        last_message_preview: emailBody.slice(0, 100),
        source: 'resend_inbound',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' })
      .select('id, total_replies_received')
      .single();

    if (crmContact?.id) {
      await Promise.all([
        supabaseAdmin.from('messages').insert({
          contact_id: crmContact.id,
          channel: 'email',
          direction: 'inbound',
          subject,
          body: emailBody.slice(0, 5000),
          status: 'received',
          classification: classification?.classification ?? null,
          classification_confidence: classification?.confidence ?? null,
          suggested_response: classification?.suggested_response ?? null,
          metadata: { from, to, source: 'resend_inbound' },
          sent_at: new Date().toISOString(),
        }),
        supabaseAdmin.from('contacts').update({
          total_replies_received: (crmContact.total_replies_received ?? 0) + 1,
        }).eq('id', crmContact.id),
      ]);
    }

    // Log raw reply
    await logEvent({
      event_type: 'outreach_reply_received',
      entity_type: 'outreach',
      entity_id: fromEmail.toLowerCase(),
      payload: {
        from,
        from_email: fromEmail.toLowerCase(),
        subject,
        body_preview: emailBody.slice(0, 400),
        to,
      },
      source: 'resend_inbound',
    });

    // Log classification
    if (classification) {
      await logEvent({
        event_type: 'outreach_classified',
        entity_type: 'outreach',
        entity_id: fromEmail.toLowerCase(),
        payload: {
          from_email: fromEmail.toLowerCase(),
          subject,
          classification: classification.classification,
          confidence: classification.confidence,
          suggested_response: classification.suggested_response,
        },
        metrics: {
          is_interested: classification.classification === 'INTERESTED' ? 1 : 0,
          is_unsubscribe: classification.classification === 'UNSUBSCRIBE' ? 1 : 0,
        },
        source: 'resend_inbound',
      });

      console.log(`[inbox] Classified: ${classification.classification} (${Math.round(classification.confidence * 100)}%)`);
      console.log(`[inbox] Suggested: ${classification.suggested_response}`);
    }

    return NextResponse.json({ received: true, classification: classification?.classification ?? 'unknown' });
  } catch (err) {
    console.error('[inbox] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
