import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const FIELDS = 'id, email, practice_name, status, total_messages_sent, last_contacted_at, last_replied_at, location, notes';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filterStatus = searchParams.get('status') ?? '';
  const search       = searchParams.get('search') ?? '';

  const [countRes, repliedRes, topRes] = await Promise.all([
    // Total counts by status (all contacts)
    supabaseAdmin.from('contacts').select('status, total_messages_sent', { count: 'exact' }),
    // Always fetch replied/demo contacts first regardless of messages sent
    supabaseAdmin
      .from('contacts')
      .select(FIELDS)
      .in('status', ['replied', 'demo_booked', 'interested', 'warm', 'client'])
      .order('last_replied_at', { ascending: false, nullsFirst: false }),
    // Top by messages sent (cold outreach base)
    supabaseAdmin
      .from('contacts')
      .select(FIELDS)
      .order('total_messages_sent', { ascending: false })
      .limit(800),
  ]);

  const allCounts = countRes.data ?? [];
  const statusCounts: Record<string, number> = {};
  let totalSent = 0;
  for (const c of allCounts) {
    const s = (c as { status: string; total_messages_sent: number }).status ?? 'cold';
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    totalSent += (c as { total_messages_sent: number }).total_messages_sent ?? 0;
  }

  // Merge: replied contacts first, then top-by-sent (dedup by id)
  const seen = new Set<string>();
  const merged: typeof repliedRes.data = [];
  for (const c of [...(repliedRes.data ?? []), ...(topRes.data ?? [])]) {
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
  }

  // Apply filters server-side for this combined list
  let filtered = merged;
  if (filterStatus) filtered = filtered.filter(c => c.status === filterStatus);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(c =>
      c.email?.toLowerCase().includes(q) ||
      c.practice_name?.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    totals: {
      contacts: countRes.count ?? allCounts.length,
      emails_sent: totalSent,
      by_status: statusCounts,
    },
    top_contacts: filtered,
  });
}
