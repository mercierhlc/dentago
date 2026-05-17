import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Fetch key Obsidian files via local REST API
async function fetchObsidianContext(): Promise<string> {
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiKey) return '';

  const filesToFetch = [
    'Dentago/Intelligence/OS — Architecture.md',
    'Dentago/CEO TODOs — 1 May 2026.md',
    'Dentago/CEO Review — 1 May 2026.md',
  ];

  // Also try to get the most recent daily briefing
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  filesToFetch.push(
    `Dentago/Intelligence/Daily Briefing — ${today}.md`,
    `Dentago/Intelligence/Daily Briefing — ${yesterday}.md`,
  );

  const results: string[] = [];

  await Promise.all(
    filesToFetch.map(async (filepath) => {
      try {
        const url = `http://localhost:27123/vault/${encodeURIComponent(filepath)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const text = await res.text();
          if (text.trim()) {
            results.push(`\n### Obsidian: ${filepath}\n${text.slice(0, 3000)}`);
          }
        }
      } catch {
        // Obsidian not running or file missing — skip silently
      }
    })
  );

  return results.join('\n\n');
}

export async function POST(request: Request) {
  const { query, context } = await request.json();

  // Pull all live data + Obsidian context in parallel
  const [
    clinicsRes,
    eventsRes,
    loopsRes,
    kpisRes,
    decisionsRes,
    credentialsCountRes,
    obsidianContext,
  ] = await Promise.all([
    supabaseAdmin
      .from('clinic_profiles')
      .select('id, created_at, status')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('events')
      .select('event_type, payload, metrics, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('loop_runs')
      .select('loop_name, status, kpis_measured, feedback_applied, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('kpi_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(7),
    supabaseAdmin
      .from('decisions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('supplier_credentials')
      .select('clinic_id, supplier_id', { count: 'exact', head: true }),
    fetchObsidianContext(),
  ]);

  // Break down clinics accurately by status
  const clinics = clinicsRes.data ?? [];
  const clinicsByStatus = clinics.reduce((acc: Record<string, number>, c: any) => {
    acc[c.status ?? 'unknown'] = (acc[c.status ?? 'unknown'] ?? 0) + 1;
    return acc;
  }, {});
  const approvedClinics = clinicsByStatus['approved'] ?? 0;
  const pendingClinics = clinicsByStatus['pending'] ?? 0;
  const rejectedClinics = clinicsByStatus['rejected'] ?? 0;

  const TEST_DOMAINS = ['example.com', 'test.com', 'test@', 'localhost'];
  const allEvents = eventsRes.data ?? [];
  const events = allEvents.filter((e: any) => {
    const id = (e.entity_id ?? '').toLowerCase();
    const payload = JSON.stringify(e.payload ?? '').toLowerCase();
    return !TEST_DOMAINS.some(d => id.includes(d) || payload.includes(d));
  });
  const orderEvents = events.filter((e: any) => e.event_type === 'order_placed');
  const totalGMV = orderEvents.reduce(
    (sum: number, e: any) => sum + (e.metrics?.order_value ?? e.payload?.order_value ?? 0),
    0
  );
  const demosBooked = events.filter((e: any) => e.event_type === 'demo_booked').length;
  const suppliersConnected = events.filter((e: any) => e.event_type === 'supplier_connected').length;
  const searchesPerformed = events.filter((e: any) => e.event_type === 'search_performed').length;

  const systemContext = `You are the Dentago AI Operating System — the single source of truth for the business.

Dentago is a B2B dental procurement marketplace for UK dental clinics. Free for clinics. Revenue from supplier commissions. Founder: Mercier (solo, technical). Target: 50 verified clinics by end of May 2026.

═══════════════════════════════════════
LIVE BUSINESS STATE — ${new Date().toISOString()}
═══════════════════════════════════════

CLINIC PIPELINE:
- Total signups (all statuses): ${clinics.length}
- ✅ Approved/verified: ${approvedClinics}
- ⏳ Pending review: ${pendingClinics}
- ❌ Rejected: ${rejectedClinics}
- Target: 50 approved by end May 2026

REVENUE:
- GMV logged: £${totalGMV.toFixed(2)}
- Orders placed: ${orderEvents.length}
- First GMV: ${orderEvents.length > 0 ? '✅ achieved' : '❌ not yet — this is the #1 priority'}

ENGAGEMENT:
- Demos booked: ${demosBooked}
- Supplier connections made: ${suppliersConnected}
- Searches performed: ${searchesPerformed}
- Supplier credentials in DB: ${credentialsCountRes.count ?? 0}

EVENTS (last 200, most recent first):
${JSON.stringify(events.slice(0, 60), null, 0)}

LOOP RUNS (last 50):
${JSON.stringify((loopsRes.data ?? []).slice(0, 15), null, 0)}

KPI SNAPSHOTS (last 7 days):
${JSON.stringify(kpisRes.data ?? [], null, 0)}

DECISIONS LOG (last 20):
${JSON.stringify(decisionsRes.data ?? [], null, 0)}

KPI TARGETS:
- Outreach reply rate ≥ 10%
- Demo conversion (reply → demo) ≥ 2%
- Time to verified after signup < 2h
- Auto-approval rate > 80%
- Activation (3 steps in 7 days) > 60%
- Supplier connection within 48h > 70%
- Second order within 14 days > 50%
- Clinics by end May: 50

═══════════════════════════════════════
OBSIDIAN CONTEXT (strategy docs, CEO notes, daily briefings)
═══════════════════════════════════════
${obsidianContext || '(Obsidian not running — start Obsidian to include strategy docs)'}

═══════════════════════════════════════
ADDITIONAL CONTEXT
═══════════════════════════════════════
${context ?? 'none'}

INSTRUCTIONS:
Answer with full business context. Be specific and use real numbers from the data above.
Distinguish between "total signups" (${clinics.length}) and "active/approved clinics" (${approvedClinics}) — they are different.
Flag missing data that would improve your answer. Flag open loops that need human action.
CRITICAL: Ignore any events or entities with test emails (example.com, test.com, test@*, localhost). These are development artifacts, not real leads. Never suggest action on test data.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemContext,
    messages: [{ role: 'user', content: query }],
  });

  const answer = response.content[0].type === 'text' ? response.content[0].text : '';

  // Log the query
  void supabaseAdmin.from('events').insert({
    event_type: 'intelligence_queried',
    payload: { query, answer_length: answer.length },
    source: 'api',
  });

  return NextResponse.json({
    answer,
    data_snapshot: {
      total_signups: clinics.length,
      approved_clinics: approvedClinics,
      pending_clinics: pendingClinics,
      rejected_clinics: rejectedClinics,
      gmv: totalGMV,
      orders: orderEvents.length,
      demos_booked: demosBooked,
    },
  });
}
