/**
 * Dentago — Gmail Outreach Sender (Google Apps Script)
 * -------------------------------------------------------
 * Setup:
 * 1. Go to script.google.com → New project
 * 2. Paste this entire file
 * 3. Create a Google Sheet with these columns in row 1:
 *    A: first_name | B: email | C: company_name | D: status | E: sent_at | F: error
 * 4. Copy the Sheet ID from the URL (the long string between /d/ and /edit)
 *    e.g. https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
 * 5. Paste it into SHEET_ID below
 * 6. Run sendOutreachBatch() to send — approve permissions when prompted
 * 7. To schedule: Triggers (clock icon) → Add trigger → sendOutreachBatch → Time-driven → Daily
 *
 * Gmail limits: ~500 emails/day (free), ~2,000/day (Google Workspace)
 * Script sends MAX_PER_RUN per execution to stay safe.
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SHEET_ID   = "PASTE_YOUR_SHEET_ID_HERE";
const SHEET_NAME = "Contacts";          // sheet tab name
const MAX_PER_RUN = 100;                // emails per run (safe daily limit)
const DELAY_MS    = 1500;              // ms between sends (avoid rate limits)
const FROM_NAME   = "Mercier @ Dentago";
const REPLY_TO    = "mercier@dentago.co.uk";

// ── EMAIL TEMPLATE ────────────────────────────────────────────────────────────
function buildEmail(firstName, companyName) {
  const name = firstName || "there";

  const subject = "Only open this if cutting supplies cost is a priority...";

  const html = `
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #222; max-width: 600px; line-height: 1.6;">
  <p>Hi ${name},</p>

  <p>Most dental practices are spending hours every week logging into 4–5 supplier sites,
  comparing prices manually, and placing separate orders with each one.</p>

  <p>Dentago fixes that. One place to search every supplier you already use, see prices
  side by side, and place one order. Takes 5 minutes to set up and it's completely free
  for practices. (Btw we integrate your existing supplier accounts to get your negotiated prices).</p>

  <p>If saving on supply costs and cutting down admin time sounds useful, why not join the
  200+ dental clinics that are already implementing Dentago?</p>

  <p>Here's my WhatsApp — <strong>+447466 607116</strong>. Happy to get you set up as soon
  as you drop me a message!</p>

  <p>No credit card required — we do NOT charge clinics. We take our fee from the suppliers
  we work with.</p>

  <p>
    Mercier<br/>
    Founder @ Dentago<br/>
    <a href="https://www.dentago.co.uk">www.dentago.co.uk</a>
  </p>
</div>`;

  return { subject, html };
}

// ── MAIN SEND FUNCTION ────────────────────────────────────────────────────────
function sendOutreachBatch() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];

  // Column indexes (0-based)
  const COL = {
    first_name:   headers.indexOf("first_name"),
    email:        headers.indexOf("email"),
    company_name: headers.indexOf("company_name"),
    status:       headers.indexOf("status"),
    sent_at:      headers.indexOf("sent_at"),
    error:        headers.indexOf("error"),
  };

  // Validate headers
  if (COL.email === -1) {
    Logger.log("❌ Could not find 'email' column. Check your sheet headers.");
    return;
  }

  let sent = 0, failed = 0, skipped = 0;
  const dailyQuota = MailApp.getRemainingDailyQuota();
  Logger.log(`📬 Gmail quota remaining: ${dailyQuota}`);

  for (let i = 1; i < data.length; i++) {
    if (sent >= MAX_PER_RUN) {
      Logger.log(`⏸ Reached MAX_PER_RUN limit (${MAX_PER_RUN}). Stopping.`);
      break;
    }
    if (dailyQuota - sent <= 10) {
      Logger.log("⚠️ Daily quota nearly exhausted. Stopping.");
      break;
    }

    const row       = data[i];
    const email     = (row[COL.email] || "").toString().trim().toLowerCase();
    const status    = (row[COL.status] || "").toString().trim().toLowerCase();
    const firstName = (row[COL.first_name] || "").toString().trim();
    const company   = (row[COL.company_name] || "").toString().trim();

    // Skip if already sent or no email
    if (!email || !email.includes("@")) { skipped++; continue; }
    if (status === "sent" || status === "failed") { skipped++; continue; }

    try {
      const { subject, html } = buildEmail(firstName, company);

      GmailApp.sendEmail(email, subject, "", {
        htmlBody: html,
        name: FROM_NAME,
        replyTo: REPLY_TO,
        noReply: false,
        headers: {
          "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      // Mark as sent
      sheet.getRange(i + 1, COL.status + 1).setValue("Sent");
      sheet.getRange(i + 1, COL.sent_at + 1).setValue(new Date().toISOString());
      sent++;
      Logger.log(`✅ [${sent}] ${firstName} (${company}) → ${email}`);

    } catch (err) {
      sheet.getRange(i + 1, COL.status + 1).setValue("Failed");
      sheet.getRange(i + 1, COL.error + 1).setValue(err.message);
      failed++;
      Logger.log(`❌ ${email}: ${err.message}`);
    }

    // Rate limit delay
    Utilities.sleep(DELAY_MS);
  }

  Logger.log(`\n=== Batch Complete ===`);
  Logger.log(`Sent: ${sent} | Failed: ${failed} | Skipped: ${skipped}`);
  Logger.log(`Gmail quota remaining: ${MailApp.getRemainingDailyQuota()}`);
}

// ── IMPORT CSV DATA ───────────────────────────────────────────────────────────
/**
 * Run this once to import a CSV file from Google Drive into the sheet.
 * Upload your CSV to Google Drive first, then paste the file name below.
 * Or just paste data directly into the sheet — this is optional.
 */
function importCSVFromDrive() {
  const CSV_FILENAME = "dataset_leads-finder_2026-04-27_13-59-42-501.csv"; // change this

  const files = DriveApp.getFilesByName(CSV_FILENAME);
  if (!files.hasNext()) {
    Logger.log(`❌ File not found: ${CSV_FILENAME}`);
    return;
  }

  const content = files.next().getBlob().getDataAsString();
  const rows    = Utilities.parseCsv(content);
  const headers = rows[0];

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // Write headers + status columns if sheet is empty
  if (sheet.getLastRow() === 0) {
    const outHeaders = [...headers, "status", "sent_at", "error"];
    sheet.appendRow(outHeaders);
  }

  // Append data rows (skip header)
  let added = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const email = row[headers.indexOf("email")] || "";
    if (!email.includes("@")) continue;
    sheet.appendRow([...row, "", "", ""]);
    added++;
  }

  Logger.log(`✅ Imported ${added} contacts from ${CSV_FILENAME}`);
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function showStats() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf("status");

  let total = 0, sent = 0, failed = 0, pending = 0;
  for (let i = 1; i < data.length; i++) {
    const s = (data[i][statusCol] || "").toString().toLowerCase();
    total++;
    if (s === "sent") sent++;
    else if (s === "failed") failed++;
    else pending++;
  }

  Logger.log(`📊 Total: ${total} | Sent: ${sent} | Failed: ${failed} | Pending: ${pending}`);
  Logger.log(`📬 Gmail quota remaining: ${MailApp.getRemainingDailyQuota()}`);
}
