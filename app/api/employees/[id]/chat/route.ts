import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '50');

  const { data, error } = await supabaseAdmin
    .from('employee_messages')
    .select('*')
    .eq('employee_id', id)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  }

  // Fetch employee
  const { data: employee, error: empErr } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();

  if (empErr || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  // Save user message
  await supabaseAdmin.from('employee_messages').insert({
    employee_id: id,
    role: 'user',
    content: message,
  });

  // Fetch recent conversation history (last 20 messages for context)
  const { data: history } = await supabaseAdmin
    .from('employee_messages')
    .select('role, content')
    .eq('employee_id', id)
    .order('created_at', { ascending: true })
    .limit(20);

  const messages: Anthropic.MessageParam[] = (history ?? []).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Fetch live data from Supabase to give every employee full access
  const [osStateRes, contactsRes, recentMessagesRes, goalsRes, eventsRes, agentTasksRes] = await Promise.all([
    supabaseAdmin.from('os_state').select('category, state').order('updated_at', { ascending: false }),
    supabaseAdmin.from('contacts').select('id, email, name, practice_name, status, type, last_replied_at, last_message_preview, total_replies_received, total_messages_sent').order('last_replied_at', { ascending: false, nullsFirst: false }).limit(50),
    supabaseAdmin.from('messages').select('contact_id, channel, direction, subject, body, classification, suggested_response, sent_at').order('sent_at', { ascending: false }).limit(30),
    supabaseAdmin.from('goals').select('title, category, status, acceptance_criteria, approaches, failure_context').eq('status', 'active').order('priority', { ascending: true }).limit(20),
    supabaseAdmin.from('events').select('event_type, entity_id, payload, created_at').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('agent_tasks').select('title, status, worker_type, priority, qa_score').order('priority', { ascending: true }).limit(20),
  ]);

  const liveContext = `

## LIVE DENTAGO DATA (as of ${new Date().toISOString()})

### OS State
${JSON.stringify(Object.fromEntries((osStateRes.data ?? []).map(r => [r.category, r.state])), null, 2).slice(0, 1500)}

### CRM — Contacts (${contactsRes.data?.length ?? 0} most recent)
${JSON.stringify(contactsRes.data ?? [], null, 2).slice(0, 2000)}

### Recent Messages (last 30)
${JSON.stringify(recentMessagesRes.data ?? [], null, 2).slice(0, 1500)}

### Active Goals
${JSON.stringify(goalsRes.data ?? [], null, 2).slice(0, 1000)}

### Recent Events
${JSON.stringify(eventsRes.data ?? [], null, 2).slice(0, 800)}

### Agent Task Queue (top 20)
${JSON.stringify(agentTasksRes.data ?? [], null, 2).slice(0, 800)}

You have FULL READ ACCESS to all live Dentago data above. Use it to answer questions directly — never say you "don't have access".`;

  // Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: employee.system_prompt + liveContext,
    messages,
  });

  const replyText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Save assistant reply
  await supabaseAdmin.from('employee_messages').insert({
    employee_id: id,
    role: 'assistant',
    content: replyText,
    metadata: {
      model: response.model,
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
    },
  });

  // Update employee last_active_at
  await supabaseAdmin.from('employees').update({
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  return NextResponse.json({ reply: replyText });
}
