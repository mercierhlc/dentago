import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { logEvent } from "@/lib/events";
import { computeParLevelAlertsDue } from "@/lib/par-level-alerts";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Fetch all par levels with interval configured
  const { data: parLevels, error } = await supabaseAdmin
    .from("clinic_par_levels")
    .select(`
      id, clinic_id, product_id, par_quantity, reorder_quantity,
      reorder_interval_days, last_ordered_at, alert_sent_at, notes,
      clinic_accounts!clinic_par_levels_clinic_id_fkey (id, clinic_name, email),
      dentago_products!clinic_par_levels_product_id_fkey (id, name, brand, category, sku)
    `)
    .not("reorder_interval_days", "is", null);

  if (error) {
    console.error("Failed to fetch par levels:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const alertsDue = computeParLevelAlertsDue(parLevels ?? [], Date.now(), {
    respectAlertCooldown: true,
  });

  // Group by clinic
  const byClinic = new Map<string, { clinic: any; items: any[] }>();
  for (const pl of alertsDue) {
    const clinic = (pl as any).clinic_accounts;
    if (!clinic?.email) continue;
    if (!byClinic.has(clinic.id)) byClinic.set(clinic.id, { clinic, items: [] });
    byClinic.get(clinic.id)!.items.push(pl);
  }

  let emailsSent = 0;
  const alertedIds: string[] = [];

  for (const [, { clinic, items }] of byClinic) {
    const productRows = items.map((pl: any) => {
      const p = (pl as any).dentago_products;
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
              Reorder ${pl.reorder_quantity ?? pl.par_quantity}
            </span>
          </td>
        </tr>`;
    }).join("");

    const html = `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:580px;margin:0 auto;padding:48px 24px;background:#fff;">
        <div style="font-size:24px;font-weight:800;color:#111111;margin-bottom:8px;">Dentago</div>
        <p style="color:#94a3b8;font-size:13px;margin:0 0 32px;">Stock Alert</p>
        <h2 style="font-size:20px;font-weight:800;color:#151121;margin:0 0 8px;">
          ${items.length} product${items.length > 1 ? "s" : ""} need${items.length === 1 ? "s" : ""} reordering
        </h2>
        <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Hi ${clinic.clinic_name}, based on your par levels, the following products are due for reorder.
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
        <a href="https://www.dentago.co.uk/search" style="display:inline-block;background:#111111;color:#fff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:36px;">
          Reorder now →
        </a>
        <p style="color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:24px;margin:0;">
          You're receiving this because you set par levels in Dentago.
          <a href="https://www.dentago.co.uk/clinic/par-levels" style="color:#111111;">Manage par levels</a> ·
          <a href="mailto:support@dentago.co.uk" style="color:#111111;">Contact support</a>
        </p>
      </div>`;

    const { error: emailErr } = await resend.emails.send({
      from: "Dentago <support@dentago.co.uk>",
      to: clinic.email,
      subject: `Stock alert: ${items.length} product${items.length > 1 ? "s" : ""} due for reorder`,
      html,
    });

    if (!emailErr) {
      emailsSent++;
      alertedIds.push(...items.map((pl: any) => pl.id));
    } else {
      console.error(`Email failed for clinic ${clinic.id}:`, emailErr);
    }
  }

  // Update alert_sent_at
  if (alertedIds.length > 0) {
    await supabaseAdmin
      .from("clinic_par_levels")
      .update({ alert_sent_at: new Date().toISOString() })
      .in("id", alertedIds);
  }

  await logEvent({
    event_type: "feature_used",
    entity_type: "system",
    entity_id: "cron",
    payload: {
      feature: "stockout_alerts_cron",
      par_levels_checked: (parLevels ?? []).length,
      alerts_due: alertsDue.length,
      emails_sent: emailsSent,
    },
    source: "cron_stockout_alerts",
  });

  return NextResponse.json({
    checked: (parLevels ?? []).length,
    due: alertsDue.length,
    emails_sent: emailsSent,
  });
}
