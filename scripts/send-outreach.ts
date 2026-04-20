import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

// ── Invalid email filter ──────────────────────────────────────────────────────
const JUNK_EMAILS = new Set([
  'demo@yourweb.com',
  'support@webador.com',
  'example@yourmail.com',
  'contact@findnhsdentist.co.uk', // directory site, not a clinic
]);

function isValidEmail(email: string): boolean {
  if (!email || !email.includes('@') || !email.includes('.')) return false;
  if (JUNK_EMAILS.has(email.toLowerCase())) return false;
  // skip obvious transfer/placeholder domains
  if (email.includes('mywebsitetransfer.com')) return false;
  if (email.includes('etuodi.com')) return false;
  return true;
}

// ── Personalisation logic ─────────────────────────────────────────────────────
function buildCompliment(clinic: Record<string, string>): string {
  const name = clinic.name;
  const score = parseFloat(clinic.review_score);
  const reviewCount = parseInt(clinic.reviews_number) || 0;
  const categories = clinic.google_business_categories || '';
  const hasInstagram = !!clinic.instagram;
  const street = clinic.street || '';
  const isHarley = street.toLowerCase().includes('harley');
  const isWimpole = street.toLowerCase().includes('wimpole');
  const isSpecialist = categories.includes('implant') || categories.includes('perio') || categories.includes('endodontist');

  if (reviewCount >= 200 && score >= 4.8) {
    return `${reviewCount} reviews and still holding ${score} stars on Google — that level of consistency is genuinely rare. Most practices drop off after 50.`;
  }
  if (score === 5 && reviewCount >= 50) {
    return `A perfect 5.0 across ${reviewCount} reviews is seriously hard to maintain — most practices sacrifice one for the other. Clearly your team is doing something right.`;
  }
  if (score === 5 && reviewCount > 0) {
    return `Five stars on Google — patients don't leave those unless you've genuinely impressed them. That kind of reputation takes real work to build.`;
  }
  if (isSpecialist && score >= 4.8) {
    return `Specialist implant and perio practices tend to have the most complex procurement needs in dentistry — and your ${score}-star reputation suggests you don't cut corners anywhere.`;
  }
  if (isHarley && score >= 4.8) {
    return `Being on Harley Street at ${score} stars means your patients are holding you to the highest standard — and you're meeting it.`;
  }
  if (isWimpole && score >= 4.8) {
    return `Wimpole Street at ${score} stars — your patients clearly expect the best, and your reviews show you're delivering it.`;
  }
  if (hasInstagram && score >= 4.5) {
    return `Your Instagram presence caught my attention — most dental practices don't invest in building that kind of patient-facing brand. Combined with a ${score}-star Google rating, it's clear you're running things properly.`;
  }
  if (score >= 4.8) {
    return `Your ${score}-star rating on Google Maps caught my attention — that's well above average for dental practices in London, and it doesn't happen by accident.`;
  }
  if (score >= 4.5) {
    return `A ${score}-star rating in a competitive London market like yours takes real commitment to the patient experience.`;
  }
  // fallback for lower scores or missing data
  return `${name} came up in my search for UK dental practices — liked what I saw on your website.`;
}

function buildSubject(clinic: Record<string, string>): string {
  const score = parseFloat(clinic.review_score);
  const name = clinic.name;
  const subjects = [
    `Quick question — ${name}`,
    `${name} — I think this could save you money`,
    `Spotted your practice — quick question`,
    `Free tool for ${name}`,
    `Question about your supplier orders`,
  ];
  // vary subject by score bracket to avoid patterns
  if (score === 5) return `${name} — quick question`;
  if (score >= 4.8) return `Spotted your practice — quick question`;
  if (score >= 4.5) return `Question about your supplier orders`;
  return `Free tool for ${name}`;
}

function buildEmail(clinic: Record<string, string>): string {
  const compliment = buildCompliment(clinic);
  return `Hi,

${compliment}

I'm Mercier, founder of Dentago — a free platform that lets UK dental practices compare prices across all your suppliers (Henry Schein, Kent Express, Dental Sky, and others) in one place, in real time. No switching suppliers, no commitments — you just connect the accounts you already have.

Most practices we've spoken to find they're paying 10–20% more than they need to on at least one supplier, simply because there's no easy way to compare. Dentago fixes that.

Would it be worth a 10-minute call to show you how it works?

Mercier
Founder, Dentago
mercier@dentago.co.uk`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = path.resolve('/Users/mercier/Downloads/dataset_google-maps-email-leads-fast-scraper_2026-04-16_23-02-11-503.csv');
  const clinics = parseCSV(csvPath);

  const valid = clinics.filter(c => isValidEmail(c.email));
  // deduplicate by email (some clinics share an email address)
  const seen = new Set<string>();
  const deduped = valid.filter(c => {
    const key = c.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Total clinics: ${clinics.length}`);
  console.log(`Valid unique emails: ${deduped.length}`);
  console.log('');

  let sent = 0;
  let failed = 0;

  for (const clinic of deduped) {
    const subject = buildSubject(clinic);
    const body = buildEmail(clinic);

    try {
      const result = await resend.emails.send({
        from: 'Mercier <mercier@dentago.co.uk>',
        to: clinic.email,
        subject,
        text: body,
      });

      if (result.error) {
        console.error(`❌ ${clinic.name} <${clinic.email}>: ${result.error.message}`);
        failed++;
      } else {
        console.log(`✅ Sent → ${clinic.name} <${clinic.email}>`);
        sent++;
      }
    } catch (err: any) {
      console.error(`❌ ${clinic.name} <${clinic.email}>: ${err.message}`);
      failed++;
    }

    // 200ms delay between sends to respect Resend rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('');
  console.log(`Done. Sent: ${sent} | Failed: ${failed}`);
}

main().catch(console.error);
