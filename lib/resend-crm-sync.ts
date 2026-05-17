/**
 * Pull all outbound sends from Resend and upsert contacts + messages in Supabase CRM.
 * Used by scripts/sync-resend-contacts.ts and /api/cron/sync-resend-contacts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface ResendEmail {
  id: string;
  to: string[];
  from: string;
  subject: string;
  created_at: string;
  last_event: string;
}

export interface ResendCrmSyncResult {
  resendEmailsFetched: number;
  uniqueRecipients: number;
  contactsUpserted: number;
  messagesInserted: number;
}

function statusFromEvent(ev: string): string {
  if (ev === "bounced" || ev === "complained") return "bounced";
  if (ev === "clicked") return "clicked";
  if (ev === "opened") return "opened";
  if (ev === "delivered") return "cold";
  return "cold";
}

function mergeStatus(existing: string | null, incoming: string): string {
  const rank: Record<string, number> = {
    replied: 6,
    demo: 7,
    converted: 8,
    clicked: 4,
    opened: 3,
    warm: 5,
    cold: 2,
    bounced: 1,
    unknown: 0,
  };
  const e = rank[existing ?? "unknown"] ?? 0;
  const i = rank[incoming] ?? 0;
  return i > e ? incoming : (existing ?? incoming);
}

function extractClinicFromSubject(subject: string, email: string): string {
  const domain = email.split("@")[1] ?? "";
  const domainName = domain
    .replace(/\.(co\.uk|com|org|net|io|fr|de|ch|nl|be|es|it|pt|se|dk|no|fi|au|nz|ca)$/i, "")
    .replace(/^www\./, "");
  return (
    domainName.split(/[.\-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || email
  );
}

async function fetchAllResendEmails(resendKey: string): Promise<ResendEmail[]> {
  const all: ResendEmail[] = [];
  let cursor: string | null = null;

  for (;;) {
    const url = `https://api.resend.com/emails?limit=100${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${resendKey}` } });
    if (!res.ok) {
      throw new Error(`Resend list failed: ${res.status} ${await res.text()}`);
    }
    const j = (await res.json()) as { data: ResendEmail[]; has_more?: boolean };
    all.push(...(j.data ?? []));
    const rows = j.data ?? [];
    if (!j.has_more || rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
  }
  return all;
}

/**
 * Upsert contacts/messages so /os Outreach matches Resend sending history.
 */
export async function syncResendContactsToCrm(
  supabase: SupabaseClient,
  resendApiKey: string,
  options?: {
    /** Called every CHUNK contacts for long runs (cron logs) */
    onProgress?: (line: string) => void;
  }
): Promise<ResendCrmSyncResult> {
  const emails = await fetchAllResendEmails(resendApiKey);
  const onProgress = options?.onProgress;

  const byEmail: Record<string, ResendEmail[]> = {};
  for (const e of emails) {
    const to = e.to[0]?.toLowerCase();
    if (!to) continue;
    if (!byEmail[to]) byEmail[to] = [];
    byEmail[to].push(e);
  }

  const uniqueEmails = Object.keys(byEmail);
  let contactsUpserted = 0;
  const CHUNK = 50;

  type ContactMini = {
    id: string;
    email: string;
    status: string | null;
    type: string | null;
    marketing_opt_out: boolean | null;
    total_messages_sent: number | null;
    last_contacted_at: string | null;
  };

  for (let i = 0; i < uniqueEmails.length; i += CHUNK) {
    const batch = uniqueEmails.slice(i, i + CHUNK);

    const { data: existing } = await supabase
      .from("contacts")
      .select("id, email, status, type, marketing_opt_out, total_messages_sent, last_contacted_at")
      .in("email", batch);

    const existingMap: Record<string, ContactMini> = {};
    for (const c of (existing ?? []) as ContactMini[]) {
      existingMap[c.email] = c;
    }

    const contactRows = batch.map((email) => {
      const sentEmails = byEmail[email];
      const bestEvent = sentEmails.reduce((best, ev) => {
        const rank: Record<string, number> = { clicked: 4, opened: 3, delivered: 2, bounced: 1 };
        return (rank[ev.last_event] ?? 0) > (rank[best] ?? 0) ? ev.last_event : best;
      }, "delivered");

      const ex = existingMap[email];
      const incomingStatus = statusFromEvent(bestEvent);
      let finalStatus = mergeStatus(ex?.status ?? null, incomingStatus);
      if (ex?.status === "client") finalStatus = "client";
      const contactType = ex?.type ?? "lead";
      const marketingOptOut = Boolean(ex?.marketing_opt_out);
      const latestSent = sentEmails.reduce(
        (latest, ev) => (ev.created_at > latest ? ev.created_at : latest),
        sentEmails[0].created_at
      );
      const clinicName = extractClinicFromSubject(sentEmails[0].subject, email);

      return {
        email,
        practice_name: clinicName,
        type: contactType,
        status: finalStatus,
        marketing_opt_out: marketingOptOut,
        source: "resend_sync",
        total_messages_sent: sentEmails.length,
        last_contacted_at: latestSent,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: ce } = await supabase.from("contacts").upsert(contactRows, { onConflict: "email" });
    if (ce) throw new Error(`contacts upsert: ${ce.message}`);
    contactsUpserted += contactRows.length;
    onProgress?.(`contacts ${Math.min(i + CHUNK, uniqueEmails.length)}/${uniqueEmails.length}`);
  }

  const contactIdMap: Record<string, string> = {};
  const ID_CHUNK = 200;
  for (let i = 0; i < uniqueEmails.length; i += ID_CHUNK) {
    const slice = uniqueEmails.slice(i, i + ID_CHUNK);
    const { data: idBatch, error: be } = await supabase.from("contacts").select("id, email").in("email", slice);
    if (be) throw new Error(`contact id fetch: ${be.message}`);
    for (const c of idBatch ?? []) {
      contactIdMap[(c as { email: string; id: string }).email] = (c as { id: string }).id;
    }
  }

  const messageRows = emails
    .filter((e) => e.to[0] && contactIdMap[e.to[0].toLowerCase()])
    .map((e) => ({
      contact_id: contactIdMap[e.to[0].toLowerCase()],
      channel: "email",
      direction: "outbound",
      subject: e.subject,
      body: "",
      status: e.last_event === "bounced" ? "failed" : "sent",
      resend_email_id: e.id,
      metadata: { last_event: e.last_event, from: e.from, sync: "resend_cron" },
      sent_at: e.created_at,
    }));

  let messagesInserted = 0;
  for (let i = 0; i < messageRows.length; i += CHUNK) {
    const batch = messageRows.slice(i, i + CHUNK);
    const { error: me, data: md } = await supabase
      .from("messages")
      .upsert(batch, { onConflict: "resend_email_id", ignoreDuplicates: true })
      .select("id");
    if (me) throw new Error(`messages upsert: ${me.message}`);
    messagesInserted += (md ?? batch).length;
    onProgress?.(`messages ${Math.min(i + CHUNK, messageRows.length)}/${messageRows.length}`);
  }

  return {
    resendEmailsFetched: emails.length,
    uniqueRecipients: uniqueEmails.length,
    contactsUpserted,
    messagesInserted,
  };
}
