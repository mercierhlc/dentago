/**
 * OS dashboard Playbooks tab — curated Markdown runbooks under docs/playbook-*.md.
 * These are reference docs only; they do not complete agent tasks or goals by themselves.
 */

export interface OsPlaybookMeta {
  slug: string;
  /** Filename inside docs/ */
  fileName: string;
  /** Short sidebar card title */
  label: string;
  blurb: string;
  /** Match titles on Approvals tab (substring OK when filtering mentally) */
  relatedApprovalTitles: string[];
  /** Match Agents queue titles / descriptions */
  relatedAgentHints: string[];
}

export const OS_PLAYBOOKS: OsPlaybookMeta[] = [
  {
    slug: "google-calendar-calendly",
    fileName: "playbook-google-calendar-calendly.md",
    label: "Calendar sync & demos",
    blurb: "Calendly ↔ Google options vs MCP vs Zapier — does not execute OAuth for you.",
    relatedApprovalTitles: ["Founder · Google Calendar / Calendly depth"],
    relatedAgentHints: ["Calendar MCP", "Calendly", "Google Calendar"],
  },
  {
    slug: "email-warming-tools",
    fileName: "playbook-email-warming-tools.md",
    label: "Domain warming & sending tools",
    blurb: "DNS readiness, Instantly vs alternatives — choosing tools stays founder-led.",
    relatedApprovalTitles: ["Founder · Instantly.ai vs alternatives"],
    relatedAgentHints: ["Instantly", "Deliverability", "warm-up", "Postmaster"],
  },
  {
    slug: "product-hunt-launch",
    fileName: "playbook-product-hunt-launch.md",
    label: "Product Hunt launch pack",
    blurb: "Copy, gallery checklist, timing — ship decision stays founder-led.",
    relatedApprovalTitles: ["Founder · Product Hunt ship window"],
    relatedAgentHints: ["ProductHunt", "Product Hunt"],
  },
  {
    slug: "os-approvals-database-setup",
    fileName: "playbook-os-approvals-database-setup.md",
    label: "OS Approvals database setup",
    blurb: "One-time SQL to enable the Approvals tab if migrations were skipped.",
    relatedApprovalTitles: [],
    relatedAgentHints: ["os_approval_requests", "approval"],
  },
  {
    slug: "newsletter-practice-managers",
    fileName: "playbook-newsletter-practice-managers.md",
    label: "Practice-manager newsletter",
    blurb: "Resend audiences, consent, first-issue skeleton — does not send mail.",
    relatedApprovalTitles: [],
    relatedAgentHints: ["newsletter", "practice manager"],
  },
  {
    slug: "supplier-integrations-overview",
    fileName: "playbook-supplier-integrations-overview.md",
    label: "Supplier integrations (technical)",
    blurb: "Henry Schein, Dental Sky, Kent Express, DD — auth paths & blockers.",
    relatedApprovalTitles: ["Founder · Supplier connections — Kent Express, Dental Sky, DD Group"],
    relatedAgentHints: ["Kent Express", "Dental Sky", "supplier portal", "integration"],
  },
  {
    slug: "cross-browser-qa",
    fileName: "playbook-cross-browser-qa.md",
    label: "Cross-browser QA (clinic smoke)",
    blurb: "Playwright matrix, known console/prefetch issues, admin login loop — rerun after shipped changes.",
    relatedApprovalTitles: [],
    relatedAgentHints: ["playwright", "Safari", "Firefox", "admin login", "onboarding"],
  },
];

export const OS_PLAYBOOK_SLUGS = new Set(OS_PLAYBOOKS.map((p) => p.slug));

export function getPlaybookBySlug(slug: string): OsPlaybookMeta | undefined {
  return OS_PLAYBOOKS.find((p) => p.slug === slug);
}
