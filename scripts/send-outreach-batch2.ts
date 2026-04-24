import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");

const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
// ✅ mercier@dentago.co.uk is a real Zoho mailbox as of 20 April 2026

// ── Junk filters ──────────────────────────────────────────────────────────────
const JUNK_EMAILS = new Set([
  "info@example.com", "test@test.com", "noreply@noreply.com",
  "admin@admin.com", "email@email.com",
]);

const JUNK_DOMAINS = ["mywebsitetransfer.com", "etuodi.com"];

// NHS board-level admin domains / patterns to skip (not clinic-specific)
const NHS_BOARD_PATTERNS = [
  /nhshighland\.feedback@nhs\.scot/,
  /nhsh\.\w+@nhs\.scot/,
  /wi\.coms@nhs\.scot/,
  /his\.ihcregulation@nhs\.scot/,
  /enquiries@cne-siar\.gov\.uk/,
  /info@dentalcomplaints\.org\.uk/,
  /clydemunro@bigpartnership\.co\.uk/,
  /@.*board.*\.nhs\.scot/,
];

// Non-dental keywords to skip
const NON_DENTAL_SKIP = [
  "pharmacy", "pharmacies", "vet ", "vets", "veterinary", "veterinarian",
  "co-op", "coop food", "boots ", "lloyds", "health centre", "health center",
  "smoking matters", "ceramics", "optician", "optometrist", "gp surgery",
  "medical centre", "medical center", "hospital",
];

// Dental keywords that must appear (or name already implies dental)
const DENTAL_KEYWORDS = [
  "dental", "dentist", "dentistry", "orthodont", "smile", "teeth",
  "tooth", "implant", "periodon", "endodon", "prosthodon", "oral",
];

function isDentalPractice(title: string): boolean {
  const lower = title.toLowerCase();
  for (const skip of NON_DENTAL_SKIP) {
    if (lower.includes(skip)) return false;
  }
  for (const kw of DENTAL_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
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
    } else {
      current += ch;
    }
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

// ── Email personalisation ─────────────────────────────────────────────────────
interface Clinic {
  name: string;
  email: string;
  website: string;
  city: string;
  score: number;
  reviewCount: number;
  hasInstagram: boolean;
}

function buildEmail(c: Clinic): { subject: string; html: string } {
  const isTopRated = c.reviewCount >= 200 && c.score >= 4.8;
  const isPerfect = c.score === 5 && c.reviewCount >= 50;
  const isMediumHighScore = c.score >= 4.8;
  const cityLine = c.city ? ` in ${c.city}` : "";

  let compliment = "";
  let subject = "";

  if (isPerfect && c.reviewCount >= 400) {
    compliment = `${c.name} clearly has an outstanding reputation — ${c.reviewCount} reviews at a perfect 5 stars is genuinely rare and says a lot about the care your team delivers.`;
    subject = `${c.name} — quick question`;
  } else if (isTopRated) {
    compliment = `${c.name} is clearly one of the top-rated practices${cityLine} — ${c.reviewCount} reviews at ${c.score} stars is something most practices spend years trying to achieve.`;
    subject = `Spotted your practice${cityLine} — quick question`;
  } else if (c.hasInstagram) {
    compliment = `I came across ${c.name} on Instagram — you're clearly putting real effort into building your brand, which stands out.`;
    subject = `${c.name} — quick question`;
  } else if (isMediumHighScore) {
    compliment = `${c.name} has a really strong reputation online — ${c.score} stars from ${c.reviewCount} reviews is well above average for a dental practice.`;
    subject = `Quick question for ${c.name}`;
  } else {
    compliment = `I came across ${c.name}${cityLine} while researching dental practices across the UK.`;
    subject = `Quick question for ${c.name}`;
  }

  const html = `
<p>Hi there,</p>

<p>${compliment}</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free platform that lets UK dental practices compare prices across all their suppliers (Henry Schein, Kent Express, Dental Sky, and 40+ others) in one place.</p>

<p>Most practices we speak to are spending 3–5 hours a week on procurement and often overpaying by 15–30% simply because they don't have an easy way to compare. Dentago fixes that — no cost, no contract, just a faster and smarter way to buy.</p>

<p>Would it be useful to see how it works for a practice like ${c.name}? Happy to do a 15-min walkthrough — no sales pitch, just showing you the tool.</p>

<p>Best,<br/>Mercier<br/>Dentago — <a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();

  return { subject, html };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = path.join(
    process.env.HOME!,
    "Downloads",
    "dataset_google-maps-with-contact-details_2026-04-20_00-35-35-834.csv"
  );
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  const sent: { name: string; email: string; website: string; city: string; status: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const name = row["title"]?.trim();
    if (!name) { skipped.push({ name: "(empty)", reason: "No name" }); continue; }

    if (!isDentalPractice(name)) {
      skipped.push({ name, reason: "Not a dental practice" });
      continue;
    }

    // Gather all email columns
    const emailCols = ["emails/0","emails/1","emails/2","emails/3","emails/4","emails/5"];
    const allEmails = emailCols.map((c) => row[c]).filter(Boolean);

    // Pick best email: skip NHS board, prefer non-NHS
    const validEmails = allEmails.filter((e) => isValidEmail(e) && !isNhsBoardEmail(e));
    if (!validEmails.length) {
      skipped.push({ name, reason: allEmails.length ? "Only NHS board / junk emails" : "No email" });
      continue;
    }

    const email = validEmails[0].toLowerCase();
    if (seenEmails.has(email)) {
      skipped.push({ name, reason: `Duplicate email (${email})` });
      continue;
    }
    seenEmails.add(email);

    const score = parseFloat(row["totalScore"] || "0");
    const reviewCount = parseInt(row["reviewsCount"] || "0", 10);
    const city = row["city"]?.trim() || "";
    const website = row["website"]?.trim() || "";
    const hasInstagram = !!(row["instagrams/0"] && !row["instagrams/0"].includes("wix.com"));

    const clinic: Clinic = { name, email, website, city, score, reviewCount, hasInstagram };
    const { subject, html } = buildEmail(clinic);

    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: email,
        subject,
        html,
        replyTo: FROM,
      });
      sent.push({ name, email, website, city, status: "Sent" });
      console.log(`✅ ${name} → ${email}`);
    } catch (err) {
      sent.push({ name, email, website, city, status: "Failed" });
      console.error(`❌ ${name} → ${email}:`, err);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n📊 Batch 2 complete: ${sent.filter(s => s.status === "Sent").length} sent, ${sent.filter(s => s.status === "Failed").length} failed, ${skipped.length} skipped`);

  // Output for Obsidian logging
  console.log("\n=== SENT LOG ===");
  sent.forEach((s, i) => console.log(`${i + 1}. ${s.name} | ${s.email} | ${s.city} | ${s.website} | ${s.status}`));

  console.log("\n=== SKIPPED LOG ===");
  skipped.forEach((s, i) => console.log(`${i + 1}. ${s.name} — ${s.reason}`));
}

main().catch(console.error);
