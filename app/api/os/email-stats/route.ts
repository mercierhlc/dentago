import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/os/email-stats
 *
 * Returns per-template and per-batch email statistics derived from:
 *   - events table  (outreach_sent events, with template + batch in payload)
 *   - messages table (outbound email rows, metadata.template + metadata.batch)
 *   - contacts table (status, last_replied_at — used for reply rate)
 *
 * Response shape:
 * {
 *   totals: { sent: number; replies: number; reply_rate: number; batches: number }
 *   by_template: Array<{ template_id; label; sent; replies; reply_rate; last_used }>
 *   by_batch:    Array<{ batch; template_id; sent; date }>
 *   recent_batches: last 10 batches with counts
 * }
 */
export async function GET() {
  // 1. Outbound messages with template metadata
  const { data: messages, error: msgErr } = await supabaseAdmin
    .from("messages")
    .select("id, metadata, sent_at, contact_id")
    .eq("direction", "outbound")
    .eq("channel", "email")
    .order("sent_at", { ascending: false });

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  // 2. Contacts with replies (last_replied_at is set when a reply comes in)
  const { data: contacts, error: contactErr } = await supabaseAdmin
    .from("contacts")
    .select("id, last_replied_at, status");

  if (contactErr) return NextResponse.json({ error: contactErr.message }, { status: 500 });

  const repliedContactIds = new Set(
    (contacts ?? [])
      .filter((c: { last_replied_at: string | null }) => Boolean(c.last_replied_at))
      .map((c: { id: string }) => c.id)
  );

  // 3. Aggregate by template
  const templateMap = new Map<
    string,
    { label: string; sent: number; replies: number; last_used: string | null }
  >();

  const batchMap = new Map<
    string,
    { template_id: string; sent: number; date: string | null }
  >();

  for (const msg of messages ?? []) {
    const meta = (msg.metadata ?? {}) as Record<string, string | number | null>;
    const templateId = (meta.template as string) || "unknown";
    const batch      = (meta.batch as string)    || "unknown";
    const hasReply   = repliedContactIds.has(msg.contact_id as string);
    const sentAt     = msg.sent_at as string | null;

    // Template aggregation
    if (!templateMap.has(templateId)) {
      templateMap.set(templateId, { label: friendlyLabel(templateId), sent: 0, replies: 0, last_used: null });
    }
    const t = templateMap.get(templateId)!;
    t.sent++;
    if (hasReply) t.replies++;
    if (!t.last_used || (sentAt && sentAt > t.last_used)) t.last_used = sentAt;

    // Batch aggregation
    if (!batchMap.has(batch)) {
      batchMap.set(batch, { template_id: templateId, sent: 0, date: null });
    }
    const b = batchMap.get(batch)!;
    b.sent++;
    if (!b.date || (sentAt && sentAt > b.date)) b.date = sentAt;
  }

  const totalSent    = [...templateMap.values()].reduce((s, t) => s + t.sent, 0);
  const totalReplies = [...templateMap.values()].reduce((s, t) => s + t.replies, 0);

  const byTemplate = [...templateMap.entries()]
    .map(([template_id, t]) => ({
      template_id,
      label: t.label,
      sent: t.sent,
      replies: t.replies,
      reply_rate: t.sent > 0 ? Math.round((t.replies / t.sent) * 1000) / 10 : 0,
      last_used: t.last_used,
    }))
    .sort((a, b) => b.sent - a.sent);

  const byBatch = [...batchMap.entries()]
    .map(([batch, b]) => ({
      batch,
      template_id: b.template_id,
      sent: b.sent,
      date: b.date,
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return NextResponse.json({
    totals: {
      sent: totalSent,
      replies: totalReplies,
      reply_rate: totalSent > 0 ? Math.round((totalReplies / totalSent) * 1000) / 10 : 0,
      batches: batchMap.size,
    },
    by_template: byTemplate,
    by_batch: byBatch.slice(0, 10),
  });
}

function friendlyLabel(templateId: string): string {
  const map: Record<string, string> = {
    "200-clinics-v1":       "200 Clinics — WhatsApp CTA",
    "followup-v1":          "Follow-up (generic)",
    "improved-joanne-v1":   "Joanne — Free + personalised city",
    "FollowUp-Merged":      "Follow-up (merged batch)",
    "Cold-ImprovedJoanne":  "Joanne cold",
    "unknown":              "Unknown / untagged",
  };
  return map[templateId] ?? templateId;
}
