import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const id = searchParams.get('id');

  // Single note fetch
  if (id) {
    const { data, error } = await supabaseAdmin
      .from('workspace_notes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return NextResponse.json({ data: null });
    return NextResponse.json({ data });
  }

  // List with optional filters
  const isTodos = category === 'To-Dos';
  let query = supabaseAdmin
    .from('workspace_notes')
    .select('id, title, category, subcategory, tags, word_count, updated_at, content, week_number')
    .order('category', { ascending: true });

  if (isTodos) {
    query = query.order('week_number', { ascending: true, nullsFirst: false });
  } else {
    query = query.order('title', { ascending: true });
  }

  if (category && category !== 'All') query = query.eq('category', category);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ data: [], categories: [] });

  // Category counts
  const { data: cats } = await supabaseAdmin
    .from('workspace_notes')
    .select('category');

  const counts: Record<string, number> = {};
  for (const r of cats ?? []) counts[r.category] = (counts[r.category] ?? 0) + 1;
  const categories = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json({ data: data ?? [], categories });
}

export async function PATCH(req: Request) {
  const { id, content } = await req.json();
  if (!id || content === undefined) return NextResponse.json({ error: 'id and content required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('workspace_notes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
