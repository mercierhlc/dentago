/**
 * Turn raw OS `events` rows into plain-English copy for /os.
 */

export type OsEventInput = {
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  payload?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  source?: string | null;
  created_at?: string;
};

export type ReadableOsEvent = {
  /** Short title shown in the list */
  headline: string;
  /** One line under the headline */
  subtitle: string;
  /** Expandable: what this means, step by step */
  details: string[];
  /** Optional label for the system that wrote the row */
  sourceLabel?: string;
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/** Plain description for `feature_used` payloads we use in admin / cron / tooling */
function featureUsedPlain(p: Record<string, unknown>): ReadableOsEvent | null {
  const feature = str(p.feature);

  if (feature === "contact_marketing_opt_out_toggle") {
    const opted = Boolean(p.marketing_opt_out);
    const email = str(p.email);
    return {
      headline: opted ? "Practice excluded from cold marketing" : "Practice can receive cold marketing again",
      subtitle: email ? `Email address: ${email}` : "CRM marketing flag updated.",
      details: [
        opted
          ? "Someone toggled the admin box so this address is flagged in the CRM as opting out of blast / cold outreach. Product and transactional messages are a separate matter."
          : "The admin unchecked the box, so blast-style campaigns that read the CRM may include this address again (subject to your other rules).",
        `Recorded in contacts.marketing_opt_out in Supabase so scripts and the OS can query it.`,
      ],
      sourceLabel: str(p.by) ? `Admin: ${p.by}` : undefined,
    };
  }

  if (feature === "marketing_opt_out_bulk_approved_clinics") {
    const flagged = num(p.contacts_flagged) ?? 0;
    const profiles = num(p.approved_profiles) ?? 0;
    const skipped = num(p.skipped_no_email) ?? 0;
    return {
      headline: "Bulk: all approved clinics excluded from cold marketing",
      subtitle: `${flagged} CRM contact(s) updated from ${profiles} approved application profile(s).`,
      details: [
        "This ran from the Dentago admin panel: every clinic that already has status “approved” in verification was matched to their login email.",
        `For each matched email we set CRM marketing_opt_out to true so cold/blast outreach scripts skip them.`,
        skipped > 0
          ? `${skipped} approved profile(s) had no usable email from Auth — those were skipped.`
          : "Every approved profile had an email we could flag.",
      ],
    };
  }

  if (feature === "sync_resend_contacts_cron") {
    if (p.error) {
      return {
        headline: "Resend → CRM sync failed",
        subtitle: str(p.error).slice(0, 160),
        details: [
          "The scheduled job tried to pull sends from Resend and align contacts + messages in the CRM.",
          `It stopped with an error: ${String(p.error)}`,
          "Fix credentials or schema, then the next cron run or a manual hit to the sync route can retry.",
        ],
      };
    }
    const fetched = num(p.resendEmailsFetched) ?? 0;
    const recipients = num(p.uniqueRecipients) ?? 0;
    const contacts = num(p.contactsUpserted) ?? 0;
    const messages = num(p.messagesInserted) ?? 0;
    return {
      headline: "Resend inbox synced into the CRM",
      subtitle: `Pulled ${fetched} send record(s); ${recipients} unique recipient(s); updated contacts and message rows.`,
      details: [
        "Resend listed outbound emails so the OS matches what really went out, not only rows typed in by hand.",
        `Upserted about ${contacts} contact row(s) and linked ${messages} message row(s) (new rows where Resend IDs were not seen before).`,
        "This keeps /os Outreach and “last emailed” logic closer to reality for AI and operators.",
      ],
    };
  }

  if (feature === "stockout_alerts_cron") {
    const sent = num(p.emails_sent) ?? 0;
    const due = num(p.alerts_due) ?? 0;
    return {
      headline: "Par-level stock alerts run",
      subtitle: `${sent} email(s) sent for ${due} due alert group(s).`,
      details: [
        "Cron checked clinic par levels and emailed clinics whose reorder interval suggests they’re due.",
        "This is operational product mail, not cold prospecting.",
      ],
    };
  }

  return {
    headline: "Product or admin automation ran",
    subtitle: feature ? `Tagged as: ${feature}` : "A feature hook logged this.",
    details: ["See the expanded raw payload for exact fields.", "Typically cron, admin tooling, or a one-off integration."],
  };
}

export function describeOsEvent(ev: OsEventInput): ReadableOsEvent {
  const type = ev.event_type ?? "unknown";
  const p = (ev.payload && typeof ev.payload === "object" ? ev.payload : {}) as Record<string, unknown>;
  const m = (ev.metrics && typeof ev.metrics === "object" ? ev.metrics : {}) as Record<string, unknown>;
  const source = ev.source ? str(ev.source) : undefined;

  if (type === "feature_used") {
    const got = featureUsedPlain(p);
    if (got) return { ...got, sourceLabel: got.sourceLabel ?? source };
    return {
      headline: "Automation or admin action",
      subtitle: source ? `Source: ${source}` : "",
      details: [`Record type feature_used`, "Open below for payload JSON.", ...(Object.keys(p).length ? [`Keys: ${Object.keys(p).join(", ")}.`] : [])],
      sourceLabel: source,
    };
  }

  if (type === "outreach_sent") {
    const email = str(p.email);
    const subject = str(p.subject);
    const template = str(p.template);
    return {
      headline: "Cold or follow-up email was sent",
      subtitle: subject ? `"${subject.slice(0, 80)}${subject.length > 80 ? "…" : ""}"` : email ? `To ${email}` : "Outbound outreach logged.",
      details: [
        email ? `Recipient: ${email}.` : "Recipient email was logged on this event.",
        subject ? `Subject line: ${subject}` : "",
        template ? `Template / campaign tag in our logs: ${template}.` : "",
        ev.entity_id ? `CRM contact id: ${ev.entity_id}.` : "",
        "This rows up with Resend sends and CRM messages where we wired logging.",
      ].filter(Boolean),
      sourceLabel: source,
    };
  }

  if (type === "loop_completed") {
    const loop = str(p.loop);
    const template = str(p.template);
    const sent = num(p.sent) ?? num(m.sent);
    const failed = num(p.failed) ?? num(m.failed);
    const eligible = num(p.eligible ?? p.would_send ?? p.total_targets);
    const dry = Boolean(p.dry_run ?? p.phase === "dry_run");

    let headline = "Batch job finished";
    if (loop === "os_outreach_contacts_stale") headline = "Stale-contact outreach batch finished";

    const parts: string[] = [
      dry
        ? "This was a dry run: no emails were sent; numbers show what would have happened."
        : "This batch sent emails via Resend and wrote CRM rows and events for each send.",
      loop ? `Batch name we use internally: ${loop}.` : "",
      template ? `Email template tag: ${template}.` : "",
    ];
    if (sent != null || failed != null) {
      parts.push(
        `${sent ?? 0} sent${failed ? `, ${failed} failed at the provider` : ""}${eligible != null ? ` (${eligible} in target list)` : ""}.`
      );
    }
    return {
      headline,
      subtitle: dry ? "Dry run only" : "Emails attempted and logged to the CRM where configured.",
      details: parts.filter(Boolean),
      sourceLabel: source,
    };
  }

  if (type === "gdc_verified" || type === "gdc_failed" || type === "gdc_queued") {
    const status = str(p.status);
    const lines = Array.isArray(p.summary_lines) ? p.summary_lines.filter((x): x is string => typeof x === "string") : [];
    const baseSubtitle = status ? `Verification status set to “${status}”.` : "Admin verification workflow logged a step.";
    return {
      headline:
        type === "gdc_verified"
          ? "Clinic verification approved"
          : type === "gdc_failed"
            ? "Clinic verification rejected"
            : "Clinic verification status updated",
      subtitle: lines[0]?.slice(0, 140) ?? baseSubtitle,
      details:
        lines.length > 0
          ? [...lines]
          : [
              type === "gdc_verified"
                ? "The practice passed admin checks. CRM may exclude them from cold marketing when that integration runs."
                : type === "gdc_failed"
                  ? "The practice failed or was rejected in verification; see rejection reason below if recorded."
                  : "Verification moved to a queued or pending step.",
              p.rejection_reason ? `Reason noted: ${str(p.rejection_reason)}.` : "",
              ev.entity_id ? `Internal clinic / profile id: ${ev.entity_id}.` : "",
            ].filter(Boolean),
      sourceLabel: source ?? str(p.source),
    };
  }

  if (type === "outreach_reply_received" || type === "outreach_classified") {
    return {
      headline: type === "outreach_reply_received" ? "Someone replied to outreach" : "Reply was classified (AI / rules)",
      subtitle: `Channel: usually email · ${ev.entity_type ?? "entity"} ${ev.entity_id ?? ""}`.trim(),
      details: [
        "Inbound reply was stored and linked into the CRM / inbox pipeline.",
        p.classification ? `Classification bucket: ${str(p.classification)}.` : "",
      ].filter(Boolean),
      sourceLabel: source,
    };
  }

  if (type === "outreach_opened") {
    return {
      headline: "Tracked email engagement (open)",
      subtitle: ev.entity_id ? `Linked id: ${ev.entity_id}` : "Pixel or provider open event.",
      details: ["A tracking pixel or ESP reported an open. Use for nurture analytics, not as legal proof on its own."],
      sourceLabel: source,
    };
  }

  if (type === "order_placed" || type === "order_approved" || type === "order_rejected") {
    return {
      headline:
        type === "order_placed" ? "Order placed" : type === "order_approved" ? "Order approved" : "Order rejected",
      subtitle: `${ev.entity_type ?? "entity"} · ${ev.entity_id ?? ""}`.trim(),
      details: ["Commerce event on Dentago.", ...Object.entries(p).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v).slice(0, 120) : str(v)}`)].slice(
        0,
        12
      ),
      sourceLabel: source,
    };
  }

  if (type === "demo_booked" || type === "demo_cancelled") {
    return {
      headline: type === "demo_booked" ? "Demo booked" : "Demo cancelled",
      subtitle: str(p.reason) || (ev.entity_id ? `Clinic/order ref: ${ev.entity_id}` : ""),
      details: ["Calendly or manual booking flow emitted this.", ...Object.entries(p).map(([k, v]) => `${k}: ${str(v)}`).slice(0, 10)],
      sourceLabel: source,
    };
  }

  if (type === "decision_made") {
    return {
      headline: "Decision logged",
      subtitle: str(p.decision).slice(0, 120) || "Strategic decision recorded.",
      details: [
        str(p.rationale) ? `Rationale: ${str(p.rationale)}` : "",
        str(p.expected_outcome) ? `Expected outcome: ${str(p.expected_outcome)}` : "",
      ].filter(Boolean),
      sourceLabel: source ?? "founder",
    };
  }

  if (type === "intelligence_queried") {
    return {
      headline: "Intelligence panel was queried",
      subtitle: "Someone asked the OS a question against recent events.",
      details: ["Internal analytics / GPT-style query ran over event history."],
      sourceLabel: source,
    };
  }

  if (type === "production_deploy") {
    const lines = Array.isArray(p.summary_lines) ? p.summary_lines.filter((x): x is string => typeof x === "string") : [];
    const url = str(p.deployment_url);
    return {
      headline: "Production deployment completed",
      subtitle: url ? url : str(p.project_name) || "Site was deployed on Vercel.",
      details:
        lines.length > 0
          ? lines
          : [
              "A new production build went live (or was promoted).",
              p.project_name ? `Project: ${str(p.project_name)}.` : "",
              p.vercel_event_type ? `Vercel hook type: ${str(p.vercel_event_type)}.` : "",
            ].filter(Boolean),
      sourceLabel:
        source === "vercel_webhook"
          ? "Vercel webhook"
          : source === "deploy_log_manual"
            ? "Manual / CLI deploy log"
            : source === "ship_os_script"
              ? "npm run ship:os"
              : source,
    };
  }

  if (type === "os_live_doc_updated") {
    const slug = str(p.slug);
    const lines = Array.isArray(p.summary_lines)
      ? p.summary_lines.filter((x): x is string => typeof x === "string")
      : [];
    const chars = num(p.body_chars);
    return {
      headline: "OS live document updated",
      subtitle: slug ? `Slug: ${slug}${chars != null ? ` · ${chars.toLocaleString()} characters` : ""}` : "Charter or live markdown changed in Supabase.",
      details:
        lines.length > 0
          ? lines
          : ["A founder or agent updated markdown served from the database without redeploying the Next.js bundle."],
      sourceLabel: source === "api_os_live_doc" ? "Live doc API" : source ?? undefined,
    };
  }

  if (type === "deployment_failed") {
    const lines = Array.isArray(p.summary_lines) ? p.summary_lines.filter((x): x is string => typeof x === "string") : [];
    return {
      headline: "Deployment failed or was canceled",
      subtitle: str(p.project_name) || "See Vercel for build errors.",
      details: lines.length > 0 ? lines : ["Vercel reported a problem with the deployment. Open the failed deployment in the dashboard for logs."],
      sourceLabel: source,
    };
  }

  if (type === "deployment_event") {
    const lines = Array.isArray(p.summary_lines) ? p.summary_lines.filter((x): x is string => typeof x === "string") : [];
    return {
      headline: "Deployment activity (Vercel)",
      subtitle: str(p.vercel_event_type) || "Other deployment-related webhook.",
      details: lines.length > 0 ? lines : ["Vercel sent a deployment-related event that is not strictly success or failure."],
      sourceLabel: source,
    };
  }

  if (type === "supplier_connected" || type === "supplier_disconnected") {
    return {
      headline: type === "supplier_connected" ? "Practice connected a supplier" : "Practice disconnected a supplier",
      subtitle: ev.entity_id ? `Clinic id: ${ev.entity_id}` : "",
      details: ["Credentials or connection state changed in the product."],
      sourceLabel: source,
    };
  }

  if (type === "clinic_signed_up") {
    return {
      headline: "New clinic signup",
      subtitle: str(p.email) || str(p.practice) || "",
      details: ["Lead capture or signup funnel created an account attempt."],
      sourceLabel: source,
    };
  }

  if (type === "http_action") {
    const method = str(p.method) || "HTTP";
    const path = str(p.pathname) || "/";
    const rid = str(p.request_id);
    const phase = str(p.phase) || "request";
    const q = str(p.search);
    return {
      headline: `${method} ${path}`,
      subtitle: q ? `Query string (truncated in logs if long): ${q.slice(0, 140)}${q.length > 140 ? "…" : ""}` : `Phase: ${phase}`,
      details: [
        "Automatic trace: middleware recorded this API request before your route handler ran.",
        rid ? `Correlation id: ${rid}` : "",
        "Handlers may still emit richer domain events (orders, outreach, etc.) in addition to this row.",
      ].filter(Boolean),
      sourceLabel: source ?? "api_middleware",
    };
  }

  // Fallback
  return {
    headline: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    subtitle: source ? `Logged by: ${source}` : `${ev.entity_type ?? "record"} · ${ev.entity_id ?? ""}`.trim(),
    details: [
      "This event type doesn't have bespoke copy yet.",
      ...(Object.keys(p).length ? [`Payload preview: ${Object.keys(p).slice(0, 8).join(", ")}${Object.keys(p).length > 8 ? ", …" : ""}.`] : ["No payload fields."]),
      "Expand to see raw JSON for full detail.",
    ],
    sourceLabel: source,
  };
}
