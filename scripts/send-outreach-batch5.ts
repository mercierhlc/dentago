import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim());
  // Strip BOM if present
  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(firstLine);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.replace(/^\uFEFF/, "")] = (values[i] ?? "").trim(); });
    return row;
  });
}

// ── Junk filters ──────────────────────────────────────────────────────────────
const JUNK_EMAILS = new Set([
  "info@example.com", "test@test.com", "noreply@noreply.com", "admin@admin.com",
]);

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@") || !email.includes(".")) return false;
  if (JUNK_EMAILS.has(email.toLowerCase())) return false;
  if (email.includes("..") || email.startsWith(".")) return false;
  return true;
}

// ── Load previously sent to avoid duplicates ──────────────────────────────────
function loadSentEmails(): Set<string> {
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  if (!fs.existsSync(logPath)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    return new Set((data.sent ?? []).map((s: { email: string }) => s.email.toLowerCase()));
  } catch { return new Set(); }
}

// ── Email template ────────────────────────────────────────────────────────────
function buildEmail(firstName: string, practiceName: string): { subject: string; html: string } {
  const name = firstName || "there";
  const subject = "Only open this if cutting supplies cost is a priority...";

  const html = `
<p>Hi ${name},</p>

<p>Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.</p>

<p>Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (Btw we integrate your existing supplier accounts to get your negotiated prices).</p>

<p>If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics that are already implementing Dentago? (May as well join the party and save thousands annually on supplies eh?)</p>

<p>Here's my WhatsApp — <strong>+447466 607116</strong>. Happy to get you set up as soon as you drop me a message!</p>

<p>No credit card required — we do NOT charge clinics. We take our fee from the suppliers we work with.</p>

<p>Mercier<br/>
Founder @ Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();

  return { subject, html };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = "/Users/mercier/Downloads/dataset_lead-scraper-apollo-zoominfo-lusha_2026-04-23_03-20-48-523.csv";
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  console.log(`📋 ${rows.length} rows loaded from CSV\n`);

  const previouslySent = loadSentEmails();
  console.log(`📧 ${previouslySent.size} emails already sent — skipping duplicates\n`);

  const sent: { name: string; email: string; practice: string; status: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const seenEmails = new Set<string>(previouslySent);

  for (const row of rows) {
    const firstName = row["firstName"]?.trim() || "";
    const fullName = row["fullName"]?.trim() || firstName;
    const email = row["email"]?.trim().toLowerCase();
    const practiceName = row["companyName"]?.trim() || "";

    if (!isValidEmail(email)) {
      skipped.push({ name: fullName || "(no name)", reason: `Invalid email: "${email}"` });
      continue;
    }

    if (seenEmails.has(email)) {
      skipped.push({ name: fullName, reason: `Duplicate (${email})` });
      continue;
    }

    seenEmails.add(email);

    const { subject, html } = buildEmail(firstName, practiceName);

    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: email,
        subject,
        html,
        replyTo: FROM,
      });
      sent.push({ name: fullName, email, practice: practiceName, status: "Sent" });
      console.log(`✅ ${fullName} (${practiceName}) → ${email}`);
    } catch (err: any) {
      sent.push({ name: fullName, email, practice: practiceName, status: "Failed" });
      console.error(`❌ ${fullName} → ${email}: ${err?.message ?? err}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  const successCount = sent.filter(s => s.status === "Sent").length;
  const failCount = sent.filter(s => s.status === "Failed").length;

  console.log(`\n📊 Batch 5 complete: ${successCount} sent, ${failCount} failed, ${skipped.length} skipped`);
  console.log("\n=== SENT LOG ===");
  sent.forEach((s, i) => console.log(`${i + 1}. ${s.name} | ${s.email} | ${s.practice} | ${s.status}`));
  console.log("\n=== SKIPPED ===");
  skipped.forEach((s, i) => console.log(`${i + 1}. ${s.name} — ${s.reason}`));

  // Persist to all-time log
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  const existing = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : { sent: [] };
  existing.sent.push(...sent.filter(s => s.status === "Sent").map(s => ({
    ...s,
    batch: 5,
    template: "Batch5-ShortDirect",
    sentAt: new Date().toISOString(),
  })));
  fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
  console.log(`\n💾 Log updated — ${existing.sent.length} total emails on record`);
}

main().catch(console.error);
