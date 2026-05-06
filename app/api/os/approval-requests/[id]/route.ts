import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logEvent } from '@/lib/events';

const ALLOWED = new Set(['approved', 'rejected', 'resolved']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const status = typeof body.status === 'string' ? body.status.trim() : '';
  const resolution_notes =
    typeof body.resolution_notes === 'string' ? body.resolution_notes.trim() : null;

  if (!ALLOWED.has(status)) {
    return NextResponse.json(
      { error: 'status must be approved | rejected | resolved' },
      { status: 400 }
    );
  }

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('os_approval_requests')
    .select('id, title, status')
    .eq('id', id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (row.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only pending requests can be updated' },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from('os_approval_requests')
    .update({
      status,
      resolution_notes,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    event_type: 'os_approval_resolved',
    entity_type: 'os_approval',
    entity_id: id,
    payload: {
      title: row.title,
      resolution: status,
      resolution_notes,
    },
    source: 'os_approval_api',
  });

  return NextResponse.json({ ok: true });
}
