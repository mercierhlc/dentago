/**
 * stockout-alerts.ts
 * ──────────────────
 * Runs daily (via Vercel cron or GitHub Actions).
 * Checks all clinic par levels and emails clinics whose products are due
 * for reorder (days since last order ≥ reorder_interval_days).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/stockout-alerts.ts
 *   npx tsx scripts/stockout-alerts.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

const ALERT_COOLDOWN_HOURS = 48; // don't re-alert the same item within 48h

async function run() {
  console.log("🔔 Stockout alerts — starting check...");

  // 1. Fetch all par levels that have a reorder interval configured
  const { data: parLevels, error } = await supabase
    .from("clinic_par_levels")
    .select(`
      id,
      clinic_id,
      product_id,
      par_quantity,
      reorder_quantity,
      reorder_interval_days,
      last_ordered_at,
      alert_sent_at,
      notes,
      clinic_accounts!clinic_par_levels_clinic_id_fkey (
        id,
        clinic_name,
        email
      ),
      dentago_products!clinic_par_levels_product_id_fkey (
        id,
        name,
        brand,
        category,
        sku
      )
    `)
    .not("reorder_interval_days", "is", null);

  if (error) {
    console.error("Failed to fetch par levels:", error.message);
    process.exit(1);
  }

  const now = Date.now();
  const alertsDue: any[] = [];

  for (const pl of parLevels ?? []) {
    if (!pl.last_ordered_at) {
      // Never ordered — flag immediately if par level is set
      alertsDue.push({ ...pl, reason: "never_ordered" });
      continue;
    }

    const daysSinceOrder = Math.floor((now - new Date(pl.last_ordered_at).getTime()) / 86_400_000);
    if (daysSinceOrder < pl.reorder_interval_days) continue;

    // Check cooldown — don't spam
    if (pl.alert_sent_at) {
      const hoursSinceAlert = (now - new Date(pl.alert_sent_at).getTime()) / 3_600_000;
      if (hoursSinceAlert < ALERT_COOLDOWN_HOURS) continue;
    }

    alertsDue.push({ ...pl, daysSinceOrder, reason: "interval_elapsed" });
  }

  console.log(`Found ${alertsDue.length} par levels due for stockout alert.`);

  // 2. Group alerts by clinic so we send one email per clinic (not one per product)
  const byClinic = new Map<string, { clinic: any; items: any[] }>();
  for (const pl of alertsDue) {
    const clinic = pl.clinic_accounts;
    if (!clinic?.email) continue;
    if (!byClinic.has(clinic.id)) {
      byClinic.set(clinic.id, { clinic, items: [] });
    }
    byClinic.get(clinic.id)!.items.push(pl);
  }

  let emailsSent = 0;
  const alertedIds: string[] = [];

  for (const [, { clinic, items }] of byClinic) {
    const productRows = items.map((pl: any) => {
      const p = pl.dentago_products;
      const daysSince = pl.daysSinceOrder ?? "—";
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
            <strong style="color:#151121;">${p?.name ?? "Unknown product"}</strong>
            ${p?.brand ? `<span style="color:#94a3b8;font-size:12px;"> · ${p.brand}</span>` : ""}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b;font-size:13px;">
            ${daysSince === "—" ? "Never ordered" : `${daysSince} days ago`}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">
            <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">
              Reorder ${pl.reorder_quantity ?? pl.par_quantity} units
            </span>
          </td>
        </tr>`;
    }).join("");

    const html = `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:580px;margin:0 auto;padding:48px 24px;background:#fff;">
        <div style="font-size:24px;font-weight:800;color:#6C3DE8;margin-bottom:8px;">Dentago</div>
        <p style="color:#94a3b8;font-size:13px;margin:0 0 32px;">Stock Alert</p>

        <h2 style="font-size:20px;font-weight:800;color:#151121;margin:0 0 8px;">
          ${items.length} product${items.length > 1 ? "s" : ""} need${items.length === 1 ? "s" : ""} reordering
        </h2>
        <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Hi ${clinic.clinic_name}, based on your par levels, the following products
          are due for reorder. Click below to restock in seconds.
        </p>

        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden;margin-bottom:28px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Product</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Last Ordered</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Action</th>
            </tr>
          </thead>
          <tbody>${productRows}</tbody>
        </table>

        <a href="https://www.dentago.co.uk/search" style="display:inline-block;background:#6C3DE8;color:#fff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:36px;">
          Reorder now →
        </a>

        <p style="color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:24px;margin:0;">
          You're receiving this because you set par levels in Dentago.
          <a href="https://www.dentago.co.uk/clinic/par-levels" style="color:#6C3DE8;">Manage your par levels</a> ·
          <a href="mailto:support@dentago.co.uk" style="color:#6C3DE8;">Contact support</a>
        </p>
      </div>`;

    const { error: emailErr } = await resend.emails.send({
      from: "Dentago <support@dentago.co.uk>",
      to: clinic.email,
      subject: `Stock alert: ${items.length} product${items.length > 1 ? "s" : ""} due for reorder`,
      html,
    });

    if (emailErr) {
      console.error(`Email failed for ${clinic.clinic_name}:`, emailErr);
    } else {
      emailsSent++;
      alertedIds.push(...items.map((pl: any) => pl.id));
      console.log(`✓ Sent alert to ${clinic.clinic_name} (${clinic.email}) — ${items.length} products`);
    }
  }

  // 3. Update alert_sent_at for all alerted par levels
  if (alertedIds.length > 0) {
    const { error: updateErr } = await supabase
      .from("clinic_par_levels")
      .update({ alert_sent_at: new Date().toISOString() })
      .in("id", alertedIds);
    if (updateErr) console.error("Failed to update alert_sent_at:", updateErr.message);
  }

  // 4. Log to OS
  try {
    const res = await fetch("https://www.dentago.co.uk/api/os/log-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `Stockout alerts script ran: ${alertsDue.length} par levels due, ${emailsSent} emails sent`,
        decisions_made: [],
        work_completed: [{
          task: "stockout_alerts_run",
          result: `${emailsSent} clinic emails sent, ${alertedIds.length} par levels flagged`,
        }],
        open_loops: [],
        outreach_count: 0,
      }),
    });
    if (!res.ok) console.warn("OS log failed:", await res.text());
  } catch (e) {
    console.warn("OS log error:", e);
  }

  console.log(`\n✅ Done. ${emailsSent} emails sent, ${alertedIds.length} par levels updated.`);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
