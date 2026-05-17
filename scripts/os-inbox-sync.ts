/**
 * Inbox Sync — pipes email replies into the OS as structured events.
 *
 * Reads unread emails from Gmail matching Dentago outreach threads,
 * classifies them (INTERESTED / NOT_NOW / WRONG_PERSON / UNSUBSCRIBE / QUESTION),
 * logs each reply as outreach_reply_received + outreach_classified events,
 * and writes a summary to Obsidian.
 *
 * This closes the outreach loop — reply rate becomes a real-time OS metric.
 *
 * SETUP (one-time):
 *   1. Go to console.cloud.google.com → Create project → Enable Gmail API
 *   2. Create OAuth 2.0 credentials (Desktop app) → Download as credentials.json
 *   3. Place credentials.json in ~/dentago/scripts/gmail-credentials.json
 *   4. Run once to authenticate: npx tsx scripts/os-inbox-sync.ts --auth
 *   5. Then run normally or add to cron
 *
 * Run:
 *   npx tsx scripts/os-inbox-sync.ts --auth    # first time only
 *   npx tsx scripts/os-inbox-sync.ts           # sync new replies
 *   npx tsx scripts/os-inbox-sync.ts --dry-run # classify without logging
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as https from "https";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

const SCRIPTS_DIR = __dirname;
const CREDS_FILE = path.join(SCRIPTS_DIR, "gmail-credentials.json");
const TOKEN_FILE = path.join(SCRIPTS_DIR, "gmail-token.json");
const PROCESSED_FILE = path.join(SCRIPTS_DIR, ".inbox-processed.json");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OBSIDIAN_KEY = process.env.OBSIDIAN_API_KEY;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const dry = process.argv.includes("--dry-run");
const doAuth = process.argv.includes("--auth");

// ── Gmail OAuth helpers ──────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  if (!fs.existsSync(CREDS_FILE)) {
    console.error(`\n❌ Gmail credentials not found at ${CREDS_FILE}`);
    console.error("\nSetup steps:");
    console.error("  1. Go to console.cloud.google.com");
    console.error("  2. Create project → Enable Gmail API");
    console.error("  3. Create OAuth 2.0 credentials (Desktop app)");
    console.error("  4. Download as gmail-credentials.json and place in scripts/");
    console.error("  5. Run: npx tsx scripts/os-inbox-sync.ts --auth");
    process.exit(1);
  }

  const creds = JSON.parse(fs.readFileSync(CREDS_FILE, "utf-8"));
  const { client_id, client_secret, redirect_uris } = creds.installed ?? creds.web;

  if (fs.existsSync(TOKEN_FILE)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
    // Refresh if needed
    if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
      const refreshed = await refreshToken(client_id, client_secret, token.refresh_token);
      Object.assign(token, refreshed);
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
    }
    return token.access_token;
  }

  // Need to auth
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=http://localhost:3141&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly&access_type=offline&prompt=consent`;
  console.log("\nOpen this URL to authenticate:\n");
  console.log(authUrl);
  console.log("\nWaiting for redirect...");

  const code = await waitForCode(3141);
  const tokens = await exchangeCode(client_id, client_secret, code, "http://localhost:3141");
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ ...tokens, expiry_date: Date.now() + tokens.expires_in * 1000 }, null, 2));
  console.log("✅ Authenticated. Token saved to gmail-token.json");
  return tokens.access_token;
}

function waitForCode(port: number): Promise<string> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Authenticated! You can close this tab.</h1>");
      server.close();
      resolve(code!);
    });
    server.listen(port);
  });
}

async function exchangeCode(clientId: string, clientSecret: string, code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  return res.json() as any;
}

async function refreshToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }),
  });
  return res.json() as any;
}

async function gmailGet(accessToken: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json() as any;
}

// ── Main sync logic ──────────────────────────────────────────────────────────

function loadProcessed(): Set<string> {
  if (!fs.existsSync(PROCESSED_FILE)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8")));
}

function saveProcessed(ids: Set<string>) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify([...ids], null, 2));
}

async function dbInsert(table: string, body: object) {
  if (dry) return;
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

function decodeBase64(str: string): string {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: any): string {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  for (const part of payload.parts ?? []) {
    if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64(part.body.data);
  }
  return "";
}

async function classifyReply(from: string, body: string): Promise<{ classification: string; probability: number; suggested_response: string }> {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: `Classify this reply to a Dentago outreach email (Dentago is a free dental procurement marketplace for UK clinics).
Classifications: INTERESTED, NOT_NOW, WRONG_PERSON, UNSUBSCRIBE, QUESTION
Return JSON: { classification: string, probability: number (0-1), suggested_response: string (1-2 sentences) }`,
    messages: [{ role: "user", content: `From: ${from}\n\n${body.slice(0, 1000)}` }],
  });
  try {
    const text = res.content[0].type === "text" ? res.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { classification: "QUESTION", probability: 0.5, suggested_response: "Review manually." };
  } catch {
    return { classification: "QUESTION", probability: 0.5, suggested_response: "Review manually." };
  }
}

async function main() {
  if (doAuth) {
    await getAccessToken();
    return;
  }

  console.log(`\n📬 Inbox Sync${dry ? " [DRY RUN]" : ""}\n`);

  const accessToken = await getAccessToken();
  const processed = loadProcessed();

  // Search for replies to outreach (threads where we sent from mercier@dentago.co.uk)
  const search = await gmailGet(accessToken, `/messages?q=to:mercier@dentago.co.uk+newer_than:30d&maxResults=50`);
  const messages = search.messages ?? [];

  console.log(`Found ${messages.length} candidate messages`);

  const newlyProcessed: { from: string; classification: string; probability: number; body: string }[] = [];

  for (const msg of messages) {
    if (processed.has(msg.id)) continue;

    const detail = await gmailGet(accessToken, `/messages/${msg.id}?format=full`);
    const headers = detail.payload?.headers ?? [];
    const from = headers.find((h: any) => h.name === "From")?.value ?? "";
    const subject = headers.find((h: any) => h.name === "Subject")?.value ?? "";
    const body = extractBody(detail.payload);

    if (!body.trim()) { processed.add(msg.id); continue; }

    const result = await classifyReply(from, body);
    console.log(`  ${result.classification.padEnd(14)} | ${from.slice(0, 40)} | ${subject.slice(0, 40)}`);

    await dbInsert("events", {
      event_type: "outreach_reply_received",
      entity_type: "outreach",
      entity_id: from.match(/<(.+)>/)?.[1] ?? from,
      payload: { from, subject, body_preview: body.slice(0, 300) },
      source: "inbox_sync",
    });

    await dbInsert("events", {
      event_type: "outreach_classified",
      entity_type: "outreach",
      entity_id: from.match(/<(.+)>/)?.[1] ?? from,
      payload: {
        from, subject,
        classification: result.classification,
        probability: result.probability,
        suggested_response: result.suggested_response,
      },
      source: "inbox_sync",
    });

    if (result.classification === "INTERESTED") {
      await dbInsert("loop_runs", {
        loop_name: "reply_classification",
        triggered_by: "inbox_sync",
        status: "completed",
        input: { from, subject },
        output: { classification: result.classification, probability: result.probability, suggested_response: result.suggested_response },
        kpis_measured: { interested_reply: 1 },
        duration_ms: 0,
        completed_at: new Date().toISOString(),
      });
    }

    processed.add(msg.id);
    newlyProcessed.push({ from, classification: result.classification, probability: result.probability, body: body.slice(0, 200) });
  }

  saveProcessed(processed);

  const interested = newlyProcessed.filter(r => r.classification === "INTERESTED");
  const unsubscribe = newlyProcessed.filter(r => r.classification === "UNSUBSCRIBE");

  console.log(`\n✅ Processed ${newlyProcessed.length} new replies`);
  console.log(`   INTERESTED: ${interested.length}`);
  console.log(`   UNSUBSCRIBE: ${unsubscribe.length}`);

  if (OBSIDIAN_KEY && newlyProcessed.length > 0) {
    const content = `# Inbox Sync — ${new Date().toISOString().slice(0, 16).replace("T", " ")}

Processed ${newlyProcessed.length} new replies.

## Summary
| Classification | Count |
|---|---|
${["INTERESTED", "NOT_NOW", "WRONG_PERSON", "UNSUBSCRIBE", "QUESTION"].map(c =>
  `| ${c} | ${newlyProcessed.filter(r => r.classification === c).length} |`
).join("\n")}

${interested.length > 0 ? `## 🔥 Interested Replies\n${interested.map(r => `- **${r.from}** (${(r.probability * 100).toFixed(0)}% confidence)`).join("\n")}` : ""}

_Generated by os-inbox-sync.ts_
`;
    await fetch(`http://localhost:27123/vault/${encodeURIComponent(`Dentago/Intelligence/Inbox Sync — ${new Date().toISOString().slice(0, 10)}.md`)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${OBSIDIAN_KEY}`, "Content-Type": "text/markdown" },
      body: content,
    }).catch(() => {});
  }
}

main().catch(e => { console.error(e); process.exit(1); });
