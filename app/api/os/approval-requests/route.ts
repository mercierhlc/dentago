import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import { logEvent } from '@/lib/events';

const NOTIFY =
  process.env.OS_APPROVAL_NOTIFY_EMAIL ??
  process.env.FOUNDER_NOTIFY_EMAIL ??
  'mercier@dentago.co.uk';

async function notifyFounder(title: string, id: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    const resend = new Resend(key);
    const origin =
      (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dentago.co.uk").replace(/\/$/, "");
    await resend.emails.send({
      from: 'Dentago OS <notifications@dentago.co.uk>',
      to: NOTIFY,
      subject: `[OS Approvals] ${title}`,
      html: `<p>A new approval request needs your review.</p>
<p><strong>${escapeHtml(title)}</strong></p>
<p><a href="${origin}/os">Open OS dashboard → Approvals tab</a></p>
<p style="color:#64748b;font-size:12px;">Request id: ${id}</p>`,
    });
  } catch (e) {
    console.error('[approval-requests] email notify failed', e);
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let q = supabaseAdmin
    .from('os_approval_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status && status !== 'all') {
    q = q.eq('status', status);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const question_text =
    typeof body.question_text === 'string' ? body.question_text.trim() : '';
  const proposed_action =
    typeof body.proposed_action === 'string' ? body.proposed_action.trim() : null;
  const created_by =
    typeof body.created_by === 'string' ? body.created_by.trim() : 'agent';
  const context_json =
    body.context_json && typeof body.context_json === 'object'
      ? body.context_json
      : {};

  if (!title || !question_text) {
    return NextResponse.json(
      { error: 'title and question_text required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('os_approval_requests')
    .insert({
      title,
      question_text,
      proposed_action,
      context_json,
      created_by,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const id = data!.id as string;

  await logEvent({
    event_type: 'os_approval_requested',
    entity_type: 'os_approval',
    entity_id: id,
    payload: { title, created_by },
    source: 'os_approval_api',
  });

  await notifyFounder(title, id);

  return NextResponse.json({ ok: true, id });
}
