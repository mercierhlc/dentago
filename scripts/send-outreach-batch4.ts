import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";

// ── Junk / NHS filters (same as previous batches) ────────────────────────────
const JUNK_EMAILS = new Set([
  "info@example.com", "test@test.com", "noreply@noreply.com",
  "admin@admin.com", "email@email.com",
]);
const JUNK_DOMAINS = ["mywebsitetransfer.com", "etuodi.com"];
const NHS_BOARD_PATTERNS = [
  /nhshighland\.feedback@nhs\.scot/,
  /nhsh\.\w+@nhs\.scot/,
  /wi\.coms@nhs\.scot/,
  /his\.ihcregulation@nhs\.scot/,
  /enquiries@cne-siar\.gov\.uk/,
  /info@dentalcomplaints\.org\.uk/,
  /@.*board.*\.nhs\.scot/,
];
const NON_DENTAL_SKIP = [
  "pharmacy", "pharmacies", "vet ", "vets", "veterinary",
  "co-op", "coop food", "boots ", "lloyds", "health centre",
  "smoking matters", "optician", "optometrist", "gp surgery",
  "medical centre", "medical center", "hospital",
];
const DENTAL_KEYWORDS = [
  "dental", "dentist", "dentistry", "orthodont", "smile", "teeth",
  "tooth", "implant", "periodon", "endodon", "prosthodon", "oral",
];

function isDentalPractice(title: string): boolean {
  const lower = title.toLowerCase();
  for (const skip of NON_DENTAL_SKIP) if (lower.includes(skip)) return false;
  for (const kw of DENTAL_KEYWORDS) if (lower.includes(kw)) return true;
  return false;
}

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  if (JUNK_EMAILS.has(email.toLowerCase())) return false;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (JUNK_DOMAINS.some((d) => domain.includes(d))) return false;
  return true;
}

function isNhsBoardEmail(email: string): boolean {
  return NHS_BOARD_PATTERNS.some((p) => p.test(email));
}

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
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  });
}

// ── Email template (Batch 4 — shorter, direct) ───────────────────────────────
function buildEmail(name: string): { subject: string; html: string } {
  // Extract first name from practice name for personalisation
  // e.g. "Smith Dental Practice" → hard to extract, so use "there"
  // But check if name looks like a person's name (e.g. "John Smith Dental")
  const subject = `Quick one for ${name}`;
  const html = `
<p>Hi there,</p>

<p>Quick one — supply prices across Henry Schein, Kent Express, and Dental Sky can vary 20–30% on the exact same items week to week.</p>

<p>Most practices don't notice because checking them all manually takes too long.</p>

<p>Dentago puts them side by side in one place, so you buy faster and don't overpay. It's free for clinics.</p>

<p>Worth a quick look, or not a priority right now?</p>

<p>– Mercier<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();
  return { subject, html };
}

// ── Already-sent emails (load from logs to avoid duplicates) ─────────────────
function loadPreviouslySent(): Set<string> {
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  if (!fs.existsSync(logPath)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    return new Set((data.sent ?? []).map((s: { email: string }) => s.email.toLowerCase()));
  } catch { return new Set(); }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Try to load the CSV dataset
  const csvCandidates = [
    path.join(process.env.HOME!, "Downloads", "dataset_google-maps-with-contact-details_2026-04-20_00-35-35-834.csv"),
  ];
  const csvPath = csvCandidates.find((p) => fs.existsSync(p));
  if (!csvPath) {
    console.error("❌ No CSV found. Please export a new dataset from Apify.");
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  const previouslySent = loadPreviouslySent();
  console.log(`📧 ${previouslySent.size} emails already sent (loaded from log)\n`);

  const sent: { name: string; email: string; city: string; status: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const seenEmails = new Set<string>(previouslySent);

  for (const row of rows) {
    const name = row["title"]?.trim();
    if (!name) { skipped.push({ name: "(empty)", reason: "No name" }); continue; }

    if (!isDentalPractice(name)) {
      skipped.push({ name, reason: "Not dental" });
      continue;
    }

    const emailCols = ["emails/0","emails/1","emails/2","emails/3","emails/4","emails/5"];
    const allEmails = emailCols.map((c) => row[c]).filter(Boolean);
    const validEmails = allEmails.filter((e) => isValidEmail(e) && !isNhsBoardEmail(e));

    if (!validEmails.length) {
      skipped.push({ name, reason: allEmails.length ? "NHS board/junk only" : "No email" });
      continue;
    }

    const email = validEmails[0].toLowerCase();
    if (seenEmails.has(email)) {
      skipped.push({ name, reason: `Duplicate / already sent (${email})` });
      continue;
    }
    seenEmails.add(email);

    const city = row["city"]?.trim() || "";
    const { subject, html } = buildEmail(name);

    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: email,
        subject,
        html,
        replyTo: FROM,
      });
      sent.push({ name, email, city, status: "Sent" });
      console.log(`✅ ${name} → ${email}`);
    } catch (err) {
      sent.push({ name, email, city, status: "Failed" });
      console.error(`❌ ${name} → ${email}:`, err);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  const successCount = sent.filter(s => s.status === "Sent").length;
  const failCount = sent.filter(s => s.status === "Failed").length;

  console.log(`\n📊 Batch 4 complete: ${successCount} sent, ${failCount} failed, ${skipped.length} skipped`);

  console.log("\n=== SENT LOG ===");
  sent.forEach((s, i) => console.log(`${i + 1}. ${s.name} | ${s.email} | ${s.city} | ${s.status}`));

  // Persist all-time sent log
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  const existing = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : { sent: [] };
  existing.sent.push(...sent.filter(s => s.status === "Sent").map(s => ({
    ...s, batch: 4, sentAt: new Date().toISOString()
  })));
  fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
  console.log(`\n💾 Log updated: ${existing.sent.length} total emails on record`);
}

main().catch(console.error);
