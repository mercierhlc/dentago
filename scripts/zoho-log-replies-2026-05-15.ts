/**
 * Zoho Mail — Log all inbox replies to Supabase CRM
 * Run: npx tsx scripts/zoho-log-replies-2026-05-15.ts
 *
 * What it does:
 * 1. Fetches all 200 inbox messages from Zoho
 * 2. Classifies: real replies | auto-replies | unsubscribes | system
 * 3. Upserts contacts + logs inbound messages for real replies and unsubscribes
 * 4. Marks unsubscribers as marketing_opt_out=true
 * 5. Updates contacts: last_replied_at, status
 * 6. Logs to OS
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.join(process.env.HOME!, "dentago", ".env"));
loadEnv(path.join(process.env.HOME!, "dentago", ".env.local"));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dentago.co.uk";
const ACCOUNT_ID = "3272960000000008002";
const FOLDER_ID = "3272960000000008014";

const AUTO_REPLY_KEYWORDS = [
  "automatic reply", "auto reply", "auto-reply", "out of office",
  "out of the office", "away from", "on holiday", "on leave",
  "annual leave", "maternity leave", "be back", "returning on",
  "will be back", "currently unavailable", "not in the office",
  "i am out", "vacation", "noreply", "no-reply", "mailer-daemon",
  "delivery status", "undeliverable",
];
const UNSUB_KEYWORDS = [
  "unsubscribe", "opt out", "remove me", "please remove",
  "stop emailing", "do not contact", "no longer wish", "take me off",
];
const SYSTEM_KEYWORDS = [
  "dmarc", "spf", "dkim", "report domain", "mail delivery", "postmaster",
  "bounce", "fondo", "anthropic", "calendly", "stripe", "rippling",
  "hightouch", "hunter.io", "zoominfo", "freshdesk", "uhbw.nhs",
  "nhs.scot", "ggc.press", "tesco.com", "zohocalendar.com",
];

async function getAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    }).toString();

    const req = https.request(
      "https://accounts.zoho.com/oauth/v2/token",
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const d = JSON.parse(data);
          if (d.access_token) resolve(d.access_token);
          else reject(new Error("No access token: " + JSON.stringify(d)));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function zohoGet(token: string, path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://mail.zoho.com${path}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve({}); }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function classify(msg: Record<string, string>): "real" | "auto" | "unsub" | "system" {
  const frm = (msg.fromAddress || "").toLowerCase();
  const subj = (msg.subject || "").toLowerCase();
  const summary = (msg.summary || "").toLowerCase();
  const combined = `${frm} ${subj} ${summary}`;

  if (SYSTEM_KEYWORDS.some((k) => combined.includes(k))) return "system";
  if (UNSUB_KEYWORDS.some((k) => combined.includes(k))) return "unsub";
  if (AUTO_REPLY_KEYWORDS.some((k) => combined.includes(k))) return "auto";
  return "real";
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  return local
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function main() {
  console.log("\n📬 Zoho Mail — logging all replies to CRM\n");

  const token = await getAccessToken();
  console.log("✅ Access token obtained");

  // Fetch inbox
  const result = (await zohoGet(
    token,
    `/api/accounts/${ACCOUNT_ID}/messages/view?folderId=${FOLDER_ID}&start=1&limit=200`
  )) as { data?: Record<string, string>[] };
  const msgs = result.data ?? [];
  console.log(`📥 ${msgs.length} messages fetched from inbox`);

  const real: Record<string, string>[] = [];
  const auto: Record<string, string>[] = [];
  const unsubs: Record<string, string>[] = [];
  let systemCount = 0;

  for (const m of msgs) {
    const cls = classify(m);
    if (cls === "real") real.push(m);
    else if (cls === "auto") auto.push(m);
    else if (cls === "unsub") unsubs.push(m);
    else systemCount++;
  }

  console.log(`\n  Real replies:  ${real.length}`);
  console.log(`  Auto-replies:  ${auto.length}`);
  console.log(`  Unsubscribes:  ${unsubs.length}`);
  console.log(`  System/other:  ${systemCount}\n`);

  let logged = 0;

  // === Log real replies ===
  for (const m of real) {
    const email = m.fromAddress;
    const name = nameFromEmail(email);
    const subject = m.subject || "";
    const body = (m.summary || "").slice(0, 2000);
    const receivedAt = m.receivedTime
      ? new Date(parseInt(m.receivedTime)).toISOString()
      : new Date().toISOString();

    // Upsert contact
    const { data: contact } = await supabase
      .from("contacts")
      .upsert(
        {
          email,
          name,
          status: "replied",
          last_replied_at: receivedAt,
          source: "inbound-zoho",
        },
        { onConflict: "email", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (contact) {
      // Check if already logged (by zoho messageId)
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("metadata->>zoho_message_id", m.messageId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("messages").insert({
          contact_id: contact.id,
          channel: "email",
          direction: "inbound",
          subject,
          body,
          status: "received",
          metadata: {
            zoho_message_id: m.messageId,
            reply_type: "real",
            folder_id: FOLDER_ID,
          },
          sent_at: receivedAt,
        });
        await supabase.from("events").insert({
          event_type: "reply_received",
          entity_type: "contact",
          entity_id: contact.id,
          payload: { email, subject, reply_type: "real", zoho_message_id: m.messageId },
          metrics: {},
          kpi_impact: {},
          source: "zoho_sync",
        });
        logged++;
        console.log(`✅ Real reply logged: ${email} — "${subject.slice(0, 50)}"`);
      } else {
        console.log(`⏭️  Already logged: ${email}`);
      }
    }
  }

  // === Log unsubscribes ===
  for (const m of unsubs) {
    const email = m.fromAddress;
    const name = nameFromEmail(email);
    const receivedAt = m.receivedTime
      ? new Date(parseInt(m.receivedTime)).toISOString()
      : new Date().toISOString();

    const { data: contact } = await supabase
      .from("contacts")
      .upsert(
        {
          email,
          name,
          status: "unsubscribed",
          marketing_opt_out: true,
          last_replied_at: receivedAt,
          source: "inbound-zoho",
        },
        { onConflict: "email", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (contact) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("metadata->>zoho_message_id", m.messageId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("messages").insert({
          contact_id: contact.id,
          channel: "email",
          direction: "inbound",
          subject: m.subject || "Unsubscribe",
          body: (m.summary || "Unsubscribe request").slice(0, 500),
          status: "received",
          metadata: { zoho_message_id: m.messageId, reply_type: "unsubscribe" },
          sent_at: receivedAt,
        });
        await supabase.from("events").insert({
          event_type: "unsubscribe",
          entity_type: "contact",
          entity_id: contact.id,
          payload: { email, reply_type: "unsubscribe", zoho_message_id: m.messageId },
          metrics: {},
          kpi_impact: {},
          source: "zoho_sync",
        });
        logged++;
        console.log(`🚫 Unsubscribe logged: ${email}`);
      }
    }
  }

  // === Log auto-replies (just contacts, no message spam) ===
  let autoLogged = 0;
  for (const m of auto) {
    const email = m.fromAddress;
    if (!email || email.includes("nhs.net") || email.includes("nhs.scot")) continue;

    // Just ensure contact exists
    await supabase
      .from("contacts")
      .upsert(
        { email, name: nameFromEmail(email), source: "inbound-auto-reply" },
        { onConflict: "email", ignoreDuplicates: true }
      );
    autoLogged++;
  }
  console.log(`\n📋 Auto-reply contacts ensured: ${autoLogged}`);

  // === OS log ===
  const osSummary = {
    summary: `Zoho inbox sync: ${real.length} real replies, ${unsubs.length} unsubscribes, ${auto.length} auto-replies logged to CRM. ${logged} new entries.`,
    decisions_made: [
      { decision: "Log all Zoho replies to Supabase CRM", rationale: "Single source of truth for all contact interactions" },
    ],
    work_completed: [
      { task: "Zoho inbox sync", result: `${real.length} real replies logged, ${unsubs.length} unsubscribes marked, ${autoLogged} auto-reply contacts captured` },
    ],
    open_loops: [
      { task: "Reply to real dental replies", blocker: "None", next_action: "Craft personalised replies via Zoho API" },
    ],
    outreach_count: 0,
  };
  const osBody = JSON.stringify(osSummary);
  await new Promise<void>((resolve) => {
    const req = https.request(
      `${SITE_URL}/api/os/log-context`,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(osBody) } },
      (res) => { res.resume(); res.on("end", resolve); }
    );
    req.on("error", () => resolve());
    req.write(osBody);
    req.end();
  });

  console.log(`\n${"═".repeat(55)}`);
  console.log(`  Real replies logged: ${real.length}`);
  console.log(`  Unsubscribes:        ${unsubs.length}`);
  console.log(`  New CRM entries:     ${logged}`);
  console.log(`  Auto contacts:       ${autoLogged}`);
  console.log(`${"═".repeat(55)}\n`);
}

main().catch(console.error);
