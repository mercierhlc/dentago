import * as fs from "fs";
import * as path from "path";

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

// ── Filters (same as outreach script) ────────────────────────────────────────
const NON_DENTAL_SKIP = [
  "pharmacy", "pharmacies", "vet ", "vets", "veterinary", "veterinarian",
  "co-op", "coop food", "boots ", "lloyds", "health centre", "health center",
  "smoking matters", "ceramics", "optician", "optometrist", "gp surgery",
  "medical centre", "medical center", "hospital",
];

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

function hasValidEmail(row: Record<string, string>): boolean {
  const emailCols = ["emails/0","emails/1","emails/2","emails/3","emails/4","emails/5"];
  return emailCols.some((c) => {
    const e = row[c];
    return e && e.includes("@") && !e.startsWith("//");
  });
}

// ── Email extraction from HTML ────────────────────────────────────────────────
function extractEmails(html: string, domain: string): string[] {
  // Match email patterns
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = new Set<string>();
  let match;
  while ((match = emailRegex.exec(html)) !== null) {
    const email = match[0].toLowerCase();
    // Skip image/asset emails, tracking pixels, etc.
    if (email.includes(".png") || email.includes(".jpg") || email.includes(".gif")) continue;
    if (email.includes("sentry") || email.includes("example") || email.includes("noreply")) continue;
    if (email.includes("schema.org") || email.includes("w3.org")) continue;
    found.add(email);
  }

  // Also look for mailto: links (often obfuscated)
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  while ((match = mailtoRegex.exec(html)) !== null) {
    found.add(match[1].toLowerCase());
  }

  const emails = Array.from(found);

  // Prioritise emails matching the practice's own domain
  if (domain) {
    const domainPart = domain.replace(/^www\./, "").replace(/\/$/, "");
    const ownDomain = emails.filter((e) => e.includes(domainPart));
    if (ownDomain.length) return ownDomain;
  }

  // Filter out obvious third-party/marketing emails
  const thirdParty = ["wix.com", "squarespace.com", "wordpress.com", "weebly.com",
    "godaddy.com", "mailchimp", "hubspot", "google.com", "facebook.com",
    "nhs.scot", "nhshighland", "dentallymail.co.uk"];
  const filtered = emails.filter((e) => !thirdParty.some((t) => e.includes(t)));
  return filtered.slice(0, 3);
}

function getDomain(website: string): string {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    const text = await res.text();
    clearTimeout(timer);
    return text;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Contact page variants to try ──────────────────────────────────────────────
function getUrlsToTry(website: string): string[] {
  const base = website.replace(/\/$/, "");
  return [
    base,
    `${base}/contact`,
    `${base}/contact-us`,
    `${base}/about`,
    `${base}/about-us`,
  ];
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

  // Find dental practices with no email but with a website
  const targets = rows.filter((row) => {
    const name = row["title"]?.trim();
    if (!name) return false;
    if (!isDentalPractice(name)) return false;
    if (hasValidEmail(row)) return false; // already emailed
    const website = row["website"]?.trim();
    return website && website.startsWith("http");
  });

  console.log(`🔍 Searching ${targets.length} practices for emails...\n`);

  const found: { name: string; email: string; website: string; city: string }[] = [];
  const notFound: string[] = [];

  for (const row of targets) {
    const name = row["title"];
    const website = row["website"];
    const city = row["city"] || "";
    const domain = getDomain(website);

    let emails: string[] = [];
    const urlsToTry = getUrlsToTry(website);

    for (const url of urlsToTry) {
      try {
        const html = await fetchWithTimeout(url);
        emails = extractEmails(html, domain);
        if (emails.length) break;
      } catch {
        // try next URL
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    if (emails.length) {
      console.log(`✅ ${name} → ${emails[0]}`);
      found.push({ name, email: emails[0], website, city });
    } else {
      console.log(`❌ ${name} — not found`);
      notFound.push(name);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n📊 Done: ${found.length} emails found, ${notFound.length} not found`);

  console.log("\n=== FOUND ===");
  found.forEach((f, i) => console.log(`${i + 1}. ${f.name} | ${f.email} | ${f.city} | ${f.website}`));

  console.log("\n=== NOT FOUND ===");
  notFound.forEach((n, i) => console.log(`${i + 1}. ${n}`));

  // Save to file for easy access
  const output = {
    found,
    notFound,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(process.env.HOME!, "Downloads", "dentago-found-emails.json"),
    JSON.stringify(output, null, 2)
  );
  console.log("\n💾 Saved to ~/Downloads/dentago-found-emails.json");
}

main().catch(console.error);
