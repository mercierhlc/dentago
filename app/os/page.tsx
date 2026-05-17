"use client";

import { useEffect, useState, useCallback } from "react";
import { OsEventRow } from "@/components/os/OsEventRow";
import { OsTemplatesPanel } from "@/components/os/OsTemplatesPanel";
import { OS_PLAYBOOKS } from "@/lib/os-playbooks";
import { SupplierOpsConsole } from "@/components/admin/SupplierOpsConsole";
import { OsP0Panel } from "@/components/os/OsP0Panel";

const P = "#111111";

const SYNCABLE = ["Henry Schein", "DHB", "DD Group", "Kent Express", "Dental Sky", "Wrights"];

function ForceSyncButton() {
  const [syncState, setSyncState] = useState<"idle"|"running"|"done"|"error">("idle");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncSupplier, setSyncSupplier] = useState("Dental Sky");

  async function runSync() {
    setSyncState("running"); setSyncMsg("");
    try {
      const res = await fetch("/api/admin/force-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierName: syncSupplier }) });
      const j = await res.json();
      if (!res.ok) { setSyncState("error"); setSyncMsg(j.error ?? "Failed"); return; }
      setSyncState("done");
      setSyncMsg(`✓ ${j.prices_written} prices written across ${j.clinics_synced} clinic(s) — ${j.products_attempted} products attempted`);
    } catch(e: any) { setSyncState("error"); setSyncMsg(e.message); }
  }

  return (
    <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
      <select value={syncSupplier} onChange={e => setSyncSupplier(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-2 py-2 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400">
        {SYNCABLE.map(s => <option key={s}>{s}</option>)}
      </select>
      <button onClick={runSync} disabled={syncState === "running"}
        className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap">
        {syncState === "running" ? "Syncing…" : "Force Sync"}
      </button>
      {syncMsg && <span className={`text-xs font-medium ${syncState === "error" ? "text-red-500" : "text-emerald-600"}`}>{syncMsg}</span>}
    </div>
  );
}

interface OSStateMap { [cat: string]: Record<string, unknown> }
interface Event {
  id?: string | null;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  payload: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  source?: string | null;
  created_at: string;
}
interface Goal { id: string; title: string; category: string; status: string; target_outcome: string; acceptance_criteria?: string; approaches: string[]; failure_context: unknown[]; priority: number; next_review_at: string; agent_report?: string }
interface OsApprovalRow {
  id: string;
  title: string;
  question_text: string;
  proposed_action: string | null;
  context_json: Record<string, unknown>;
  created_by: string;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}
interface ContextEntry { session_type: string; summary: string; decisions_made: unknown[]; work_completed: unknown[]; open_loops: unknown[]; created_at: string }
interface Decision { decision: string; rationale: string; expected_outcome: string; tags: string[]; created_at: string }
interface Snap { total_signups: number; approved_clinics: number; gmv: number; orders: number; demos_booked: number }
interface AgentTask { id: string; title: string; description: string; worker_type: string; priority: number; status: string; output_summary?: string; qa_score?: number; qa_notes?: string; qa_passed?: boolean; attempt_count: number; failure_reason?: string; source_file: string; source_type: string; started_at?: string; completed_at?: string; created_at: string }
interface AgentStats {
  total: number;
  pending: number;
  in_progress: number;
  /** Claimed + in_progress — matches dashboard "Running" when API sends it */
  running?: number;
  claimed?: number;
  qa_review: number;
  done: number;
  failed: number;
  avg_qa_score: number | null;
}

function agentRunningCount(stats: AgentStats | null): number {
  if (!stats) return 0;
  return stats.running ?? stats.in_progress;
}

function agentMatchesStatusFilter(task: AgentTask, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "in_progress") return task.status === "in_progress" || task.status === "claimed";
  return task.status === filter;
}
interface Employee { id: string; slug: string; name: string; role: string; avatar_color: string; description: string; capabilities: string[]; total_tasks_completed: number; last_active_at?: string }
interface EmployeeMessage { id: string; employee_id: string; role: 'user' | 'assistant'; content: string; created_at: string }
interface OutreachContact {
  id: string;
  email: string;
  practice_name?: string;
  status: string;
  total_messages_sent: number;
  last_contacted_at?: string;
  last_replied_at?: string;
  location?: string;
  notes?: string;
}
interface OutreachStats {
  totals: { contacts: number; emails_sent: number; by_status: Record<string, number> };
  top_contacts: OutreachContact[];
}
interface WorkspaceNote { id: string; title: string; category: string; subcategory?: string; tags: string[]; word_count: number; updated_at: string; content: string; week_number?: number }
interface WorkspaceCategory { name: string; count: number }

// ── Design tokens ─────────────────────────────────────────────────────────────
const BORDER = "border-[#EDEAF5]";
const CARD_SHADOW = "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(17,17,17,0.04)]";

// ── Primitives ────────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border ${BORDER} ${CARD_SHADOW} p-6 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-[#A89DC8] uppercase tracking-[0.12em] mb-4">{children}</p>;
}

function KpiCard({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border ${CARD_SHADOW} p-5 flex flex-col gap-2 ${warn ? "border-l-2 border-l-amber-400 border-t-[#EDEAF5] border-r-[#EDEAF5] border-b-[#EDEAF5]" : `${BORDER}`}`}>
      <p className="text-[11px] font-semibold text-[#A89DC8] uppercase tracking-[0.1em]">{label}</p>
      <p className="text-3xl font-bold tracking-tight text-[#0D0B1E]">{value ?? "—"}</p>
      {sub && <p className="text-xs text-[#A89DC8] leading-snug">{sub}</p>}
    </div>
  );
}

function Tag({ text, color }: { text: string; color?: string }) {
  const map: Record<string, string> = {
    outreach: "bg-blue-50 text-blue-600", supplier: "bg-amber-50 text-amber-600",
    product: "bg-violet-50 text-violet-600", seo: "bg-green-50 text-green-600",
    distribution: "bg-pink-50 text-pink-600", ai: "bg-indigo-50 text-indigo-600",
    conversation: "bg-slate-50 text-slate-500", cron_run: "bg-purple-50 text-purple-600",
  };
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-md ${map[color ?? text] ?? "bg-slate-50 text-slate-500"}`}>
      {text}
    </span>
  );
}

function Dot({ type }: { type: string }) {
  const c = type.includes("order") ? "#22c55e" : type.includes("demo") ? P : type.includes("outreach") ? "#3b82f6" : type.includes("supplier") ? "#f59e0b" : type.includes("clinic") ? "#555555" : "#D1C9E8";
  return <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 inline-block" style={{ background: c }} />;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[#A89DC8]">{text}</p>;
}

// ── Nav icons ─────────────────────────────────────────────────────────────────
function NavIcon({ id }: { id: string }) {
  const icons: Record<string, React.ReactNode> = {
    Overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    Objectives: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="3" x2="12" y2="1"/></>,
    Outreach: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.07 6.07l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></>,
    Workspace: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    Employees: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    "Supplier GMV": <><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>,
    "Supplier Ops": <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    Agents: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    Goals: <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    Approvals: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2h8V3a1 1 0 0 0-1-1z"/><path d="M9 12h6"/><path d="M9 16h4"/></>,
    Events: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    "Context Log": <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    "OS State": <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    Templates: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></>,
    Playbooks: <><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>,
    Roadmap: <><path d="M3 12h18"/><path d="M3 6l9-3 9 3"/><path d="M3 18l9 3 9-3"/></>,
    "Founder Feedback": <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/></>,
    P0: <><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {icons[id]}
    </svg>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

/** Approvals is early so it stays above the fold — agents file questions here for founder sign-off. */
const TABS = ["Overview", "Approvals", "P0", "Playbooks", "Founder Feedback", "Objectives", "Outreach", "Email Statistics", "Templates", "Workspace", "Employees", "Supplier GMV", "Supplier Ops", "Agents", "Goals", "Events", "Audit Log", "Context Log", "OS State", "Shipped", "Roadmap", "Pivot Features", "Chat", "Dentago Pro"] as const;
type Tab = typeof TABS[number];

// ── Shipped Features Registry ─────────────────────────────────────────────────

interface ShippedFeature {
  name: string;
  description: string;
  why: string;
  files: string[];
  impact: "high" | "medium" | "low";
  shippedAt: string;
}
interface ShippedGroup { category: string; features: ShippedFeature[] }

const SHIPPED_FEATURES: ShippedGroup[] = [
  {
    category: "Search & Pricing",
    features: [
      {
        name: "Per-Unit Pricing + Best Value Badge",
        description: "Each search result now shows the price per unit (per glove, per cartridge, etc.) in addition to the pack price. The supplier with the lowest per-unit cost gets a green 'Best Value' badge — making the real comparison instantly obvious.",
        why: "Pack sizes vary wildly between suppliers. A clinic comparing £24.99 vs £29.99 can't tell which is cheaper without knowing one pack has 100 units and the other 150. Per-unit pricing removes that maths and drives faster supplier decisions.",
        files: ["lib/pricing.ts", "app/api/search/route.ts", "app/search/page.tsx"],
        impact: "high",
        shippedAt: "May 2026",
      },
      {
        name: "Clinical Equivalent Substitution",
        description: "When a clinic searches for a product (e.g. 'Septanest articaine'), Dentago now detects if a cheaper clinical equivalent exists and shows a non-intrusive info banner with clickable alternative search terms. Covers 6 clinical categories: local anaesthetics, nitrile gloves, rotary files, composites, surface disinfectants, and face masks.",
        why: "Many clinics are brand-loyal by habit, not preference. Showing equivalents at the moment of search gives them an easy nudge toward savings without forcing a choice. Each click is a potential savings event.",
        files: ["lib/clinical-equivalents.ts", "app/api/search/route.ts", "app/search/page.tsx"],
        impact: "high",
        shippedAt: "May 2026",
      },
    ],
  },
  {
    category: "Clinic Activation",
    features: [
      {
        name: "Onboarding Checklist",
        description: "A 3-step checklist (Connect a supplier → Search for a product → View a product) appears on the clinic dashboard until all steps are completed. Each step checks real data: supplier_credentials table, search_performed events, product_viewed events. Dismissable for 7 days via localStorage.",
        why: "Signups mean nothing if clinics don't activate. The checklist creates a clear path from signup to first value moment. Completion tracking is live data, not self-reported.",
        files: ["lib/onboarding.ts", "app/api/clinic/onboarding/route.ts", "components/OnboardingChecklist.tsx", "app/dashboard/page.tsx"],
        impact: "high",
        shippedAt: "May 2026",
      },
      {
        name: "Credential Verification Before Save",
        description: "When a clinic connects a supplier, Dentago now verifies the login actually works before saving the credentials. If login fails, the clinic sees a clear error message ('We couldn't log in to Dental Sky with those credentials'). If the supplier site is unreachable, a 502 is returned. Adds ~12s to the connect flow — worth it to prevent silent bad states.",
        why: "Clinics were connecting suppliers with wrong passwords, then seeing no prices and not knowing why. Verification surfaces the problem at the exact moment it can be fixed.",
        files: ["app/api/clinic/credentials/route.ts"],
        impact: "high",
        shippedAt: "May 2026",
      },
      {
        name: "Authenticated Price Sync on Connect",
        description: "When a clinic successfully connects a supplier, a background price scrape immediately fires for 6 standard products (nitrile gloves, septanest, face masks, filtek, protaper gold, optim wipes). Results write to price_cache. The connect response is instant — sync runs fire-and-forget.",
        why: "Clinics expect to see their prices immediately after connecting. The 20-min delay from waiting for the daily cron killed the 'aha moment'. Fire on connect turns it into a live result.",
        files: ["app/api/clinic/credentials/route.ts"],
        impact: "medium",
        shippedAt: "May 2026",
      },
    ],
  },
  {
    category: "Analytics & Reporting",
    features: [
      {
        name: "Spend Analytics Dashboard",
        description: "A full analytics page at /clinic/analytics showing: total spend, orders placed, savings vs list price, spend breakdown by supplier (visual bar chart), monthly spend trend for last 6 months, and top products by spend. All data pulled from dentago_orders + dentago_order_items.",
        why: "Procurement managers need to justify Dentago to practice owners. A spend dashboard gives them the data to show ROI — turning Dentago from 'a search tool' into 'our procurement system'.",
        files: ["app/api/clinic/analytics/route.ts", "app/clinic/analytics/page.tsx", "components/ProfileMenu.tsx"],
        impact: "high",
        shippedAt: "May 2026",
      },
      {
        name: "Savings History Page",
        description: "A dedicated /clinic/savings page showing total money saved vs list prices, average savings percentage, and a full table of savings events per product. Empty state encourages connecting a supplier to start tracking. Hero stat shows total savings in large purple text.",
        why: "Savings are Dentago's core value proposition. Making them visible and permanent gives clinics a reason to come back — and a number to quote when recommending Dentago to other practices.",
        files: ["supabase/migrations/20260505_savings_log.sql", "app/api/clinic/savings/route.ts", "app/clinic/savings/page.tsx"],
        impact: "medium",
        shippedAt: "May 2026",
      },
      {
        name: "Supplier GMV Tracking",
        description: "Every order now logs a supplier_gmv_directed event with the supplier name, order value, and item count. A new admin endpoint at /api/admin/gmv?days=30 aggregates GMV by supplier for any time window. This feeds supplier commission reporting and partner conversations.",
        why: "We need to show suppliers real GMV numbers in partnership conversations — 'We directed £X to your competitors last month' is a powerful opening. This is the data layer that makes that possible.",
        files: ["app/api/admin/gmv/route.ts"],
        impact: "high",
        shippedAt: "May 2026",
      },
      {
        name: "Xero CSV Export",
        description: "Clinics can export their order history as a Xero-compatible CSV from /api/clinic/orders/export. The format matches Xero's purchase invoice import template exactly (ContactName, InvoiceNumber, Description, Quantity, UnitAmount, TaxType columns). Supports date range filtering.",
        why: "Dental practices run on Xero. Being able to push Dentago orders into their accounting system removes friction from the finance approval process — one less reason to resist using Dentago for real spend.",
        files: ["app/api/clinic/orders/export/route.ts"],
        impact: "medium",
        shippedAt: "May 2026",
      },
    ],
  },
  {
    category: "Inventory & Alerts",
    features: [
      {
        name: "Par Level Stock Tracking",
        description: "Clinics set a par level (target stock quantity) and a reorder point (alert threshold) per product. When current stock drops to or below the reorder point, an email goes out with a reorder link. The ParLevelBadge component shows Low Stock / Order Soon / In Stock status anywhere in the UI. Stockout alert emails are batched per clinic, HTML-formatted, with a 48-hour cooldown to prevent alert fatigue.",
        files: ["app/api/clinic/par-levels/route.ts", "app/api/cron/stockout-alerts/route.ts", "components/ParLevelBadge.tsx", "supabase/migrations/20260506_par_levels_stock_columns.sql"],
        why: "Running out of nitrile gloves mid-session is a clinical incident. Par levels turn reactive panic-buying into planned procurement — which means more orders through Dentago at better prices.",
        impact: "high",
        shippedAt: "May 2026",
      },
    ],
  },
  {
    category: "Data Quality",
    features: [
      {
        name: "SKU Deduplication + Review Queue",
        description: "A background cron (daily at 6am) compares all products using Jaccard token-set overlap. Product pairs with >70% name similarity across different suppliers are flagged as potential duplicates and queued in sku_match_candidates. Admins approve or reject matches via /api/admin/sku-matches. Only cross-supplier pairs are compared.",
        why: "The same product listed 4 times under different supplier names makes search results noisy and undermines price comparison accuracy. Deduplication is the foundation for reliable 'best price' logic.",
        files: ["lib/sku-matcher.ts", "app/api/admin/sku-matches/route.ts", "app/api/cron/find-sku-matches/route.ts", "supabase/migrations/20260505_sku_matches.sql"],
        impact: "high",
        shippedAt: "May 2026",
      },
      {
        name: "Dental Sky Catalog Coverage Fix (570 → 2,000+ SKUs)",
        description: "The Dental Sky catalog scraper was using a hardcoded list of 17 top-level categories. Dental Sky has subcategories 4 levels deep — products assigned only to leaf subcategories were invisible. Fixed by activating the existing discoverAllCategoryIds() function which crawls the full category tree via GraphQL and returns every leaf node.",
        why: "570 products is not a marketplace. 2,000+ is. Coverage directly determines how often Dentago can show a price comparison instead of a 'no results' state.",
        files: ["lib/dental-sky-catalog-fetch.ts"],
        impact: "high",
        shippedAt: "May 2026",
      },
    ],
  },
  {
    category: "Verification & Compliance",
    features: [
      {
        name: "GDC Auto-Verification",
        description: "Clinic GDC registration numbers are automatically verified against the GDC public register (olr.gdc-uk.org) via HTTP form POST. Results update gdc_status to 'verified' or 'failed'. A daily cron at 7am processes the queue of unverified clinics (max 10 per run to avoid rate limits).",
        why: "Manual GDC verification was a founder bottleneck — every clinic signup needed a manual check. Automating it removes the last human step from clinic activation and makes 50 verified clinics achievable this month.",
        files: ["lib/gdc-verify.ts", "app/api/admin/gdc-verify/[clinicId]/route.ts"],
        impact: "high",
        shippedAt: "May 2026",
      },
    ],
  },
];

// ── Strategic OKRs (hardcoded — these are the stable north star targets) ──────

interface QuarterMilestone { label: string; target: string; done?: boolean }
interface MonthMilestone { label: string; target: string; done?: boolean }
interface StrategicPillar {
  id: string;
  emoji: string;
  name: string;
  yearGoal: string;
  color: string;
  quarters: QuarterMilestone[];
  thisMonth: MonthMilestone[];
}

const PILLARS: StrategicPillar[] = [
  {
    id: "revenue",
    emoji: "💰",
    name: "Revenue",
    yearGoal: "£6M ARR by end of Year 1 (projected Year 2 £50M)",
    color: "#111111",
    quarters: [
      { label: "Q1", target: "£50k MRR" },
      { label: "Q2", target: "£80k MRR" },
      { label: "Q3", target: "£150k MRR" },
      { label: "Q4", target: "£200k MRR" },
    ],
    thisMonth: [
      { label: "May", target: "First GMV — any order > £0" },
      { label: "Jun", target: "£5k MRR" },
    ],
  },
  {
    id: "clinics",
    emoji: "🏥",
    name: "Clinic Growth",
    yearGoal: "1,000 verified clinics by end of Year 1",
    color: "#2563eb",
    quarters: [
      { label: "Q1", target: "50 verified clinics" },
      { label: "Q2", target: "200 verified clinics" },
      { label: "Q3", target: "500 verified clinics" },
      { label: "Q4", target: "1,000 verified clinics" },
    ],
    thisMonth: [
      { label: "May", target: "50 verified clinics (from ~2 today)" },
      { label: "Jun", target: "100 verified clinics" },
    ],
  },
  {
    id: "gmv",
    emoji: "📦",
    name: "GMV",
    yearGoal: "£3M/month GMV run rate by Year 1",
    color: "#059669",
    quarters: [
      { label: "Q1", target: "£50k total GMV" },
      { label: "Q2", target: "£200k total GMV" },
      { label: "Q3", target: "£1M/month GMV" },
      { label: "Q4", target: "£3M/month GMV" },
    ],
    thisMonth: [
      { label: "May", target: "First order placed" },
      { label: "Jun", target: "£10k GMV" },
    ],
  },
  {
    id: "suppliers",
    emoji: "🤝",
    name: "Supplier Partnerships",
    yearGoal: "5 signed supplier agreements with commission terms",
    color: "#d97706",
    quarters: [
      { label: "Q1", target: "1 signed agreement (Henry Schein or equiv.)" },
      { label: "Q2", target: "3 signed agreements" },
      { label: "Q3", target: "5 signed agreements" },
      { label: "Q4", target: "10 active supplier partners" },
    ],
    thisMonth: [
      { label: "May", target: "Henry Schein heads-of-terms after 8 May meeting" },
      { label: "Jun", target: "Second supplier in commercial discussions" },
    ],
  },
  {
    id: "outreach",
    emoji: "📧",
    name: "Outreach & Distribution",
    yearGoal: "Reply rate ≥ 10% · Demo → verified conversion ≥ 50%",
    color: "#0891b2",
    quarters: [
      { label: "Q1", target: "Reply rate ≥ 10% · 500 emails/day" },
      { label: "Q2", target: "5,000 emails/day · 50 demos booked" },
      { label: "Q3", target: "BDA partnership live · press coverage" },
      { label: "Q4", target: "Dentistry.co.uk feature · paid acquisition live" },
    ],
    thisMonth: [
      { label: "May", target: "Reply rate > 5% (warm domain) · 10 demos booked" },
      { label: "Jun", target: "Reply rate ≥ 10% · 30 demos booked" },
    ],
  },
];

// Current quarter (hardcoded — update as time progresses)
const CURRENT_QUARTER = "Q2";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OSPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [osState, setOsState] = useState<OSStateMap>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [context, setContext] = useState<ContextEntry[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [openLoops, setOpenLoops] = useState<{ task: string; blocker: string; next_action: string }[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [agentTypeFilter, setAgentTypeFilter] = useState<string>("all");
  const [agentQaSubmitting, setAgentQaSubmitting] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEmployee, setActiveEmployee] = useState<string | null>(null);
  const [employeeChats, setEmployeeChats] = useState<Record<string, EmployeeMessage[]>>({});
  const [employeeInput, setEmployeeInput] = useState("");
  const [employeeSending, setEmployeeSending] = useState(false);
  const [wsNotes, setWsNotes] = useState<WorkspaceNote[]>([]);
  const [wsCategories, setWsCategories] = useState<WorkspaceCategory[]>([]);
  const [wsCategory, setWsCategory] = useState<string>("All");
  const [wsSearch, setWsSearch] = useState<string>("");
  const [wsActive, setWsActive] = useState<WorkspaceNote | null>(null);
  const [wsLoaded, setWsLoaded] = useState(false);
  const [wsTogglingId, setWsTogglingId] = useState<string | null>(null);
  const [crmStats, setCrmStats] = useState<OutreachStats | null>(null);
  const [outreachLoaded, setOutreachLoaded] = useState(false);
  const [emailStats, setEmailStats] = useState<{
    totals: { sent: number; replies: number; reply_rate: number; batches: number };
    by_template: { template_id: string; label: string; sent: number; replies: number; reply_rate: number; last_used: string | null }[];
    by_batch: { batch: string; template_id: string; sent: number; date: string | null }[];
  } | null>(null);
  const [emailStatsLoaded, setEmailStatsLoaded] = useState(false);
  const [outreachSearch, setOutreachSearch] = useState("");
  const [outreachStatus, setOutreachStatus] = useState("all");
  const [outreachContact, setOutreachContact] = useState<OutreachContact | null>(null);
  const [outreachMsgs, setOutreachMsgs] = useState<{ subject: string; sent_at: string; metadata: { last_event: string } }[]>([]);
  const [gmvPeriod, setGmvPeriod] = useState<"week" | "month" | "all">("month");
  const [gmvData, setGmvData] = useState<{ period: string; total_gmv: number; from_date?: string; suppliers: { supplier_id: number; supplier_name: string; gmv: number; order_count: number; items_count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalRows, setApprovalRows] = useState<OsApprovalRow[]>([]);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [appTitle, setAppTitle] = useState("");
  const [appQuestion, setAppQuestion] = useState("");
  const [appProposed, setAppProposed] = useState("");
  const [appCreatedBy, setAppCreatedBy] = useState("agent");
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [querying, setQuerying] = useState(false);
  const [answer, setAnswer] = useState("");
  const [refreshed, setRefreshed] = useState("");
  const [playbookSlug, setPlaybookSlug] = useState<string>(OS_PLAYBOOKS[0]?.slug ?? "");
  const [playbookMd, setPlaybookMd] = useState("");
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [playbookErr, setPlaybookErr] = useState("");
  const [auditEvents, setAuditEvents] = useState<Event[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [auditEventType, setAuditEventType] = useState("");
  const [auditEntityType, setAuditEntityType] = useState("");

  // Chat inbox state
  interface ChatSession { id: string; visitor_id: string; email: string | null; name: string | null; page_url: string | null; status: string; created_at: string; last_message_at: string }
  interface ChatMessage { id: string; session_id: string; role: "visitor" | "agent"; content: string; created_at: string }
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatReply, setChatReply] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stateRes, goalsRes, eventsRes, contextRes, decisionsRes, agentsRes, employeesRes, pendApprRes] = await Promise.all([
        fetch("/api/os/state").then(r => r.ok ? r.json() : { os_state: {}, open_loops: [] }),
        fetch("/api/os/goals").then(r => r.ok ? r.json() : { data: [] }),
        fetch("/api/os/events").then(r => r.ok ? r.json() : { data: [] }),
        fetch("/api/os/context").then(r => r.ok ? r.json() : { data: [] }),
        fetch("/api/os/decisions").then(r => r.ok ? r.json() : { data: [] }),
        fetch("/api/agents/tasks").then(r => r.ok ? r.json() : { data: [], stats: null }),
        fetch("/api/employees").then(r => r.ok ? r.json() : { data: [] }),
        fetch("/api/os/approval-requests?status=pending").then(r => r.ok ? r.json() : { data: [] }),
      ]) as [{ os_state: OSStateMap; open_loops: unknown[] }, { data: Goal[] }, { data: Event[] }, { data: ContextEntry[] }, { data: Decision[] }, { data: AgentTask[]; stats: AgentStats }, { data: Employee[] }, { data: OsApprovalRow[] }];
      setOsState(stateRes.os_state ?? {});
      setGoals(goalsRes.data ?? []);
      setEvents(eventsRes.data ?? []);
      setContext(contextRes.data ?? []);
      setDecisions(decisionsRes.data ?? []);
      setAgentTasks(agentsRes.data ?? []);
      setAgentStats(agentsRes.stats ?? null);
      const empList = employeesRes.data ?? [];
      setEmployees(empList);
      if (!activeEmployee && empList.length > 0) setActiveEmployee(empList[0].id);
      setPendingApprovalCount((pendApprRes.data ?? []).length);
      // collect open loops from context log
      const loops = (contextRes.data ?? []).flatMap((c: ContextEntry) =>
        (c.open_loops as { task: string; blocker: string; next_action: string }[]) ?? []
      );
      setOpenLoops(loops);
      setRefreshed(new Date().toLocaleTimeString("en-GB"));
    } finally { setLoading(false); }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/intelligence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Business state summary: clinics signed up vs verified, GMV, outreach sent, demos booked, open loops, and the #1 priority right now." }),
      });
      if (res.ok) {
        const j = await res.json();
        setSummary(j.answer ?? "");
        setSnap(j.data_snapshot ?? null);
      }
    } finally { setSummaryLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    fetchSummary();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData, fetchSummary]);

  const fetchGmv = useCallback(async (period: "week" | "month" | "all") => {
    const res = await fetch(`/api/admin/supplier-gmv?key=dentago-admin-2024&period=${period}`);
    if (res.ok) setGmvData(await res.json());
  }, []);

  async function fetchWorkspace(cat: string, search: string) {
    const params = new URLSearchParams();
    if (cat !== "All") params.set("category", cat);
    if (search) params.set("search", search);
    const res = await fetch(`/api/workspace?${params}`);
    if (res.ok) {
      const j = await res.json();
      setWsNotes(j.data ?? []);
      setWsCategories(j.categories ?? []);
      setWsLoaded(true);
    }
  }

  useEffect(() => {
    if (tab === "Supplier GMV") fetchGmv(gmvPeriod);
    if (tab === "Employees" && activeEmployee) loadEmployeeChat(activeEmployee);
    if (tab === "Workspace" && !wsLoaded) fetchWorkspace("All", "");
    if (tab === "Outreach" && !outreachLoaded) fetchOutreach();
    if (tab === "Email Statistics" && !emailStatsLoaded) {
      fetch("/api/os/email-stats").then(r => r.json()).then(d => { setEmailStats(d); setEmailStatsLoaded(true); });
    }
    if (tab === "Approvals") fetchApprovalsList();
    if (tab === "Audit Log" && !auditLoaded) fetchAuditLog();
    if (tab === "Chat" && !chatLoaded) fetchChatSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, gmvPeriod, fetchGmv, activeEmployee]);

  useEffect(() => {
    if (tab !== "Playbooks" || !playbookSlug) return;
    let cancelled = false;
    setPlaybookLoading(true);
    setPlaybookErr("");
    setPlaybookMd("");
    void fetch(`/api/os/playbooks/${encodeURIComponent(playbookSlug)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        return { ok: r.ok, j };
      })
      .then(({ ok, j }) => {
        if (cancelled) return;
        setPlaybookLoading(false);
        if (!ok || typeof j.markdown !== "string") {
          setPlaybookErr(typeof j.error === "string" ? j.error : "Could not load playbook.");
          setPlaybookMd("");
          return;
        }
        setPlaybookMd(j.markdown);
      })
      .catch(() => {
        if (cancelled) return;
        setPlaybookLoading(false);
        setPlaybookErr("Network error");
        setPlaybookMd("");
      });
    return () => {
      cancelled = true;
    };
  }, [tab, playbookSlug]);

  async function fetchOutreach() {
    const res = await fetch('/api/crm/outreach-stats');
    if (res.ok) { setCrmStats(await res.json()); setOutreachLoaded(true); }
  }

  async function fetchContactMsgs(contactId: string) {
    const res = await fetch(`/api/crm/messages?contact_id=${contactId}`);
    if (res.ok) { const j = await res.json(); setOutreachMsgs(j.data ?? []); }
  }

  async function toggleTodo(noteId: string, lineIndex: number) {
    const note = wsActive?.id === noteId ? wsActive : wsNotes.find(n => n.id === noteId);
    if (!note) return;
    const lines = note.content.split('\n');
    const line = lines[lineIndex];
    if (!line) return;
    const toggled = line.match(/- \[x\]/i)
      ? line.replace(/- \[x\]/i, '- [ ]')
      : line.replace(/- \[ \]/, '- [x]');
    lines[lineIndex] = toggled;
    const newContent = lines.join('\n');
    const updated = { ...note, content: newContent };
    // Optimistic update
    setWsNotes(ns => ns.map(n => n.id === noteId ? updated : n));
    if (wsActive?.id === noteId) setWsActive(updated);
    setWsTogglingId(noteId);
    await fetch('/api/workspace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: noteId, content: newContent }) });
    setWsTogglingId(null);
  }

  async function loadEmployeeChat(employeeId: string) {
    if (employeeChats[employeeId]) return;
    const res = await fetch(`/api/employees/${employeeId}/chat`);
    if (res.ok) {
      const j = await res.json();
      setEmployeeChats(prev => ({ ...prev, [employeeId]: j.data ?? [] }));
    }
  }

  async function sendEmployeeMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeEmployee || !employeeInput.trim() || employeeSending) return;
    const msg = employeeInput.trim();
    setEmployeeInput("");
    setEmployeeSending(true);

    // Optimistic user message
    const tempUserMsg: EmployeeMessage = { id: `tmp-${Date.now()}`, employee_id: activeEmployee, role: "user", content: msg, created_at: new Date().toISOString() };
    setEmployeeChats(prev => ({ ...prev, [activeEmployee]: [...(prev[activeEmployee] ?? []), tempUserMsg] }));

    try {
      const res = await fetch(`/api/employees/${activeEmployee}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const j = await res.json();
      if (j.reply) {
        const assistantMsg: EmployeeMessage = { id: `tmp-reply-${Date.now()}`, employee_id: activeEmployee, role: "assistant", content: j.reply, created_at: new Date().toISOString() };
        setEmployeeChats(prev => ({
          ...prev,
          [activeEmployee]: [...(prev[activeEmployee] ?? []).filter(m => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg],
        }));
      }
    } finally {
      setEmployeeSending(false);
    }
  }

  async function fetchApprovalsList() {
    const res = await fetch("/api/os/approval-requests");
    if (!res.ok) return;
    const j = await res.json();
    const rows = (j.data ?? []) as OsApprovalRow[];
    setApprovalRows(rows);
    setPendingApprovalCount(rows.filter(r => r.status === "pending").length);
  }

  async function fetchChatSessions() {
    // OS uses cookie-based admin auth — pass the admin-auth cookie automatically
    const res = await fetch("/api/chat/sessions");
    if (!res.ok) return;
    const j = await res.json();
    setChatSessions(j.sessions ?? []);
    setChatLoaded(true);
  }

  async function fetchChatMessages(sessionId: string) {
    const res = await fetch(`/api/chat/messages?session_id=${sessionId}`);
    if (!res.ok) return;
    const j = await res.json();
    setChatMessages(j.messages ?? []);
  }

  async function sendChatReply(sessionId: string) {
    if (!chatReply.trim() || chatSending) return;
    setChatSending(true);
    const text = chatReply.trim();
    setChatReply("");
    await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, content: text, role: "agent" }),
    });
    await fetchChatMessages(sessionId);
    setChatSending(false);
  }

  async function fetchAuditLog(eventTypeFilter?: string, entityTypeFilter?: string) {
    const params = new URLSearchParams({ limit: "100" });
    if (eventTypeFilter) params.set("event_type", eventTypeFilter);
    if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
    const res = await fetch(`/api/admin/audit-log?${params}`);
    if (!res.ok) return;
    const j = await res.json();
    setAuditEvents(j.events ?? []);
    setAuditTotal(j.total ?? 0);
    setAuditLoaded(true);
  }

  async function submitApprovalRequest() {
    if (!appTitle.trim() || !appQuestion.trim()) return;
    setAppSubmitting(true);
    try {
      const res = await fetch("/api/os/approval-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: appTitle.trim(),
          question_text: appQuestion.trim(),
          proposed_action: appProposed.trim() || undefined,
          created_by: appCreatedBy.trim() || "agent",
        }),
      });
      if (res.ok) {
        setAppTitle("");
        setAppQuestion("");
        setAppProposed("");
        await fetchApprovalsList();
        await fetchData();
      }
    } finally {
      setAppSubmitting(false);
    }
  }

  async function resolveApproval(id: string, status: "approved" | "rejected" | "resolved") {
    const notes = resolveNotes[id]?.trim() ?? "";
    const res = await fetch(`/api/os/approval-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution_notes: notes || null }),
    });
    if (res.ok) {
      await fetchApprovalsList();
      await fetchData();
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setQuerying(true); setAnswer("");
    const res = await fetch("/api/intelligence", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const j = await res.json();
    setAnswer(j.answer ?? "No answer.");
    setQuerying(false);
  }

  const activeGoals = goals.filter(g => g.status === "active");
  const doneGoals = goals.filter(g => g.status === "done");
  const kpi = osState.kpis ?? {};
  const outreach = osState.outreach ?? {};
  const suppliers = osState.suppliers ?? {};

  const navBadge = (t: Tab): React.ReactNode => {
    if (t === "Objectives") return PILLARS.length;
    if (t === "Workspace") { const n = wsCategories.reduce((s, c) => s + c.count, 0); return n || null; }
    if (t === "Goals") return activeGoals.length || null;
    if (t === "Approvals" && pendingApprovalCount > 0) {
      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white bg-amber-500">{pendingApprovalCount}</span>;
    }
    if (t === "Events") return events.length || null;
    if (t === "Context Log") return context.length || null;
    if (t === "Employees") return employees.length || null;
    if (t === "Agents" && agentStats) {
      const live = agentRunningCount(agentStats);
      if (live > 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: P }}>{live}</span>;
      return agentStats.total || null;
    }
    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F3FB] text-[#0D0B1E]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-[#EDEAF5] flex flex-col h-full">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-[#EDEAF5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${P} 0%, #9b71f5 100%)` }}>
              <span className="text-white font-black text-sm tracking-tight">D</span>
            </div>
            <div>
              <p className="font-bold text-[#0D0B1E] text-sm leading-none">Dentago OS</p>
              <p className="text-[10px] text-[#A89DC8] mt-0.5 font-medium">AI Operating System</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {TABS.map(t => {
            const active = tab === t;
            const badge = navBadge(t);
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${active ? "text-[#111111]" : "text-[#7A7090] hover:text-[#0D0B1E] hover:bg-[#F5F3FB]"}`}
                style={active ? { background: `linear-gradient(135deg, #EDE9F8 0%, #F0ECFA 100%)` } : {}}>
                <span className={`flex-shrink-0 ${active ? "text-[#111111]" : "text-[#B0A8C8] group-hover:text-[#7A7090]"}`}>
                  <NavIcon id={t} />
                </span>
                <span className="text-[13px] font-medium flex-1 truncate">{t}</span>
                {badge !== null && (
                  <span className={`text-[10px] font-semibold flex-shrink-0 ${active ? "text-[#9B7BF5]" : "text-[#C0B8D8]"}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom status */}
        <div className="px-5 py-4 border-t border-[#EDEAF5]">
          {refreshed && <p className="text-[11px] text-[#C0B8D8] mb-2">Updated {refreshed}</p>}
          <button onClick={() => { fetchData(); fetchSummary(); }}
            className="w-full text-[12px] font-semibold py-2 rounded-xl border border-[#EDEAF5] text-[#7A7090] hover:bg-[#F5F3FB] hover:text-[#0D0B1E] transition-all">
            Refresh
          </button>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-14 flex-shrink-0 bg-white border-b border-[#EDEAF5] px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#C0B8D8]"><NavIcon id={tab} /></span>
            <h1 className="text-sm font-semibold text-[#0D0B1E]">{tab}</h1>
            {tab === "Agents" && agentStats && agentRunningCount(agentStats) > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white ml-1" style={{ background: P }}>{agentRunningCount(agentStats)} live</span>
            )}
          </div>
          <p className="text-[11px] text-[#C0B8D8]">dentago.co.uk · internal only</p>
        </div>

        <div className={`flex-1 ${(tab === "Workspace" || tab === "Outreach" || tab === "Templates" || tab === "Playbooks" || tab === "Chat") ? "overflow-hidden flex flex-col min-h-0" : "overflow-y-auto px-8 py-6 space-y-5"}`}>
        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab === "Overview" && (<>

          {/* KPIs row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Signups" value={snap?.total_signups ?? (kpi.clinics_total as number) ?? "—"} sub="all statuses" />
            <KpiCard label="Verified Clinics" value={snap?.approved_clinics ?? (kpi.clinics_verified as number) ?? "—"} sub="target: 50 by end May" warn />
            <KpiCard label="GMV" value={snap ? `£${snap.gmv.toFixed(0)}` : "£0"} sub="first order is #1 priority" warn />
            <KpiCard label="Demos Booked" value={snap?.demos_booked ?? (kpi.demos_booked as number) ?? "—"} sub="via Calendly" />
          </div>

          {/* KPIs row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Emails Sent" value={(outreach.emails_sent_total as number)?.toLocaleString() ?? "—"} sub={`${outreach.batches_completed ?? 0} batches`} />
            <KpiCard label="Reply Rate" value={outreach.current_reply_rate != null ? `${((outreach.current_reply_rate as number) * 100).toFixed(1)}%` : "—"} sub="target ≥ 10%" warn />
            <KpiCard label="Supplier Partners" value={(suppliers.partnerships_signed as number) ?? 0} sub="signed agreements" warn />
            <KpiCard label="Active Goals" value={activeGoals.length} sub={`${doneGoals.length} done · ${goals.filter(g => (g.failure_context?.length ?? 0) >= 2).length} stuck`} />
          </div>

          {/* Approvals shortcut — same tab as sidebar item #2 */}
          <button
            type="button"
            onClick={() => setTab("Approvals")}
            className="w-full text-left rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-white px-5 py-4 shadow-sm hover:border-amber-300 hover:shadow-md transition-all flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex-shrink-0 text-amber-600"><NavIcon id="Approvals" /></span>
              <div>
                <p className="text-sm font-bold text-[#0D0B1E]">Founder approvals</p>
                <p className="text-xs text-[#7A7090] mt-0.5">
                  Agents post questions here — approve, reject, or resolve without scrolling the sidebar.
                </p>
              </div>
            </div>
            <span className={`text-xs font-bold flex-shrink-0 px-3 py-1.5 rounded-full ${pendingApprovalCount > 0 ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"}`}>
              {pendingApprovalCount > 0 ? `${pendingApprovalCount} pending` : "Open queue"}
            </span>
          </button>

          {/* Operating Contract + Open Loops */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <SectionLabel>Operating Contract</SectionLabel>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-black text-violet-600 mb-3">Humans define</p>
                  {["Goals", "Constraints", "Priorities", "Acceptance criteria"].map(t => (
                    <div key={t} className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: P }} />
                      <span className="text-base text-[#151121] font-medium">{t}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-black text-blue-600 mb-3">Agents handle</p>
                  {["Decomposition", "Execution", "Iteration", "Reporting"].map(t => (
                    <div key={t} className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-base text-[#151121] font-medium">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-slate-400 mt-5 pt-5 border-t border-slate-50 leading-relaxed">
                A goal is done only when its acceptance criteria is met — not when an agent thinks so.
              </p>
              <p className="text-sm text-slate-500 mt-4 leading-relaxed">
                <a
                  href="/api/os/live-doc/OS-DOCTRINE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-violet-600 hover:text-violet-700 underline underline-offset-2"
                >
                  Full OS doctrine (live markdown — DB overrides repo without redeploy)
                </a>
                {" "}— logging, AI-queryable memory, start/end rituals.
              </p>
            </Card>

            <Card className="border-amber-100">
              <SectionLabel>Open Loops ({openLoops.length})</SectionLabel>
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {openLoops.length === 0 ? <Empty text="No open loops." /> : openLoops.map((l, i) => (
                  <div key={i}>
                    <p className="text-base font-semibold text-[#151121]">{l.task}</p>
                    <p className="text-sm text-blue-600 mt-0.5">→ {l.next_action}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Summary */}
          <Card>
            <SectionLabel>Business State — AI Summary</SectionLabel>
            {summaryLoading ? (
              <div className="space-y-3">
                {[85, 70, 80, 60].map(w => (
                  <div key={w} className="h-4 bg-slate-100 rounded-xl animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <p className="text-base text-slate-600 leading-relaxed whitespace-pre-wrap">{summary || "No summary — check ANTHROPIC_API_KEY."}</p>
            )}
          </Card>

          {/* Ask */}
          <Card>
            <SectionLabel>Ask the OS Anything</SectionLabel>
            <form onSubmit={ask} className="flex gap-3">
              <input
                type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="What's blocking first GMV? Which clinics haven't placed an order?"
                className="flex-1 text-base px-5 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
              />
              <button type="submit" disabled={querying || !query.trim()}
                className="px-6 py-3 text-base font-bold text-white rounded-2xl disabled:opacity-40 transition-opacity"
                style={{ background: P }}>
                {querying ? "Thinking…" : "Ask"}
              </button>
            </form>
            {answer && (
              <div className="mt-5 p-5 bg-slate-50 rounded-2xl text-base text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-100">
                {answer}
              </div>
            )}
          </Card>

          {/* Events preview */}
          <Card>
            <SectionLabel>Recent Events ({events.length})</SectionLabel>
            {events.length === 0 ? <Empty text="No events yet." /> : (
              <div className="space-y-0">
                {events.slice(0, 12).map((e, i) => (
                  <OsEventRow key={e.id ?? `ev-${e.created_at}-${i}`} ev={e} compact />
                ))}
                {events.length > 12 && (
                  <button onClick={() => setTab("Events")} className="pt-3 text-sm font-semibold text-violet-600 hover:underline">
                    View all {events.length} events →
                  </button>
                )}
              </div>
            )}
          </Card>
        </>)}

        {/* ══ EMPLOYEES ════════════════════════════════════════════════════ */}
        {tab === "Employees" && (<>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-[#151121]">AI Employees</h2>
              <p className="text-sm text-slate-400 mt-1">Message any agent directly — they have full Dentago context and report back with what they did.</p>
            </div>
            <a href="/crm" className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Client Messages →
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-[600px]">

            {/* Employee sidebar */}
            <div className="space-y-2">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => { setActiveEmployee(emp.id); loadEmployeeChat(emp.id); }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${activeEmployee === emp.id ? "border-violet-200 bg-violet-50/60 shadow-sm" : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-base shadow-sm" style={{ background: emp.avatar_color }}>
                      {emp.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-[#151121] text-sm leading-none">{emp.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{emp.role}</p>
                    </div>
                    {emp.last_active_at && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="Recently active" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{emp.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {emp.capabilities.slice(0, 3).map(cap => (
                      <span key={cap} className="text-[10px] font-semibold px-2 py-0.5 bg-white border border-slate-100 rounded-full text-slate-500">{cap}</span>
                    ))}
                  </div>
                </button>
              ))}

              {employees.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <p className="text-sm text-slate-400">Run the SQL migration in Supabase to seed the employees.</p>
                </div>
              )}
            </div>

            {/* Chat panel */}
            {activeEmployee ? (() => {
              const emp = employees.find(e => e.id === activeEmployee);
              const messages = employeeChats[activeEmployee] ?? [];
              if (!emp) return null;
              return (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_24px_rgba(17,17,17,0.06)] flex flex-col">

                  {/* Chat header */}
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black shadow-sm" style={{ background: emp.avatar_color }}>
                      {emp.name[0]}
                    </div>
                    <div>
                      <p className="font-black text-[#151121] text-sm">{emp.name} — {emp.role}</p>
                      <p className="text-xs text-slate-400">
                        {emp.last_active_at
                          ? `Last active ${new Date(emp.last_active_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : "Not yet active"}
                      </p>
                    </div>
                    {messages.length === 0 && (
                      <button
                        onClick={() => loadEmployeeChat(activeEmployee)}
                        className="ml-auto text-xs font-semibold text-violet-600 hover:underline"
                      >
                        Load history
                      </button>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[400px] max-h-[520px]">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                        <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-white font-black text-2xl shadow-md" style={{ background: emp.avatar_color }}>
                          {emp.name[0]}
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-[#151121] mb-1">Message {emp.name}</p>
                          <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{emp.description}</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                          {[
                            emp.slug === "alex" ? "What's blocking first GMV on the product side?" :
                            emp.slug === "sam" ? "Which INTERESTED replies need following up today?" :
                            emp.slug === "jordan" ? "Who are our top 3 competitors and what's our edge?" :
                            "What KPIs are off-track right now?",
                            emp.slug === "alex" ? "Review the /orders page and fix any bugs" :
                            emp.slug === "sam" ? "Draft a follow-up email sequence for demo no-shows" :
                            emp.slug === "jordan" ? "What's the best content angle for UK dental SEO?" :
                            "Summarise open loops from the last 7 days",
                          ].map(prompt => (
                            <button
                              key={prompt}
                              onClick={() => setEmployeeInput(prompt)}
                              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-all"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={msg.id ?? i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role === "assistant" && (
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-xs mr-2 mt-0.5 flex-shrink-0" style={{ background: emp.avatar_color }}>
                            {emp.name[0]}
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "text-white rounded-br-sm"
                            : "bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-sm"
                        }`} style={msg.role === "user" ? { background: emp.avatar_color } : {}}>
                          {msg.content}
                          <p className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-white/60" : "text-slate-400"}`}>
                            {new Date(msg.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {employeeSending && (
                      <div className="flex justify-start">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-xs mr-2 flex-shrink-0" style={{ background: emp.avatar_color }}>
                          {emp.name[0]}
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                          <div className="flex gap-1 items-center h-5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compose */}
                  <div className="p-4 border-t border-slate-100">
                    <form onSubmit={sendEmployeeMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={employeeInput}
                        onChange={e => setEmployeeInput(e.target.value)}
                        placeholder={`Message ${emp.name}…`}
                        disabled={employeeSending}
                        className="flex-1 text-sm px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50 disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={!employeeInput.trim() || employeeSending}
                        className="px-5 py-3 text-sm font-bold text-white rounded-2xl disabled:opacity-40 transition-opacity flex-shrink-0"
                        style={{ background: emp.avatar_color }}
                      >
                        {employeeSending ? "…" : "Send"}
                      </button>
                    </form>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      {emp.name} has full Dentago context and can see the live OS state.
                    </p>
                  </div>
                </div>
              );
            })() : (
              <div className="bg-white rounded-3xl border border-slate-100 flex items-center justify-center">
                <p className="text-slate-400 text-sm">Select an employee to start a conversation.</p>
              </div>
            )}
          </div>
        </>)}

        {/* ══ SUPPLIER GMV ═════════════════════════════════════════════════ */}
        {tab === "Supplier GMV" && (<>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-black text-[#151121]">Supplier GMV Dashboard</h2>
              <p className="text-sm text-slate-400 mt-1">£ directed to each supplier — your primary sales asset for monetisation conversations.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["week", "month", "all"] as const).map(p => (
                <button key={p} onClick={() => setGmvPeriod(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${gmvPeriod === p ? "bg-violet-600 text-white border-violet-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {p === "week" ? "This week" : p === "month" ? "This month" : "All time"}
                </button>
              ))}
              <ForceSyncButton />
            </div>
          </div>

          {gmvData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard label="Total GMV Directed" value={`£${gmvData.total_gmv.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`${gmvPeriod === "week" ? "last 7 days" : gmvPeriod === "month" ? "this month" : "all time"}`} />
              <KpiCard label="Suppliers" value={gmvData.suppliers.length} sub="with at least one order" />
              <KpiCard label="Period" value={gmvPeriod === "week" ? "7 days" : gmvPeriod === "month" ? "MTD" : "All time"} sub={gmvData.from_date ? `from ${new Date(gmvData.from_date).toLocaleDateString("en-GB")}` : "since launch"} />
            </div>
          )}

          <Card>
            <SectionLabel>GMV by Supplier</SectionLabel>
            {!gmvData ? (
              <p className="text-base text-slate-400">Loading…</p>
            ) : gmvData.suppliers.length === 0 ? (
              <div>
                <Empty text="No orders yet." />
                <p className="text-sm text-slate-400 mt-2">Once a clinic places their first order, you&apos;ll see the breakdown here. Every pound directed is leverage in supplier negotiations.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-100">
                      <th className="pb-3 font-black text-slate-400 text-xs uppercase tracking-widest">Supplier</th>
                      <th className="pb-3 font-black text-slate-400 text-xs uppercase tracking-widest text-right">GMV Directed</th>
                      <th className="pb-3 font-black text-slate-400 text-xs uppercase tracking-widest text-right">Orders</th>
                      <th className="pb-3 font-black text-slate-400 text-xs uppercase tracking-widest text-right">Items</th>
                      <th className="pb-3 font-black text-slate-400 text-xs uppercase tracking-widest text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gmvData.suppliers.map((s, i) => (
                      <tr key={s.supplier_id} className="border-b border-slate-50 hover:bg-violet-50/30 transition-colors">
                        <td className="py-3.5 font-semibold text-[#151121] flex items-center gap-2">
                          <span className="text-slate-300 text-xs w-5">{i + 1}</span>
                          {s.supplier_name}
                        </td>
                        <td className="py-3.5 text-right font-black text-violet-700 text-base">
                          £{s.gmv.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-right text-slate-600">{s.order_count}</td>
                        <td className="py-3.5 text-right text-slate-400">{s.items_count}</td>
                        <td className="py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ background: P, width: `${gmvData.total_gmv > 0 ? (s.gmv / gmvData.total_gmv) * 100 : 0}%` }} />
                            </div>
                            <span className="text-slate-400 text-xs w-10 text-right">
                              {gmvData.total_gmv > 0 ? `${((s.gmv / gmvData.total_gmv) * 100).toFixed(0)}%` : "—"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="border-amber-100">
            <SectionLabel>How to use this in supplier conversations</SectionLabel>
            <div className="space-y-3">
              {[
                { label: "Opening hook", text: "\"We've directed £X to your competitors this month — here's what you're missing.\"" },
                { label: "Commission pitch", text: "\"At a 3% commission rate, that's £Y per month in revenue you'd generate from us.\"" },
                { label: "Data access pitch", text: "\"Suppliers with accounts see real-time order flow, SKU-level data, and priority placement.\"" },
              ].map(({ label, text }) => (
                <div key={label} className="flex gap-3 items-start">
                  <span className="text-xs font-black px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full mt-0.5 whitespace-nowrap">{label}</span>
                  <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </Card>
        </>)}

        {tab === "Supplier Ops" && (
          <Card className="!p-6 md:!p-8 bg-[#f7f9fb]/50">
            <SupplierOpsConsole variant="os" />
          </Card>
        )}

        {/* ══ AGENTS ════════════════════════════════════════════════════════ */}
        {tab === "Agents" && (<>

          {/* Queue stats */}
          {agentStats && (
            <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
              {[
                { label: "Total", value: agentStats.total, color: "text-slate-700" },
                { label: "Pending", value: agentStats.pending, color: "text-slate-500" },
                {
                  label: "Running",
                  value: agentRunningCount(agentStats),
                  color: "text-violet-600",
                  pulse: agentRunningCount(agentStats) > 0,
                },
                { label: "QA Review", value: agentStats.qa_review, color: "text-amber-600" },
                { label: "Done", value: agentStats.done, color: "text-emerald-600" },
                { label: "Failed", value: agentStats.failed, color: "text-red-500" },
                { label: "Avg QA Score", value: agentStats.avg_qa_score != null ? `${agentStats.avg_qa_score}/100` : "—", color: agentStats.avg_qa_score != null && agentStats.avg_qa_score >= 70 ? "text-emerald-600" : "text-amber-600" },
              ].map(({ label, value, color, pulse }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(17,17,17,0.05)] p-4 flex flex-col gap-1">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
                  <div className="flex items-center gap-2">
                    {pulse && <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse flex-shrink-0" />}
                    <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          {agentStats && agentStats.total > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_12px_rgba(17,17,17,0.05)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Overall Progress</p>
                <p className="text-sm font-bold text-slate-600">{Math.round((agentStats.done / agentStats.total) * 100)}% complete</p>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(agentStats.done / agentStats.total) * 100}%` }} />
                <div className="h-full bg-violet-400 transition-all duration-700" style={{ width: `${(agentRunningCount(agentStats) / agentStats.total) * 100}%` }} />
                <div className="h-full bg-amber-400 transition-all duration-700" style={{ width: `${(agentStats.qa_review / agentStats.total) * 100}%` }} />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Done</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />Running</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />QA Review</span>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1.5">
              {["all", "pending", "in_progress", "qa_review", "done", "failed"].map(s => (
                <button key={s} onClick={() => setAgentFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${agentFilter === s ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {s === "all" ? "All" : s === "in_progress" ? "Running" : s === "qa_review" ? "QA Review" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1.5">
              {["all", "coding", "outreach", "research", "general"].map(t => (
                <button key={t} onClick={() => setAgentTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${agentTypeFilter === t ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Task list */}
          <div className="space-y-2">
            {agentTasks
              .filter(t => agentMatchesStatusFilter(t, agentFilter))
              .filter(t => agentTypeFilter === "all" || t.worker_type === agentTypeFilter)
              .map(task => {
                const isExpanded = expandedTask === task.id;
                const statusColor: Record<string, string> = {
                  pending: "bg-slate-100 text-slate-500",
                  claimed: "bg-violet-50 text-violet-600",
                  in_progress: "bg-violet-100 text-violet-700",
                  qa_review: "bg-amber-100 text-amber-700",
                  done: "bg-emerald-100 text-emerald-700",
                  failed: "bg-red-100 text-red-600",
                };
                const priorityColor: Record<number, string> = { 0: "bg-red-500 text-white", 1: "bg-amber-500 text-white", 2: "bg-slate-200 text-slate-600" };
                const workerColor: Record<string, string> = {
                  coding: "bg-blue-50 text-blue-700",
                  outreach: "bg-green-50 text-green-700",
                  research: "bg-purple-50 text-purple-700",
                  general: "bg-slate-100 text-slate-600",
                };
                const qaColor = task.qa_score != null ? (task.qa_score >= 80 ? "text-emerald-600" : task.qa_score >= 70 ? "text-amber-600" : "text-red-500") : "text-slate-400";

                return (
                  <div key={task.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 ${isExpanded ? "border-violet-200 shadow-[0_4px_24px_rgba(17,17,17,0.10)]" : "border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:border-slate-200"}`}>

                    {/* Row — always visible */}
                    <button className="w-full text-left px-5 py-4 flex items-center gap-3" onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                      {/* Priority */}
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex-shrink-0 ${priorityColor[task.priority] ?? "bg-slate-100 text-slate-500"}`}>
                        P{task.priority}
                      </span>
                      {/* Status */}
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex-shrink-0 ${statusColor[task.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {task.status === "in_progress" || task.status === "claimed" ? "● RUNNING" : task.status === "qa_review" ? "🔍 QA" : task.status.toUpperCase()}
                      </span>
                      {/* Worker type */}
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0 ${workerColor[task.worker_type] ?? "bg-slate-100 text-slate-500"}`}>
                        {task.worker_type}
                      </span>
                      {/* Title */}
                      <p className="text-sm font-semibold text-[#151121] flex-1 min-w-0 truncate">{task.title}</p>
                      {/* QA score */}
                      {task.qa_score != null && (
                        <span className={`text-sm font-black flex-shrink-0 ${qaColor}`}>{task.qa_score}/100</span>
                      )}
                      {/* Attempts */}
                      {task.attempt_count > 1 && (
                        <span className="text-xs text-slate-400 flex-shrink-0">{task.attempt_count}× tried</span>
                      )}
                      {/* Chevron */}
                      <span className={`text-slate-300 text-xs flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">

                        {/* Task description */}
                        <div>
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Task Description</p>
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{task.description}</p>
                        </div>

                        {/* What the agent did */}
                        {task.output_summary && (
                          <div className="bg-slate-50 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2">What the Agent Did</p>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{task.output_summary}</p>
                          </div>
                        )}

                        {/* QA review */}
                        {task.qa_score != null && (
                          <div className={`rounded-2xl p-4 ${task.qa_passed ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: task.qa_passed ? "#059669" : "#dc2626" }}>
                                QA Review — {task.qa_passed ? "✓ PASSED" : "✗ FAILED"}
                              </p>
                              <span className={`text-2xl font-extrabold ${qaColor}`}>{task.qa_score}/100</span>
                            </div>
                            {task.qa_notes && <p className="text-sm leading-relaxed" style={{ color: task.qa_passed ? "#065f46" : "#7f1d1d" }}>{task.qa_notes}</p>}
                          </div>
                        )}

                        {/* Failure reason */}
                        {task.failure_reason && (
                          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Failure Reason</p>
                            <p className="text-sm text-red-700">{task.failure_reason}</p>
                          </div>
                        )}

                        {/* Founder oversight QA — score /100 and resolve queue */}
                        <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 space-y-3">
                          <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Founder oversight QA</p>
                          <p className="text-xs text-slate-600">Rate delivery vs spec. Pass (≥70 default) can mark <b>done</b>; fail returns task to <b>pending</b> for rework.</p>
                          <form
                            className="space-y-3"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const fd = new FormData(e.currentTarget);
                              const score = Number(fd.get("qa_score"));
                              const notes = String(fd.get("qa_notes") ?? "");
                              const qa_passed = fd.get("qa_passed") === "on";
                              const apply_status = fd.get("apply_status") === "on";
                              setAgentQaSubmitting(task.id);
                              try {
                                const res = await fetch("/api/os/agent-tasks", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    id: task.id,
                                    qa_score: score,
                                    qa_notes: notes,
                                    qa_passed,
                                    apply_status,
                                  }),
                                });
                                const j = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  alert(typeof j.error === "string" ? j.error : "Save failed");
                                  return;
                                }
                                await fetchData();
                              } finally {
                                setAgentQaSubmitting(null);
                              }
                            }}
                          >
                            <div className="grid sm:grid-cols-2 gap-3 items-start">
                              <label className="block text-xs font-bold text-slate-700">
                                Score (0–100)
                                <input
                                  type="number"
                                  name="qa_score"
                                  min={0}
                                  max={100}
                                  defaultValue={task.qa_score ?? 75}
                                  className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"
                                  required
                                />
                              </label>
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:mt-7">
                                <input
                                  type="checkbox"
                                  name="qa_passed"
                                  defaultChecked={(task.qa_score ?? 75) >= 70}
                                  className="rounded border-violet-300"
                                />
                                Passes bar
                              </label>
                            </div>
                            <label className="block text-xs font-bold text-slate-700">
                              Notes (what was good / what to redo)
                              <textarea
                                name="qa_notes"
                                rows={3}
                                defaultValue={task.qa_notes ?? ""}
                                className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                                placeholder="Oversight verdict…"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" name="apply_status" defaultChecked className="rounded border-violet-300" />
                              Update queue status (done if pass, pending if fail)
                            </label>
                            <button
                              type="submit"
                              disabled={agentQaSubmitting === task.id}
                              className="rounded-xl bg-[#111111] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                            >
                              {agentQaSubmitting === task.id ? "Saving…" : "Save oversight QA"}
                            </button>
                          </form>
                        </div>

                        {/* Meta */}
                        <div className="flex gap-6 text-xs text-slate-400 pt-1 flex-wrap">
                          <span>Source: {task.source_type}</span>
                          {task.started_at && <span>Started: {new Date(task.started_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                          {task.completed_at && <span>Completed: {new Date(task.completed_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                          <span className="truncate max-w-xs" title={task.source_file}>File: {task.source_file.split("/").pop()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            {agentTasks.filter(t => agentMatchesStatusFilter(t, agentFilter)).filter(t => agentTypeFilter === "all" || t.worker_type === agentTypeFilter).length === 0 && (
              <Card><Empty text="No tasks match this filter." /></Card>
            )}
          </div>
        </>)}

        {/* ══ OUTREACH ════════════════════════════════════════════════════════ */}
        {tab === "Outreach" && <>
          {/* Top bar */}
          <div className="bg-white border-b border-[#EDEAF5] flex-shrink-0 px-6 py-4 flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C0B8D8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={outreachSearch} onChange={e => setOutreachSearch(e.target.value)}
                placeholder="Search contacts…"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#EDEAF5] text-sm bg-[#F9F8FD] focus:outline-none focus:ring-2 focus:ring-violet-100 text-[#0D0B1E] placeholder-[#C0B8D8]" />
            </div>
            {/* Status filter pills */}
            {["all","cold","opened","clicked","warm","replied","bounced"].map(s => (
              <button key={s} onClick={() => setOutreachStatus(s)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${outreachStatus === s ? "bg-[#111111] text-white border-[#111111]" : "bg-[#F9F8FD] border-[#EDEAF5] text-[#7A7090] hover:border-[#D4CDE8]"}`}>
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== "all" && crmStats && (
                  <span className="ml-1 opacity-60">{crmStats.totals.by_status[s] ?? 0}</span>
                )}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-4 text-[12px] text-[#A89DC8]">
              <span><b className="text-[#0D0B1E]">{crmStats?.totals.contacts.toLocaleString() ?? "—"}</b> contacts</span>
              <span><b className="text-[#0D0B1E]">{crmStats?.totals.emails_sent.toLocaleString() ?? "—"}</b> emails sent</span>
            </div>
          </div>

          {/* Contact list + detail */}
          <div className="flex flex-1 min-h-0 bg-[#F5F3FB]">
            {/* Left: contact list */}
            <div className="w-80 flex-shrink-0 border-r border-[#EDEAF5] overflow-y-auto bg-white">
              {!outreachLoaded && <div className="flex items-center justify-center h-24 text-[13px] text-[#C0B8D8]">Loading…</div>}
              {outreachLoaded && (() => {
                const filtered = (crmStats?.top_contacts ?? []).filter(c => {
                  const matchStatus = outreachStatus === "all" || c.status === outreachStatus;
                  const q = outreachSearch.toLowerCase();
                  const matchSearch = !q || c.email.includes(q) || (c.practice_name ?? "").toLowerCase().includes(q);
                  return matchStatus && matchSearch;
                });
                return (
                  <>
                    <div className="px-4 py-2 border-b border-[#F5F3FB] text-[11px] text-[#C0B8D8] font-semibold uppercase tracking-wider">
                      {filtered.length} contacts
                    </div>
                    {filtered.map(c => {
                      const STATUS_COLOR: Record<string, string> = {
                        cold: "#94a3b8", opened: "#f59e0b", clicked: "#3b82f6",
                        warm: "#555555", replied: "#22c55e", bounced: "#ef4444", demo: "#111111",
                      };
                      const dot = STATUS_COLOR[c.status] ?? "#94a3b8";
                      return (
                        <button key={c.id} onClick={() => { setOutreachContact(c); fetchContactMsgs(c.id); }}
                          className={`w-full text-left px-4 py-3 border-b border-[#F5F3FB] transition-all ${outreachContact?.id === c.id ? "bg-[#F0ECFA] border-l-2 border-l-[#111111]" : "hover:bg-[#F9F8FD] border-l-2 border-l-transparent"}`}>
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: dot }} />
                            <div className="min-w-0">
                              <p className={`text-[12px] font-semibold truncate ${outreachContact?.id === c.id ? "text-[#111111]" : "text-[#0D0B1E]"}`}>
                                {c.practice_name || c.email.split('@')[1]}
                              </p>
                              <p className="text-[11px] text-[#A89DC8] truncate">{c.email}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-semibold" style={{ color: dot }}>{c.status}</span>
                                <span className="text-[10px] text-[#C0B8D8]">{c.total_messages_sent} sent</span>
                                {c.last_contacted_at && <span className="text-[10px] text-[#C0B8D8]">{new Date(c.last_contacted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            {/* Right: contact detail */}
            <div className="flex-1 overflow-y-auto bg-white">
              {!outreachContact ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F3FB] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#C0B8D8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.07 6.07l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <p className="text-[13px] text-[#C0B8D8] font-medium">Select a contact</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto px-10 py-8">
                  {/* Contact header */}
                  <div className="mb-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h1 className="text-xl font-bold text-[#0D0B1E] leading-tight">{outreachContact.practice_name || outreachContact.email.split('@')[1]}</h1>
                        <p className="text-sm text-[#A89DC8] mt-0.5">{outreachContact.email}</p>
                      </div>
                      {(() => {
                        const STATUS_STYLE: Record<string, string> = {
                          cold: "bg-slate-50 text-slate-500 border-slate-200",
                          opened: "bg-amber-50 text-amber-700 border-amber-200",
                          clicked: "bg-blue-50 text-blue-700 border-blue-200",
                          warm: "bg-violet-50 text-violet-700 border-violet-200",
                          replied: "bg-emerald-50 text-emerald-700 border-emerald-200",
                          bounced: "bg-red-50 text-red-600 border-red-200",
                          demo: "bg-purple-50 text-purple-700 border-purple-200",
                        };
                        return (
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${STATUS_STYLE[outreachContact.status] ?? STATUS_STYLE.cold}`}>
                            {outreachContact.status.toUpperCase()}
                          </span>
                        );
                      })()}
                    </div>
                    {/* Stats row */}
                    <div className="flex gap-4 flex-wrap">
                      {[
                        { label: "Emails sent", value: outreachContact.total_messages_sent },
                        { label: "Last contact", value: outreachContact.last_contacted_at ? new Date(outreachContact.last_contacted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                        { label: "Last reply", value: outreachContact.last_replied_at ? new Date(outreachContact.last_replied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                        { label: "Location", value: outreachContact.location || "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-[#F9F8FD] rounded-xl px-4 py-2.5 min-w-[100px]">
                          <p className="text-[10px] font-semibold text-[#A89DC8] uppercase tracking-wider mb-0.5">{label}</p>
                          <p className="text-sm font-bold text-[#0D0B1E]">{value}</p>
                        </div>
                      ))}
                    </div>
                    {outreachContact.notes && (
                      <p className="mt-3 text-sm text-[#7A7090] italic bg-[#F9F8FD] rounded-xl px-4 py-2.5">{outreachContact.notes}</p>
                    )}
                  </div>

                  {/* Email thread */}
                  <div className="border-t border-[#EDEAF5] pt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A89DC8] mb-4">Email history</p>
                    {outreachMsgs.length === 0 ? (
                      <p className="text-sm text-[#C0B8D8]">No emails found</p>
                    ) : (
                      <div className="space-y-2">
                        {outreachMsgs.map((m, i) => {
                          const ev = (m.metadata as { last_event?: string })?.last_event ?? 'sent';
                          const EV_ICON: Record<string, string> = { delivered: "📨", opened: "👁", clicked: "🔗", bounced: "↩", sent: "📤" };
                          const EV_COLOR: Record<string, string> = { delivered: "#94a3b8", opened: "#f59e0b", clicked: "#3b82f6", bounced: "#ef4444", sent: "#94a3b8" };
                          return (
                            <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#F9F8FD] border border-[#EDEAF5]">
                              <span className="text-base mt-0.5">{EV_ICON[ev] ?? "📤"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold text-[#0D0B1E] truncate">{m.subject || "(no subject)"}</p>
                                <p className="text-[11px] text-[#A89DC8] mt-0.5">{new Date(m.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: EV_COLOR[ev] ?? "#94a3b8", background: (EV_COLOR[ev] ?? "#94a3b8") + "15" }}>
                                {ev}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>}

        {tab === "Templates" && <OsTemplatesPanel />}

        {tab === "Email Statistics" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1a1a2e]">Email Statistics</h2>
              <p className="text-[12px] text-[#8B82A7] mt-0.5">Reply rates by template — use this to figure out which emails actually work.</p>
            </div>
            {!emailStatsLoaded && <div className="text-[13px] text-[#C0B8D8]">Loading…</div>}
            {emailStatsLoaded && emailStats && (() => {
              const { totals, by_template, by_batch } = emailStats;
              return (
                <div className="space-y-5">
                  {/* Totals row */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Total sent", value: totals.sent.toLocaleString() },
                      { label: "Replies received", value: totals.replies.toLocaleString() },
                      { label: "Overall reply rate", value: `${totals.reply_rate}%` },
                      { label: "Batches sent", value: totals.batches.toString() },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-xl border border-[#EDEAF5] px-4 py-3">
                        <div className="text-[11px] text-[#8B82A7] uppercase tracking-wide">{s.label}</div>
                        <div className="text-[22px] font-bold text-[#6C3DE8] mt-0.5">{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* By template */}
                  <div className="bg-white rounded-xl border border-[#EDEAF5] overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#EDEAF5]">
                      <span className="text-[13px] font-semibold text-[#1a1a2e]">By template</span>
                    </div>
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[#FAF9FE] text-[#8B82A7] text-[11px] uppercase tracking-wide">
                          <th className="px-5 py-2 text-left">Template</th>
                          <th className="px-4 py-2 text-right">Sent</th>
                          <th className="px-4 py-2 text-right">Replies</th>
                          <th className="px-4 py-2 text-right">Reply rate</th>
                          <th className="px-4 py-2 text-left">Last used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {by_template.map((t, i) => (
                          <tr key={t.template_id} className={i % 2 === 0 ? "bg-white" : "bg-[#FAF9FE]"}>
                            <td className="px-5 py-2.5">
                              <div className="font-medium text-[#1a1a2e]">{t.label}</div>
                              <div className="text-[10px] text-[#C0B8D8] font-mono">{t.template_id}</div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-[#1a1a2e]">{t.sent.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-[#1a1a2e]">{t.replies.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-semibold ${t.reply_rate >= 10 ? "text-green-600" : t.reply_rate >= 5 ? "text-amber-600" : "text-[#8B82A7]"}`}>
                                {t.reply_rate}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[#8B82A7]">
                              {t.last_used ? new Date(t.last_used).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Recent batches */}
                  <div className="bg-white rounded-xl border border-[#EDEAF5] overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#EDEAF5]">
                      <span className="text-[13px] font-semibold text-[#1a1a2e]">Recent batches</span>
                    </div>
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[#FAF9FE] text-[#8B82A7] text-[11px] uppercase tracking-wide">
                          <th className="px-5 py-2 text-left">Batch</th>
                          <th className="px-4 py-2 text-left">Template</th>
                          <th className="px-4 py-2 text-right">Sent</th>
                          <th className="px-4 py-2 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {by_batch.map((b, i) => (
                          <tr key={b.batch} className={i % 2 === 0 ? "bg-white" : "bg-[#FAF9FE]"}>
                            <td className="px-5 py-2.5 font-mono text-[11px] text-[#1a1a2e]">{b.batch}</td>
                            <td className="px-4 py-2.5 text-[#8B82A7]">{b.template_id}</td>
                            <td className="px-4 py-2.5 text-right text-[#1a1a2e]">{b.sent.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-[#8B82A7]">
                              {b.date ? new Date(b.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === "Workspace" && <>
            {/* Top bar — search + category grid */}
            <div className="bg-white border-b border-[#EDEAF5] flex-shrink-0">
              {/* Search */}
              <div className="px-6 pt-4 pb-3 border-b border-[#EDEAF5]">
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C0B8D8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input value={wsSearch} onChange={e => { setWsSearch(e.target.value); fetchWorkspace(wsCategory, e.target.value); }}
                    placeholder="Search all notes…"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#EDEAF5] text-sm bg-[#F9F8FD] focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-200 text-[#0D0B1E] placeholder-[#C0B8D8] transition-all" />
                </div>
              </div>
              {/* Category grid — main business areas */}
              {(() => {
                const CAT_META: Record<string, { emoji: string; color: string }> = {
                  "All":          { emoji: "◉", color: "#111111" },
                  "Sales":        { emoji: "🤝", color: "#2563eb" },
                  "Marketing":    { emoji: "📧", color: "#0891b2" },
                  "Product":      { emoji: "⚙️", color: "#7c3aed" },
                  "Strategy":     { emoji: "🎯", color: "#4f46e5" },
                  "Finance":      { emoji: "💰", color: "#059669" },
                  "Suppliers":    { emoji: "📦", color: "#d97706" },
                  "Intelligence": { emoji: "🧠", color: "#db2777" },
                  "Operations":   { emoji: "🔧", color: "#64748b" },
                  "To-Dos":       { emoji: "✅", color: "#0f766e" },
                  "Learning":     { emoji: "📚", color: "#7c2d12" },
                };
                const allCount = wsCategories.reduce((s, c) => s + c.count, 0);
                const cats = [{ name: "All", count: allCount }, ...wsCategories];
                return (
                  <div className="px-4 py-3 flex flex-wrap gap-1.5">
                    {cats.map(cat => {
                      const meta = CAT_META[cat.name] ?? { emoji: "•", color: "#111111" };
                      const active = wsCategory === cat.name;
                      return (
                        <button key={cat.name}
                          onClick={() => { setWsCategory(cat.name); setWsActive(null); fetchWorkspace(cat.name, wsSearch); }}
                          className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all border ${active ? "text-white border-transparent shadow-sm" : "bg-[#F9F8FD] border-[#EDEAF5] text-[#7A7090] hover:border-[#D4CDE8] hover:text-[#0D0B1E]"}`}
                          style={active ? { background: meta.color, borderColor: meta.color } : {}}>
                          <span className="text-[13px] leading-none">{meta.emoji}</span>
                          {cat.name}
                          <span className={`text-[10px] font-bold ml-0.5 ${active ? "opacity-70" : "text-[#C0B8D8]"}`}>{cat.count}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Note list + viewer */}
            <div className="flex flex-1 min-h-0 bg-[#F5F3FB]">
              <div className="w-72 flex-shrink-0 border-r border-[#EDEAF5] overflow-y-auto bg-white">
                {!wsLoaded && <div className="flex items-center justify-center h-24 text-[13px] text-[#C0B8D8]">Loading…</div>}
                {wsLoaded && wsNotes.length === 0 && <div className="p-5 text-[13px] text-[#A89DC8]">No notes yet. Run the import script.</div>}
                {wsNotes.map(note => {
                  const isTodo = note.category === "To-Dos";
                  const total = isTodo ? (note.content.match(/- \[[ x]\]/gi) ?? []).length : 0;
                  const done = isTodo ? (note.content.match(/- \[x\]/gi) ?? []).length : 0;
                  const pct = total > 0 ? Math.round(done / total * 100) : 0;
                  return (
                    <button key={note.id} onClick={() => setWsActive(note)}
                      className={`w-full text-left px-5 py-3.5 border-b border-[#F5F3FB] transition-all ${wsActive?.id === note.id ? "bg-[#F0ECFA] border-l-2 border-l-[#111111]" : "hover:bg-[#F9F8FD] border-l-2 border-l-transparent"}`}>
                      <p className={`text-[13px] font-semibold leading-snug mb-1 ${wsActive?.id === note.id ? "text-[#111111]" : "text-[#0D0B1E]"}`}>{note.title}</p>
                      {isTodo && total > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-[#EDEAF5] overflow-hidden">
                            <div className="h-full rounded-full bg-[#111111] transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-[#A89DC8] font-semibold flex-shrink-0">{done}/{total}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#C0B8D8]">{note.word_count.toLocaleString()} words</span>
                          {note.tags.slice(0, 2).map(t => <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#F0ECFA] text-[#9B7BF5]">{t}</span>)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto bg-white">
                {!wsActive ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#F5F3FB] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#C0B8D8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                    </div>
                    <p className="text-[13px] text-[#C0B8D8] font-medium">Select a note</p>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto px-10 py-8">
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ color: P, background: P + "12" }}>{wsActive.category}</span>
                        {wsActive.subcategory && <span className="text-[11px] text-[#A89DC8]">{wsActive.subcategory}</span>}
                        <span className="text-[11px] text-[#C0B8D8] ml-auto">{wsActive.word_count.toLocaleString()} words</span>
                      </div>
                      <h1 className="text-2xl font-bold text-[#0D0B1E] leading-tight tracking-[-0.02em] mb-3">{wsActive.title}</h1>
                      {wsActive.tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {wsActive.tags.map(t => <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[#F5F3FB] text-[#7A7090]">{t}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-[#EDEAF5] pt-6">
                      {wsActive.category === "To-Dos" ? (
                        <div className="space-y-0.5">
                          {wsActive.content.split('\n').map((line, i) => {
                            const unchecked = /^\s*- \[ \]/.test(line);
                            const checked = /^\s*- \[x\]/i.test(line);
                            if (unchecked || checked) {
                              const label = line.replace(/^\s*- \[[ x]\]\s*/i, '');
                              return (
                                <label key={i} className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer group hover:bg-[#F5F3FB] transition-colors ${wsTogglingId === wsActive.id ? 'pointer-events-none opacity-60' : ''}`}>
                                  <span onClick={() => toggleTodo(wsActive.id, i)}
                                    className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 transition-all flex items-center justify-center ${checked ? 'bg-[#111111] border-[#111111]' : 'border-[#C0B8D8] group-hover:border-[#111111]'}`}>
                                    {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}><polyline points="1.5 5 4 7.5 8.5 2"/></svg>}
                                  </span>
                                  <span onClick={() => toggleTodo(wsActive.id, i)} className={`text-sm leading-relaxed select-none ${checked ? 'line-through text-[#A89DC8]' : 'text-[#3D3560]'}`}>{label}</span>
                                </label>
                              );
                            }
                            if (line.startsWith('## ')) return <p key={i} className="text-xs font-black uppercase tracking-[0.1em] text-[#A89DC8] mt-5 mb-2 px-2">{line.replace('## ', '')}</p>;
                            if (line.startsWith('# ')) return null;
                            if (line.startsWith('---')) return null;
                            if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-semibold text-[#0D0B1E] px-2 mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>;
                            if (line.trim() === '') return <div key={i} className="h-1" />;
                            return <p key={i} className="text-sm text-[#A89DC8] px-2 leading-relaxed">{line}</p>;
                          })}
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans text-sm text-[#3D3560] leading-relaxed tracking-[-0.01em]">{wsActive.content}</pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
        </>}

        {/* ══ OBJECTIVES ══════════════════════════════════════════════════════ */}
        {tab === "Objectives" && (
          <div className="space-y-5">

            {/* North Star */}
            <div className="rounded-3xl p-7 text-white" style={{ background: "linear-gradient(135deg, #111111 0%, #4338ca 100%)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">North Star · Year 2</p>
              <p className="text-3xl font-extrabold leading-tight">£50M Revenue</p>
              <p className="text-sm opacity-70 mt-2">1,000 clinics × £3K/month GMV = £36M GMV → 1.5% take rate = £6M ARR Year 1 → compound to £50M Year 2</p>
            </div>

            {/* Pillar OKRs */}
            {PILLARS.map(pillar => (
              <Card key={pillar.id}>
                {/* Pillar header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: pillar.color + "18" }}>
                      {pillar.emoji}
                    </div>
                    <div>
                      <p className="font-black text-[#151121] leading-tight">{pillar.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{pillar.yearGoal}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider" style={{ background: pillar.color + "18", color: pillar.color }}>Year 1</span>
                </div>

                {/* Quarterly breakdown */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {pillar.quarters.map(q => {
                    const isCurrent = q.label === CURRENT_QUARTER;
                    return (
                      <div key={q.label} className={`rounded-2xl p-3 border text-center ${isCurrent ? "border-2" : "border"}`}
                        style={isCurrent ? { borderColor: pillar.color, background: pillar.color + "08" } : { borderColor: "#f1f5f9", background: "#f8fafc" }}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: isCurrent ? pillar.color : "#94a3b8" }}>{q.label}</p>
                        <p className={`text-sm font-bold leading-snug ${isCurrent ? "text-[#151121]" : "text-slate-400"}`}>{q.target}</p>
                        {isCurrent && <p className="text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-full inline-block text-white" style={{ background: pillar.color }}>Now</p>}
                      </div>
                    );
                  })}
                </div>

                {/* Monthly breakdown for current quarter */}
                <div className="border-t border-slate-50 pt-4">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">{CURRENT_QUARTER} Monthly Breakdown</p>
                  <div className="flex gap-3">
                    {pillar.thisMonth.map(m => (
                      <div key={m.label} className="flex-1 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">{m.label}</p>
                        <p className="text-sm font-semibold text-[#151121] leading-snug">{m.target}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ══ GOALS ══════════════════════════════════════════════════════════ */}
        {tab === "Goals" && (() => {
          function bizArea(g: Goal): string {
            const cat = g.category?.toLowerCase() ?? "";
            const t = g.title.toLowerCase();
            if (cat === "supplier" || t.includes("supplier") || t.includes("henry schein") || t.includes("kent express") || t.includes("trycare") || t.includes("dd group") || t.includes("gocardless")) return "Supplier Partnerships";
            if (cat === "seo" || cat === "distribution" || t.includes("blog") || t.includes("capterra") || t.includes("g2 listing") || t.includes("directory") || t.includes("linkedin article") || t.includes("linkedin post") || t.includes("facebook group") || t.includes("30 days live") || t.includes("healthtech") || t.includes("dentistry.co.uk") || t.includes("dentinal")) return "Growth & Distribution";
            if (cat === "outreach" || t.includes("cold email") || t.includes("outreach") || t.includes("demo booked") || t.includes("demo call") || t.includes("onboarding call") || t.includes("linkedin message") || t.includes("bda") || t.includes("adam ") || t.includes("acquisition channel") || t.includes("referral") || t.includes("apollo")) return "Client Acquisition";
            if (cat === "ai" || t.includes("posthog") || t.includes("sentry") || t.includes("legal review") || t.includes("audit") || t.includes("review clinic")) return "Intelligence & Analytics";
            if (t.includes("gmv") || t.includes("revenue") || t.includes("fee") || t.includes("£")) return "Revenue & Finance";
            if (t.includes("active clinic") || t.includes("clinic count") || t.includes("verified") || t.includes("retention") || t.includes("dso") || t.includes("founding member")) return "Clinic Growth";
            return "Product & Platform";
          }

          const BIZ_COLOR: Record<string, string> = {
            "Client Acquisition": "#2563eb", "Clinic Growth": "#7c3aed",
            "Supplier Partnerships": "#d97706", "Revenue & Finance": "#059669",
            "Growth & Distribution": "#0891b2", "Product & Platform": "#111111",
            "Intelligence & Analytics": "#db2777",
          };
          const BIZ_EMOJI: Record<string, string> = {
            "Client Acquisition": "📨", "Clinic Growth": "🏥",
            "Supplier Partnerships": "🤝", "Revenue & Finance": "💰",
            "Growth & Distribution": "📢", "Product & Platform": "⚙️",
            "Intelligence & Analytics": "🧠",
          };

          // Group by week, then by business area within each week
          const byWeek: Record<number, Goal[]> = {};
          const noWeek: Goal[] = [];
          for (const g of goals) {
            const wm = g.title.match(/\[Week (\d+)/i);
            if (wm) {
              const w = parseInt(wm[1]);
              if (!byWeek[w]) byWeek[w] = [];
              byWeek[w].push(g);
            } else {
              noWeek.push(g);
            }
          }
          const sortedWeeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
          const totalGoals = goals.length;
          const doneCount = goals.filter(g => g.status === 'done' || g.status === 'completed').length;
          const pct = totalGoals > 0 ? (doneCount / totalGoals) * 100 : 0;

          async function toggleGoal(g: Goal) {
            const newStatus = (g.status === 'done' || g.status === 'completed') ? 'active' : 'done';
            setGoals(prev => prev.map(x => x.id === g.id ? { ...x, status: newStatus } : x));
            await fetch('/api/os/goals', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: g.id, status: newStatus }),
            });
          }

          function GoalRow({ g }: { g: Goal }) {
            const done = g.status === 'done' || g.status === 'completed';
            return (
              <div className="flex items-start gap-3 py-3 border-b border-[#F5F3FB] last:border-0 group">
                <button onClick={() => toggleGoal(g)}
                  className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 transition-all flex items-center justify-center ${done ? 'bg-[#111111] border-[#111111]' : 'border-[#C0B8D8] group-hover:border-[#111111]'}`}>
                  {done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}><polyline points="1.5 5 4 7.5 8.5 2"/></svg>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug transition-colors ${done ? 'line-through text-[#A89DC8]' : 'text-[#151121]'}`}>
                    {g.title.replace(/^\[Week \d+[-–]?\d*\]\s*/i, '')}
                  </p>
                  {g.agent_report && !done && (
                    <p className="text-xs text-violet-700 bg-violet-50 rounded-lg px-3 py-1.5 mt-1.5">{g.agent_report}</p>
                  )}
                  {(g.failure_context?.length ?? 0) > 0 && !done && (
                    <p className="text-xs text-red-400 mt-1">{g.failure_context.length} failed attempt(s)</p>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {/* Overall progress */}
              <div className="bg-white rounded-2xl border border-[#EDEAF5] p-5 flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-[#A89DC8] uppercase tracking-[0.12em]">Overall Progress · Week 1 → {sortedWeeks.length > 0 ? Math.max(...sortedWeeks) : "—"}</p>
                    <p className="text-sm font-bold text-[#0D0B1E]">{doneCount} <span className="text-[#A89DC8] font-normal">of</span> {totalGoals} done</p>
                  </div>
                  <div className="h-2.5 bg-[#F0ECFA] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ background: "linear-gradient(90deg, #111111, #9B7BF5)", width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-4xl font-black flex-shrink-0" style={{ color: "#111111" }}>{pct.toFixed(0)}%</div>
              </div>

              {/* Week cards — each sub-grouped by business area */}
              {sortedWeeks.map(week => {
                const wGoals = byWeek[week];
                const wDone = wGoals.filter(g => g.status === 'done' || g.status === 'completed').length;
                const wPct = wGoals.length > 0 ? (wDone / wGoals.length) * 100 : 0;
                // Sub-group by business area
                const wByArea: Record<string, Goal[]> = {};
                for (const g of wGoals) {
                  const area = bizArea(g);
                  if (!wByArea[area]) wByArea[area] = [];
                  wByArea[area].push(g);
                }
                return (
                  <div key={week} className="bg-white rounded-2xl border border-[#EDEAF5] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(17,17,17,0.04)" }}>
                    {/* Week header */}
                    <div className="px-6 pt-4 pb-3 border-b border-[#F5F3FB] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <p className="text-[10px] font-black text-[#A89DC8] uppercase tracking-[0.12em] flex-shrink-0">Week {week}</p>
                        <div className="flex-1 h-1.5 bg-[#F0ECFA] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500 bg-[#111111]" style={{ width: `${wPct}%` }} />
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#111111] flex-shrink-0">{wDone}/{wGoals.length}</span>
                    </div>
                    {/* Area sub-groups */}
                    <div className="divide-y divide-[#F5F3FB]">
                      {Object.entries(wByArea).map(([area, aGoals]) => (
                        <div key={area}>
                          <div className="px-6 pt-3 pb-1 flex items-center gap-2">
                            <span className="text-[11px]">{BIZ_EMOJI[area] ?? "•"}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: BIZ_COLOR[area] ?? "#111111" }}>{area}</span>
                          </div>
                          <div className="px-6">
                            {aGoals.map((g, i) => <GoalRow key={i} g={g} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Non-week goals */}
              {noWeek.length > 0 && (() => {
                const nByArea: Record<string, Goal[]> = {};
                for (const g of noWeek) {
                  const area = bizArea(g);
                  if (!nByArea[area]) nByArea[area] = [];
                  nByArea[area].push(g);
                }
                return (
                  <div className="bg-white rounded-2xl border border-[#EDEAF5] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(17,17,17,0.04)" }}>
                    <div className="px-6 pt-4 pb-3 border-b border-[#F5F3FB]">
                      <p className="text-[10px] font-black text-[#A89DC8] uppercase tracking-[0.12em]">Standing Goals</p>
                    </div>
                    <div className="divide-y divide-[#F5F3FB]">
                      {Object.entries(nByArea).map(([area, aGoals]) => (
                        <div key={area}>
                          <div className="px-6 pt-3 pb-1 flex items-center gap-2">
                            <span className="text-[11px]">{BIZ_EMOJI[area] ?? "•"}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: BIZ_COLOR[area] ?? "#111111" }}>{area}</span>
                          </div>
                          <div className="px-6">
                            {aGoals.map((g, i) => <GoalRow key={i} g={g} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ══ P0 — Core product (7.2) ═════════════════════════════════════════ */}
        {tab === "P0" && <OsP0Panel />}

        {/* ══ APPROVALS ══════════════════════════════════════════════════════ */}
        {tab === "Approvals" && (
          <div className="space-y-5">
            <Card>
              <SectionLabel>Founder approvals</SectionLabel>
              <p className="text-sm text-slate-500 mb-5 leading-relaxed max-w-3xl">
                Queue questions or proposed actions when you&apos;re unsure. Mercier reviews here (badge turns amber when items are pending).
                New requests trigger an email to the founder inbox when <span className="font-mono text-xs">RESEND_API_KEY</span> and{' '}
                <span className="font-mono text-xs">OS_APPROVAL_NOTIFY_EMAIL</span> (optional override) are set.
              </p>
              <div className="grid gap-4 max-w-2xl">
                <div>
                  <p className="text-[10px] font-bold text-[#A89DC8] uppercase tracking-widest mb-1.5">Title</p>
                  <input
                    value={appTitle}
                    onChange={e => setAppTitle(e.target.value)}
                    placeholder="Short summary — e.g. Deploy supplier credential change?"
                    className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#A89DC8] uppercase tracking-widest mb-1.5">Question / uncertainty</p>
                  <textarea
                    value={appQuestion}
                    onChange={e => setAppQuestion(e.target.value)}
                    placeholder="What do you need decided? What are you unsure about?"
                    rows={4}
                    className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y min-h-[100px]"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#A89DC8] uppercase tracking-widest mb-1.5">Proposed action (optional)</p>
                  <textarea
                    value={appProposed}
                    onChange={e => setAppProposed(e.target.value)}
                    placeholder="What you would do if approved…"
                    rows={2}
                    className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#A89DC8] uppercase tracking-widest mb-1.5">Created by</p>
                  <input
                    value={appCreatedBy}
                    onChange={e => setAppCreatedBy(e.target.value)}
                    placeholder="agent, cursor, your name…"
                    className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-400 max-w-xs"
                  />
                </div>
                <button
                  type="button"
                  disabled={appSubmitting || !appTitle.trim() || !appQuestion.trim()}
                  onClick={() => void submitApprovalRequest()}
                  className="self-start px-6 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-40 transition-opacity"
                  style={{ background: P }}
                >
                  {appSubmitting ? "Submitting…" : "Submit for approval"}
                </button>
              </div>
            </Card>

            <Card>
              <SectionLabel>Queue ({approvalRows.length})</SectionLabel>
              {approvalRows.length === 0 ? (
                <Empty text="No approval requests yet." />
              ) : (
                <div className="space-y-4">
                  {approvalRows.map(row => (
                    <div
                      key={row.id}
                      className={`rounded-2xl border p-5 ${row.status === "pending" ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-slate-50/50"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-base font-bold text-[#151121]">{row.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(row.created_at).toLocaleString("en-GB")} · from{' '}
                            <span className="font-semibold text-slate-500">{row.created_by}</span>
                          </p>
                        </div>
                        <Tag text={row.status} color={row.status === "pending" ? "conversation" : "product"} />
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed mb-3">{row.question_text}</p>
                      {row.proposed_action && (
                        <div className="mb-3 text-sm">
                          <span className="font-bold text-violet-600">Proposed: </span>
                          <span className="text-slate-600 whitespace-pre-wrap">{row.proposed_action}</span>
                        </div>
                      )}
                      {row.status !== "pending" && row.resolution_notes && (
                        <p className="text-sm text-slate-500 mb-2">
                          <span className="font-bold text-slate-700">Notes: </span>
                          {row.resolution_notes}
                        </p>
                      )}
                      {row.status === "pending" && (
                        <>
                          <textarea
                            value={resolveNotes[row.id] ?? ""}
                            onChange={e => setResolveNotes(prev => ({ ...prev, [row.id]: e.target.value }))}
                            placeholder="Reply / instructions for the agent…"
                            rows={2}
                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl bg-white mb-3 focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void resolveApproval(row.id, "approved")}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:brightness-110"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void resolveApproval(row.id, "rejected")}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 text-white hover:brightness-110"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => void resolveApproval(row.id, "resolved")}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-600 text-white hover:brightness-110"
                            >
                              Resolved / answered
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ══ PLAYBOOKS ═════════════════════════════════════════════════════ */}
        {tab === "Playbooks" && (
          <div className="flex flex-1 min-h-0 flex-col">
            <div className="shrink-0 px-8 pt-6 pb-3 border-b border-[#EDEAF5] bg-[#FAF8FF]">
              <p className="text-xs font-semibold text-amber-900 leading-relaxed max-w-4xl">
                <strong>Reference only.</strong> These runbooks do not complete Agents tasks or Approvals — use them alongside execution in Approvals, Agents, and Goals.
              </p>
            </div>
            <div className="flex flex-1 min-h-0">
              <aside className="w-full max-w-[22rem] shrink-0 border-r border-[#EDEAF5] overflow-y-auto bg-white">
                <div className="p-4 space-y-2">
                  {OS_PLAYBOOKS.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setPlaybookSlug(p.slug)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                        playbookSlug === p.slug
                          ? "border-violet-400 bg-violet-50 shadow-[0_1px_3px_rgba(17,17,17,0.08)]"
                          : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-sm font-bold text-[#151121]">{p.label}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-snug">{p.blurb}</p>
                    </button>
                  ))}
                </div>
              </aside>
              <main className="flex-1 min-w-0 overflow-y-auto px-8 py-6 bg-[#FDFCFF]">
                {playbookLoading && <Empty text="Loading playbook…" />}
                {!playbookLoading && playbookErr && (
                  <p className="text-sm text-red-600">{playbookErr}</p>
                )}
                {!playbookLoading && !playbookErr && playbookMd ? (() => {
                  const meta = OS_PLAYBOOKS.find((x) => x.slug === playbookSlug);
                  return (
                    <div className="max-w-3xl space-y-6">
                      {meta && (
                        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-sm text-slate-700 space-y-2">
                          <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Cross-check in OS</p>
                          {meta.relatedApprovalTitles.length > 0 ? (
                            <p>
                              <span className="font-semibold text-slate-800">Approvals — </span>
                              {meta.relatedApprovalTitles.join(" · ")}
                            </p>
                          ) : null}
                          {meta.relatedAgentHints.length > 0 ? (
                            <p>
                              <span className="font-semibold text-slate-800">Agents — filter/search hints: </span>
                              {meta.relatedAgentHints.join(" · ")}
                            </p>
                          ) : null}
                          {meta.relatedApprovalTitles.length === 0 && meta.relatedAgentHints.length === 0 ? (
                            <p className="text-slate-500">No preset mappings — cross-check Approvals and Agents manually.</p>
                          ) : null}
                          <p className="text-[11px] text-slate-500 font-mono pt-1 border-t border-violet-100/80">docs/{meta.fileName}</p>
                        </div>
                      )}
                      <article className="text-sm text-[#1e1b2e] leading-relaxed whitespace-pre-wrap font-sans">
                        {playbookMd}
                      </article>
                    </div>
                  );
                })() : null}
                {!playbookLoading && !playbookErr && !playbookMd ? (
                  <Empty text="Pick a playbook from the list or fix the missing file on disk." />
                ) : null}
              </main>
            </div>
          </div>
        )}

        {/* ══ EVENTS ════════════════════════════════════════════════════════ */}
        {tab === "Events" && (
          <Card>
            <SectionLabel>Event Timeline ({events.length})</SectionLabel>
            <p className="text-sm text-slate-500 mb-6 max-w-2xl leading-relaxed">
              Tap an event for a plain-English explanation, then expand raw JSON below if you need exact fields for tools or audits.
            </p>
            {events.length === 0 ? <Empty text="No events yet." /> : (
              <div>
                {events.map((e, i) => (
                  <OsEventRow key={e.id ?? `ev-${e.created_at}-${i}`} ev={e} />
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ══ CONTEXT LOG ═══════════════════════════════════════════════════ */}
        {tab === "Context Log" && (
          <div className="space-y-5">
            {context.length === 0 ? (
              <Card><Empty text="No sessions logged yet." /></Card>
            ) : (
              context.map((c, i) => (
                <Card key={i}>
                  <div className="flex items-center gap-3 mb-4">
                    <Tag text={c.session_type} color={c.session_type} />
                    <p className="text-sm text-slate-400">{new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                  <p className="text-base text-slate-700 leading-relaxed mb-6">{c.summary}</p>

                  {(c.work_completed as unknown[])?.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-3">Work Completed ({(c.work_completed as unknown[]).length})</p>
                      <div className="space-y-2">
                        {(c.work_completed as { task: string; result: string }[]).map((w, j) => (
                          <div key={j} className="flex gap-3">
                            <span className="text-emerald-500 font-bold flex-shrink-0 mt-0.5">✓</span>
                            <p className="text-base text-slate-700"><span className="font-semibold">{w.task}</span> — <span className="text-slate-500">{w.result}</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(c.decisions_made as unknown[])?.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-black text-violet-600 uppercase tracking-widest mb-3">Decisions ({(c.decisions_made as unknown[]).length})</p>
                      <div className="space-y-2">
                        {(c.decisions_made as { decision: string; rationale: string }[]).map((d, j) => (
                          <div key={j} className="flex gap-3">
                            <span className="text-violet-500 font-bold flex-shrink-0 mt-0.5">→</span>
                            <p className="text-base text-slate-700"><span className="font-semibold">{d.decision}</span>{d.rationale ? <span className="text-slate-500"> — {d.rationale}</span> : null}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(c.open_loops as unknown[])?.length > 0 && (
                    <div>
                      <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-3">Open Loops ({(c.open_loops as unknown[]).length})</p>
                      <div className="space-y-3">
                        {(c.open_loops as { task: string; blocker: string; next_action: string }[]).map((l, j) => (
                          <div key={j} className="bg-amber-50 rounded-2xl px-4 py-3">
                            <p className="text-base font-semibold text-[#151121]">{l.task}</p>
                            {l.blocker && <p className="text-sm text-slate-500 mt-0.5">{l.blocker}</p>}
                            {l.next_action && <p className="text-sm text-blue-600 mt-1 font-medium">→ {l.next_action}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}

            {decisions.length > 0 && (
              <Card>
                <SectionLabel>Founder Decision Log ({decisions.length})</SectionLabel>
                <div className="divide-y divide-slate-50">
                  {decisions.map((d, i) => (
                    <div key={i} className="py-4 first:pt-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <p className="text-base font-bold text-[#151121]">{d.decision}</p>
                        <p className="text-sm text-slate-400 flex-shrink-0">{d.created_at?.slice(0, 10)}</p>
                      </div>
                      {d.rationale && <p className="text-sm text-slate-500">Why: {d.rationale}</p>}
                      {d.expected_outcome && <p className="text-sm text-slate-400 mt-0.5">Expected: {d.expected_outcome}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ══ OS STATE ══════════════════════════════════════════════════════ */}
        {tab === "OS State" && (
          <div className="space-y-5">
            {Object.keys(osState).length === 0 ? (
              <Card><Empty text="OS state not loaded. Run the SQL and refresh." /></Card>
            ) : (
              Object.entries(osState).map(([cat, state]) => (
                <Card key={cat}>
                  <SectionLabel>{cat.replace(/_/g, " ")}</SectionLabel>
                  <div className="divide-y divide-slate-50">
                    {Object.entries(state).map(([k, v]) => (
                      <div key={k} className="flex gap-6 py-3 first:pt-0">
                        <span className="text-sm font-semibold text-slate-500 min-w-44 flex-shrink-0 capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="text-base text-[#151121] font-mono text-sm break-all">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === "Shipped" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: P }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0D0B1E]">Shipped Features</h2>
                <p className="text-sm text-slate-500">Every feature live in production — what it does and why it matters</p>
              </div>
            </div>

            {SHIPPED_FEATURES.map((group) => (
              <div key={group.category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{group.category}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{group.features.length} feature{group.features.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {group.features.map((f) => (
                    <div key={f.name} className="bg-white border border-slate-100 rounded-xl p-5 hover:border-violet-200 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base font-semibold text-[#0D0B1E]">{f.name}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              f.impact === "high" ? "bg-purple-100 text-purple-700" :
                              f.impact === "medium" ? "bg-blue-100 text-blue-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>{f.impact} impact</span>
                          </div>
                          <p className="text-sm text-slate-600 mb-3 leading-relaxed">{f.description}</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {f.files.map((file) => (
                              <code key={file} className="text-xs bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">{file}</code>
                            ))}
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            <p className="text-xs text-violet-700 leading-relaxed"><span className="font-semibold">Why it matters: </span>{f.why}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-slate-400">{f.shippedAt}</div>
                          <div className="mt-1">
                            <span className="text-xs bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full font-medium">Live</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Roadmap" && (
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: P }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 6l9-3 9 3M3 18l9 3 9-3" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0D0B1E]">Product Roadmap</h2>
                <p className="text-sm text-slate-500">Sourced from Obsidian notes — what&apos;s built, what&apos;s in progress, what&apos;s next, and what&apos;s broken</p>
              </div>
            </div>

            {/* Section A — Shipped */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">A — Implemented / Shipped</span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">Live in production</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {([
                  { name: "Per-Unit Pricing + Best Value Badge", desc: "Each search result shows price per unit (per glove, per cartridge). The supplier with the lowest per-unit cost gets a green Best Value badge — makes the real comparison instantly obvious.", source: "What We Need To Implement.md (§9)", status: "shipped" },
                  { name: "Clinical Equivalent Substitution Banner", desc: "When a clinic searches for a branded product (e.g. Septanest), Dentago detects if a cheaper clinical equivalent exists and shows a non-intrusive info banner. Covers 6 clinical categories.", source: "What We Need To Implement.md (§5.7)", status: "shipped" },
                  { name: "Onboarding Checklist (3-step)", desc: "A 3-step checklist (Connect supplier → Search product → View product) appears on the clinic dashboard until complete. Tracks real data from the DB. Dismissible for 7 days.", source: "CEO TODOs — 1 May 2026.md (TODO 1)", status: "shipped" },
                  { name: "Supplier Credential Verification Before Save", desc: "When a clinic connects a supplier, Dentago verifies the login works before saving credentials. Shows clear error if login fails. Prevents silent bad states.", source: "CEO Review — 1 May 2026.md", status: "shipped" },
                  { name: "Authenticated Price Sync on Connect", desc: "When a clinic connects a supplier, a background price scrape fires immediately for 6 standard products. Results write to price_cache fire-and-forget — no waiting for the daily cron.", source: "CLAUDE.md (Shipped Features)", status: "shipped" },
                  { name: "Spend Analytics Dashboard", desc: "Full analytics at /clinic/analytics: total spend, orders placed, savings vs list price, spend breakdown by supplier (bar chart), monthly spend trend (6 months), top products by spend.", source: "CLAUDE.md (Shipped Features)", status: "shipped" },
                  { name: "Savings History Page", desc: "Dedicated /clinic/savings page showing total saved vs list prices, average savings %, and a full table of savings events per product. Hero stat in large purple text.", source: "What We Need To Implement.md (§7)", status: "shipped" },
                  { name: "Supplier GMV Tracking", desc: "Every order logs a supplier_gmv_directed event. Admin endpoint at /api/admin/gmv aggregates GMV by supplier for any time window — the primary asset for supplier partnership conversations.", source: "CEO TODOs — 1 May 2026.md (TODO 4)", status: "shipped" },
                  { name: "Xero CSV Export", desc: "Clinics can export order history as a Xero-compatible CSV from /api/clinic/orders/export. Matches Xero purchase invoice import template exactly. Supports date range filtering.", source: "PRD — 6.3.4 Invoice Consolidation", status: "shipped" },
                  { name: "Par Level Stock Tracking + Stockout Alerts", desc: "Clinics set par levels and reorder points per product. Email alerts fire when stock drops below threshold. ParLevelBadge component shows Low Stock / Order Soon / In Stock. 48-hour cooldown to prevent alert fatigue.", source: "What We Need To Implement.md (§5.6)", status: "shipped" },
                  { name: "SKU Deduplication + Review Queue", desc: "Daily cron compares all products using Jaccard token-set overlap. Pairs with >70% name similarity across suppliers are flagged in sku_match_candidates. Admins approve/reject via /api/admin/sku-matches.", source: "What We Need To Implement.md (§5.3)", status: "shipped" },
                  { name: "Dental Sky Catalog Coverage Fix (570 → 2,000+ SKUs)", desc: "Fixed the Dental Sky scraper from 17 hardcoded categories to full GraphQL tree crawl via discoverAllCategoryIds(). Expanded real-priced catalog from 570 to 2,000+ SKUs.", source: "What We Need To Implement.md (§5.2)", status: "shipped" },
                  { name: "GDC Auto-Verification", desc: "Clinic GDC numbers are automatically verified against the GDC public register via HTTP form POST. Daily cron processes unverified clinics (max 10/run). Removes the manual bottleneck from clinic activation.", source: "CEO TODOs — 1 May 2026.md (TODO 6)", status: "shipped" },
                  { name: "Savings Calculator (floating widget + cart + badges)", desc: "Real-time savings widget on search page, cart panel savings summary, product card Save £X badges, annual projection. The centrepiece of every demo.", source: "PRD — 6.2.6 Savings Calculator", status: "shipped" },
                  { name: "GDC Registration Verification (clinic onboarding)", desc: "Multi-step onboarding with document upload and admin verification dashboard. Verified practices get full marketplace access. GDC number checked before supplier connections are enabled.", source: "PRD — 6.2.1", status: "shipped" },
                  { name: "Savings Page — % Saved Metric + Aligned Table", desc: "Added a green banner showing average % saved vs market price, a 4th hero stat card (Avg. Saving %), and a fixed-width grid table so the % cheaper column and inline bar chart align correctly.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "Analytics Page — Real Tracked Savings (not £0.00)", desc: "Replaced hardcoded savings_vs_list = 0 with a real query: first checks clinic_savings_log, then falls back to comparing dentago_order_items against price_cache market highs. Returns savings_pct alongside the £ figure.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "Savings + All Pages — Consistent Header", desc: "Savings page header was misaligned (wrong max-w, height, padding) vs every other page. Fixed to match: max-w-6xl h-[60px] px-6. Content area given mt-8 so title no longer sticks to the nav.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "ProfileMenu — Hides Current Page Link", desc: "ProfileMenu dropdown now uses usePathname and conditionally omits the link for whichever page the user is already on. Clinics on /orders no longer see an Order History link that goes nowhere.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "Test Account Order Bypass (Warren Ben H)", desc: "bihaga8336@gixpos.com can place orders without being connected to any supplier. The supplier-connection gate in /api/orders/route.ts is skipped for accounts in the TEST_EMAILS allowlist.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "Page Headers — Cart Button Added, Dashboard/Savings/Shop Removed", desc: "Removed Dashboard, Savings, and Shop shortcut buttons from all page headers. Added Cart button to every page header. Keeps nav uncluttered and consistent.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "Supplier Logos + Total Dent Added, Test Supplier Removed", desc: "All Clearbit logos replaced with Google favicon service (reliable). Added Total Dent, Medisave, J&S Davis, Medentra, Nuvelo to the supplier list. Test Supplier filtered out of the displayed list.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "Bulk Product Sync on Supplier Connect (all products, not 6)", desc: "triggerInitialSync now queries dentago_supplier_products for all products (up to 500) for the connected supplier and syncs in batches of 10. Falls back to 6 hardcoded terms only if no products found.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "Admin Force-Sync Endpoint + OS UI", desc: "POST /api/admin/force-sync syncs all products for all clinics that have credentials for a given supplier. Returns clinics_synced, prices_written, products_attempted. Accessible from OS → Supplier GMV tab via a supplier dropdown + Force Sync button.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "ChatWidget Hidden on /os", desc: "The chat bubble was appearing on the internal OS dashboard. Fixed by adding a usePathname guard in ChatWidget.tsx — the component returns null on any route starting with /os.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "OS Roadmap Tab", desc: "New Roadmap tab in the OS built from a full review of all Obsidian notes. Four sections: Shipped (15 features), In Progress (5), Backlog/Planned (16 items), Bugs & Issues (10). Each item has source attribution.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "OS Chat Tab — Full Redesign", desc: "Chat tab rebuilt to full-screen height with a dark sidebar (#0D0B1E) showing session list with avatars, time-ago stamps, and a green live dot. Thread pane with purple/white message bubbles and a gradient send button. Matches Framer/Cortex-level quality.", source: "Session — 2026-05-06", status: "shipped" },
                  { name: "Force Sync IIFE Bug Fixed", desc: "The Force Sync UI in OS → Supplier GMV was using useState inside an IIFE in JSX, violating React hooks rules. Extracted into a proper ForceSyncButton top-level component.", source: "Session — 2026-05-06", status: "shipped" },
                ] as { name: string; desc: string; source: string; status: string }[]).map((item) => (
                  <div key={item.name} className={`bg-white border ${BORDER} rounded-2xl p-5 ${CARD_SHADOW} hover:border-violet-200 hover:shadow-sm transition-all`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0D0B1E] mb-1">{item.name}</p>
                        <p className="text-sm text-slate-500 leading-relaxed mb-2">{item.desc}</p>
                        <p className="text-xs text-[#A89DC8]">Source: {item.source}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs bg-green-50 text-green-600 border border-green-100 px-2.5 py-0.5 rounded-full font-medium">Shipped</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section B — In Progress */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">B — In Progress</span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">Being built now</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {([
                  { name: "Henry Schein Supplier Account Connection", desc: "Clinics connect their existing Henry Schein login so Dentago reads their real negotiated prices. This is the #1 build priority — without it, every savings figure shown is estimated, not real.", source: "What We Need To Implement.md (§5.1)", status: "in_progress" },
                  { name: "Email Deliverability Warm-Up (Instantly.ai)", desc: "Domain reputation is new (~10 days old). Emails landing in spam. Fix: migrate sending to Instantly.ai for warm-up, set up Google Postmaster Tools, resume high-volume sends after 2–3 weeks.", source: "Email Outreach — Master Tracker.md", status: "in_progress" },
                  { name: "Clinic Activation Flow End-to-End", desc: "Fixing the full flow from signup → verification → first search → first order. The dashboard currently shows empty state for new verified clinics — the onboarding checklist has been shipped but the full flow needs QA.", source: "CLAUDE.md (This Week goals)", status: "in_progress" },
                  { name: "Cold Email Outreach Scaling (500+/day)", desc: "Currently at ~2,531 emails sent across 11 batches. Target is 500+ targeted emails/day. Follow-ups running. Next: scale through Instantly.ai once domain warmed.", source: "Email Outreach — Master Tracker.md", status: "in_progress" },
                  { name: "Connected Supplier Pricing Display Fix", desc: "Dental Sky and Kent Express connected accounts not showing correct pricing for some clinics. Active investigation.", source: "OS Tasks #5", status: "in_progress" },
                ] as { name: string; desc: string; source: string; status: string }[]).map((item) => (
                  <div key={item.name} className={`bg-white border ${BORDER} rounded-2xl p-5 ${CARD_SHADOW} hover:border-blue-200 hover:shadow-sm transition-all`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0D0B1E] mb-1">{item.name}</p>
                        <p className="text-sm text-slate-500 leading-relaxed mb-2">{item.desc}</p>
                        <p className="text-xs text-[#A89DC8]">Source: {item.source}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-0.5 rounded-full font-medium">In Progress</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section C — Backlog */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">C — Not Yet Built / Backlog</span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">Planned</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {([
                  { name: "Kent Express + Henry Schein Supplier Account Connections", desc: "After Henry Schein, connect Kent Express and other top suppliers. Clinics connect their existing logins — Dentago reads their real negotiated prices. Every 'est.' label disappears once connected.", source: "What We Need To Implement.md (§5.1)", priority: "P0" },
                  { name: "SKU Matching Confidence Threshold + Clinical Review Queue", desc: "Define a confidence threshold for product matching. Low-confidence matches go to a manual review queue before appearing in savings comparisons. Required before savings comparisons are shown at scale.", source: "CEO TODOs — 1 May 2026.md (TODO 3)", priority: "P0" },
                  { name: "Admin MFA + Verification Audit Log", desc: "Require MFA for all admin accounts. Log every verification action (approved/rejected/who/when). Prevents fraudulent clinic approvals if admin account is compromised.", source: "CEO TODOs — 1 May 2026.md (TODO 2)", priority: "P0" },
                  { name: "Smart Reorder Reminders", desc: "Pull order history, detect ordering frequency per product, surface 'You usually order [item] every 3 weeks — last ordered 22 days ago.' One email trigger + one dashboard card. 80% of the value of full autonomous reordering.", source: "What We Need To Implement.md (§5.5) / PRD 6.3.2", priority: "P1" },
                  { name: "Week-4 Leading Indicator Dashboard", desc: "Internal PostHog dashboard tracking: daily signups, verification rate, days to first search, and second-order rate within 14 days. Early warning system — if metrics are wrong, know by week 4 not at D60.", source: "CEO TODOs — 1 May 2026.md (TODO 5)", priority: "P1" },
                  { name: "BDA / ADAM Association Partnership", desc: "Pitch the British Dental Association and ADAM to offer Dentago as a free member benefit. One deal unlocks distribution to thousands of practices with the association's trust behind it. The VetCove AVMA move.", source: "PRD 8.2 / CEO Review", priority: "P1" },
                  { name: "Supplier Portal v1 (Read-Only Orders Dashboard)", desc: "Suppliers need to see orders placed through Dentago and manage their catalog. Start with a read-only order dashboard. Required to convert informal scraping relationships into formal partnerships.", source: "What We Need To Implement.md (§5.8) / PRD 6.4.1", priority: "P1" },
                  { name: "Parallel GTM Channels (Facebook Groups, WhatsApp Networks, CPD Events)", desc: "UK dental Facebook groups, WhatsApp practice manager networks, local CPD events, LinkedIn outreach. BDA is a multiplier not a dependency — these run in parallel now.", source: "CEO TODOs — 1 May 2026.md (TODO 7)", priority: "P1" },
                  { name: "AI Procurement Assistant", desc: "Savings scan: analyse past 3 months of orders and identify where the clinic overpaid. Budget forecast: predict next month's supply spend. Promotional alerts. Smart substitution suggestions.", source: "PRD 6.4.3 / What We Need To Implement.md", priority: "P2" },
                  { name: "DSO Multi-Location Structure", desc: "Parent org with child clinic accounts. Consolidated spend view. Approval workflows. Spend limits. This unlocks the highest-GMV accounts. Jamil Torofdar (7 practices) is the prototype for this persona.", source: "What We Need To Implement.md (§5.9) / PRD 6.4.2", priority: "P2" },
                  { name: "Invoice Consolidation", desc: "Dentago pays all suppliers, clinics pay Dentago once. Makes Dentago genuinely indispensable and unlocks monetisation via float/credit. Natural unlock for supplier partnership conversations.", source: "What We Need To Implement.md (§5.10) / PRD 6.3.4", priority: "P2" },
                  { name: "Group Purchasing / Negotiated Rates (Dentago Price)", desc: "At 200+ clinics, approach top UK suppliers with combined network volume and negotiate a Dentago-exclusive rate. Clinics see a 'Dentago Price' badge — below anything they could negotiate individually. Gated at 200 active clinics.", source: "CEO Review — 1 May 2026.md (Scope Expansion 1)", priority: "P2" },
                  { name: "Autonomous Reordering", desc: "Based on 3+ months of order history, detect reorder patterns and surface one-tap confirmation orders. Eventually fully automatic with notification only. The retention moat — near-zero churn once running.", source: "CEO TODOs — 1 May 2026.md (TODO 9)", priority: "P2" },
                  { name: "G2 + Capterra Listings", desc: "Get Dentago listed on G2 and Capterra. SEO and trust signal for practices searching for procurement tools.", source: "CLAUDE.md (Active Goals — SEO)", priority: "P1" },
                  { name: "Dentago Private Label (\"Dentago Essentials\")", desc: "Source the 10 highest-volume commodity products (nitrile gloves, masks, wipes, sterilisation pouches) from manufacturers. Brand as Dentago Essentials. 40%+ gross margin vs 2.5% take rate. Revisit post-Seed.", source: "CEO TODOs — 1 May 2026.md (TODO 11)", priority: "Deferred" },
                  { name: "Embedded Invoice Financing (BNPL)", desc: "Dentago pays suppliers immediately, clinics pay on 30–60 day terms. Revenue: 1.5–2% per invoice financed. Requires FCA authorisation for credit activity. Revisit at Series A.", source: "CEO TODOs — 1 May 2026.md (TODO 10)", priority: "Deferred" },
                ] as { name: string; desc: string; source: string; priority: string }[]).map((item) => {
                  const pColor = item.priority === "P0" ? "bg-red-50 text-red-600 border-red-100" : item.priority === "P1" ? "bg-amber-50 text-amber-600 border-amber-100" : item.priority === "P2" ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-slate-50 text-slate-500 border-slate-100";
                  return (
                    <div key={item.name} className={`bg-white border ${BORDER} rounded-2xl p-5 ${CARD_SHADOW} hover:shadow-sm transition-all`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0D0B1E] mb-1">{item.name}</p>
                          <p className="text-sm text-slate-500 leading-relaxed mb-2">{item.desc}</p>
                          <p className="text-xs text-[#A89DC8]">Source: {item.source}</p>
                        </div>
                        <span className={`flex-shrink-0 text-xs border px-2.5 py-0.5 rounded-full font-medium ${pColor}`}>{item.priority}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section D — Bugs & Issues */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">D — Bugs & Issues</span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">Known problems</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {([
                  { name: "Savings figures are estimated, not real (for non-Dental Sky products)", desc: "Non-Dental Sky prices are labelled 'est.' but estimates are derived from category-level inference, not real supplier price data. A Henry Schein estimate based on search terms is not a real price. Breaks trust the moment a real user checks it against their actual account rate.", source: "What We Need To Implement.md (§4)", severity: "critical" },
                  { name: "Dental Sky real-priced catalog: only ~570 SKUs (was 10,707 attempted)", desc: "The DS scraper found 10,707 products but refreshed only ~300 and added 0 new. 10,407 failed — most likely products with price: 0 or nested configurable products. The catalog fix (discoverAllCategoryIds) should have resolved this — verify count is now 2,000+.", source: "What We Need To Implement.md (§4)", severity: "high" },
                  { name: "307 products with no supplier pricing at all", desc: "Filtered from search results (correct) but exist in the DB. Represent gaps in catalog coverage that make the platform feel incomplete when a clinic searches for a product they order regularly.", source: "What We Need To Implement.md (§4)", severity: "high" },
                  { name: "Connected supplier pricing display broken (Dental Sky + Kent Express)", desc: "Some connected clinic accounts are not showing correct supplier pricing. Jerome Sebah's account flagged as a specific case. Active investigation.", source: "OS Tasks #4 & #5", severity: "high" },
                  { name: "Email deliverability — new domain landing in spam", desc: "~2,531 emails sent but domain is only 10 days old. SPF/DKIM/DMARC are now set but reputation needs 2–3 weeks of warm-up. Current sends may have low deliverability. Google Postmaster Tools not yet set up.", source: "Email Outreach — Master Tracker.md", severity: "medium" },
                  { name: "/orders page broken", desc: "The /orders page is flagged as needing a fix in the active product goals.", source: "CLAUDE.md (Active Goals — Product)", severity: "medium" },
                  { name: "/clinic/suppliers styling issues", desc: "The /clinic/suppliers page has known styling problems flagged in active product goals.", source: "CLAUDE.md (Active Goals — Product)", severity: "low" },
                  { name: "Demo CTA missing on /search", desc: "No demo booking CTA on the search page. Clinics who discover the product organically via search have no prompt to book a demo or connect a supplier. Lost conversion.", source: "CLAUDE.md (Active Goals — Product)", severity: "medium" },
                  { name: "SKU matching produces false savings on mismatched products", desc: "Wrong SKU match = false savings displayed to the clinic. Confidence threshold not yet enforced — any fuzzy match appears in savings comparisons. Clinical safety risk if wrong product is ordered as a result.", source: "CEO Review — 1 May 2026.md (Failure Modes)", severity: "high" },
                  { name: "Admin verification panel has no MFA or audit log", desc: "A compromised admin account can approve fraudulent clinic registrations. No MFA enforced, no append-only verification audit log. Security gap before any clinic data is live at scale.", source: "CEO Review — 1 May 2026.md (Failure Modes)", severity: "high" },
                ] as { name: string; desc: string; source: string; severity: string }[]).map((item) => {
                  const sColor = item.severity === "critical" ? "bg-red-100 text-red-700 border-red-200" : item.severity === "high" ? "bg-orange-50 text-orange-600 border-orange-100" : item.severity === "medium" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-50 text-slate-500 border-slate-100";
                  return (
                    <div key={item.name} className={`bg-white border ${item.severity === "critical" ? "border-red-200" : BORDER} rounded-2xl p-5 ${CARD_SHADOW} hover:shadow-sm transition-all`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0D0B1E] mb-1">{item.name}</p>
                          <p className="text-sm text-slate-500 leading-relaxed mb-2">{item.desc}</p>
                          <p className="text-xs text-[#A89DC8]">Source: {item.source}</p>
                        </div>
                        <span className={`flex-shrink-0 text-xs border px-2.5 py-0.5 rounded-full font-medium ${sColor}`}>{item.severity}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "Founder Feedback" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#0D0B1E] mb-1">Founder Feedback</h2>
              <p className="text-sm text-[#A89DC8]">Direct product priorities logged by the founder. Engineering must action these before new features.</p>
            </div>

            {/* Priority 1 */}
            <Card>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <span className="text-sm font-bold text-red-500">1</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">Critical — Fix Now</span>
                    <span className="text-[10px] bg-red-50 text-red-400 font-semibold px-2 py-0.5 rounded-full">Performance</span>
                  </div>
                  <h3 className="text-base font-bold text-[#0D0B1E] mb-1">Site is laggy and slow</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    The overall site performance is poor. Pages feel sluggish and unresponsive. This is the highest priority fix — a slow site kills demo conversions and clinic activation. Investigate render-blocking resources, Supabase query waterfalls, missing loading states, and Vercel edge config. Profile with Lighthouse and fix until Core Web Vitals are green.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#A89DC8]">Logged by founder · 2026-05-07</span>
                    <span className="w-1 h-1 rounded-full bg-[#D1C9E8]" />
                    <span className="text-[11px] font-semibold text-red-400">Unresolved</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Priority 2 */}
            <Card>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <span className="text-sm font-bold text-amber-500">2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">High Priority</span>
                    <span className="text-[10px] bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Search / UX</span>
                  </div>
                  <h3 className="text-base font-bold text-[#0D0B1E] mb-1">Search must have filters</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    When clinics search for products, there are no filters. They cannot narrow by supplier, category, price range, or stock status. This makes the search experience unusable at scale — clinics will bounce instead of ordering. Add sidebar or inline filters to the <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">/search</code> page covering at minimum: supplier, product category, price range, and in-stock only.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#A89DC8]">Logged by founder · 2026-05-07</span>
                    <span className="w-1 h-1 rounded-full bg-[#D1C9E8]" />
                    <span className="text-[11px] font-semibold text-amber-400">Unresolved</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* How to add more */}
            <div className="rounded-2xl border border-dashed border-[#EDEAF5] p-5 text-center">
              <p className="text-sm text-[#A89DC8]">Add new feedback directly here or via the OS approval queue.</p>
            </div>
          </div>
        )}

        {tab === "Pivot Features" && (
          <div className="space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-7 text-white">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">⚡</span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Pivot Features</h2>
                  <p className="text-violet-200 text-sm mt-0.5">Category-defining bets that become defensive moats. Not roadmap items — paradigm shifts.</p>
                </div>
              </div>
              <p className="text-violet-100 text-sm leading-relaxed mt-4 border-t border-white/20 pt-4">
                These features go beyond the core marketplace. Executed correctly, they make Dentago extremely difficult to displace — because they compound with usage, generate proprietary data, and create switching costs that have nothing to do with price.
              </p>
            </div>

            {/* ── Feature 1: AI Substitutions ── */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              {/* Feature header */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-lg">🧠</span>
                    <h3 className="text-base font-bold text-slate-900">AI Substitutions System</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">Phase 1 — Build Now</span>
                  </div>
                  <p className="text-sm text-slate-500 ml-7">Autonomous purchasing intelligence. When a clinic searches, reorders, hits a stockout, overpays, or exceeds budget — Dentago intelligently recommends better alternatives.</p>
                </div>
              </div>

              <div className="p-6 space-y-7">

                {/* Strategic importance */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Why This Becomes a Moat</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { icon: "🛒", title: "Higher Order Conversion", desc: "Clinics complete orders instead of abandoning when something is OOS or overpriced" },
                      { icon: "📈", title: "More GMV", desc: "Every rescued stockout and smart swap is additional order volume through Dentago" },
                      { icon: "🔒", title: "Switching Cost Lock-in", desc: "AI learns clinic preferences over time — the system becomes more accurate with every order" },
                      { icon: "🎯", title: "Supplier Routing Control", desc: "Dentago controls which supplier wins the order — this is massive commercial leverage" },
                      { icon: "🗄️", title: "Data Moat", desc: "Clinic behaviour, reorder patterns, substitution acceptance — impossible to replicate once accumulated" },
                      { icon: "🤖", title: "Real AI Differentiation", desc: "Operational utility, not chatbot theatre. Clinics trust it because it works." },
                    ].map(b => (
                      <div key={b.title} className="bg-white border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-base">{b.icon}</span>
                          <span className="text-xs font-bold text-slate-800">{b.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{b.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 1 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                    <h4 className="text-sm font-bold text-slate-800">Phase 1 — Rule-Based Substitutions</h4>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Start here — deterministic trust first</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        n: "1.1", title: "Product Equivalency Engine", badge: "Foundation",
                        body: "Every SKU mapped into: category, subcategory, intended use, compatible procedures, material type, brand tier, dimensions, sterilisation type, regulatory equivalence, clinician preference tags. Without this normalisation layer, substitutions are dangerous. Example: 3M Filtek Supreme Flowable A2 → restorative composite · flowable · shade A2 · light-cure · nano-hybrid → valid subs: Kulzer Venus Flow A2, Tokuyama Estelite Flow Quick A2.",
                      },
                      {
                        n: "1.2", title: "Substitute Confidence Score", badge: "Trust Layer",
                        body: "Every recommendation carries a score: 98% equivalent / 91% equivalent / 76% equivalent. Inputs: exact material match, same dimensions, same procedure type, same manufacturer family, clinician acceptance rate, reorder retention, return rate, complaint rate. Clinicians need to see the number. High confidence removes fear.",
                      },
                      {
                        n: "1.3", title: "Multi-Objective Optimisation", badge: "Core UX",
                        body: "Each substitute optimises across: Cheapest (cost savings) · Fastest delivery (operational continuity) · Highest-rated (clinical trust) · Most reordered (social proof) · In-stock alternative (stockout prevention) · Preferred clinic brand (personalisation). UI: \"Alternative available — Save £14 · Arrives tomorrow · Used by 183 clinics · 96% reorder satisfaction\"",
                      },
                      {
                        n: "1.4", title: "Out-of-Stock Rescue Flow", badge: "🔥 Highest ROI",
                        body: "When item unavailable: auto-suggest replacements, one-click replace, maintain cart continuity, preserve treatment compatibility. \"Your gloves are unavailable. Equivalent alternatives: same fit/material · 4% cheaper · ships today.\" Directly prevents procurement abandonment — highest immediate ROI of anything in Phase 1.",
                      },
                      {
                        n: "1.5", title: "Smart Cart Recommendations", badge: "Order Optimiser",
                        body: "Inside the cart: consolidate suppliers, reduce shipping costs, optimise basket composition, suggest better pack sizing, remove duplicate SKUs. \"You can reduce shipping by £22 by switching 2 items to Supplier B.\" Turns Dentago from a search tool into a procurement optimiser.",
                      },
                    ].map(f => (
                      <div key={f.n} className="border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black text-slate-400 w-7">{f.n}</span>
                          <span className="text-sm font-bold text-slate-800">{f.title}</span>
                          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{f.badge}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed ml-7">{f.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 2 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <h4 className="text-sm font-bold text-slate-800">Phase 2 — Learning System</h4>
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Unlock at 50+ active clinics</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { title: "Clinic Preference Learning", desc: "System learns preferred brands, acceptable substitute ranges, material sensitivities, price tolerance, delivery expectations. If a clinic consistently rejects generic composites, the system adapts and stops recommending them." },
                      { title: "Procedure-Aware Intelligence", desc: "Map products to procedures. If composite usage is trending up, AI predicts reorder timing and likely shortages before they hit. Moves Dentago from reactive to predictive." },
                      { title: "Autonomous Reordering Suggestions", desc: "Not auto-order initially — suggest first. \"You likely need to reorder nitrile gloves in 5 days · bonding agent next week.\" High utility, low perceived risk." },
                      { title: "Supplier Reliability Scoring", desc: "AI evaluates delivery consistency, cancellation rates, stock reliability, invoice accuracy, backorder frequency — then adjusts recommendations away from unreliable suppliers regardless of price." },
                    ].map(f => (
                      <div key={f.title} className="border border-slate-100 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-800 mb-1.5">{f.title}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 3 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-slate-400 text-white text-[10px] font-black flex items-center justify-center">3</span>
                    <h4 className="text-sm font-bold text-slate-800">Phase 3 — AI Procurement Agent</h4>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Unlock at £500k/month GMV</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { title: "Conversational Procurement", desc: "\"Find me a cheaper alternative to our current implant drills but keep the same compatibility.\" \"Reduce this month's spend by 10% without changing restorative materials.\" Operational copilot." },
                      { title: "Budget-Constrained Optimisation", desc: "Clinic sets a monthly budget. AI reallocates purchases, suggests alternatives, consolidates suppliers, delays non-urgent items. CFO-level tooling for practice owners." },
                      { title: "Predictive Stock Risk Engine", desc: "AI predicts likely shortages, supplier disruptions, seasonal consumption spikes, and manufacturer instability before they affect the clinic. Mission-critical infrastructure." },
                    ].map(f => (
                      <div key={f.title} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                        <p className="text-xs font-bold text-slate-600 mb-1.5">{f.title}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* UX Principles */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">UX Principles — Non-Negotiable</h4>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3">
                      <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">🚫</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Never make clinicians feel overridden</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Wrong: <span className="italic">"We replaced your product."</span> &nbsp;→&nbsp; Correct: <span className="italic">"Recommended alternative."</span> Trust is everything in healthcare.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">💬</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Explain WHY every recommendation exists</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Price delta · compatibility explanation · delivery advantage · social proof · confidence score. Black-box AI fails in healthcare.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">🔒</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Allow preference locking</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Clinics must be able to ban brands, whitelist suppliers, lock clinical products, enforce preferred substitutes. Control reduces resistance.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Build sequence */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Build Sequence</h4>
                  <div className="space-y-1.5">
                    {[
                      { n: 1, task: "Product attribute normalisation schema (DB + admin UI)" },
                      { n: 2, task: "Equivalency mappings for top 200 SKUs by order volume" },
                      { n: 3, task: "Confidence scoring algorithm (rule-based v1)" },
                      { n: 4, task: "Out-of-stock rescue flow in cart" },
                      { n: 5, task: "Smart cart consolidation suggestions" },
                      { n: 6, task: "Clinic preference capture (accept/reject signals)" },
                      { n: 7, task: "Phase 2 learning system — trigger: 50+ active clinics" },
                      { n: 8, task: "Phase 3 AI agent — trigger: £500k/month GMV" },
                    ].map(s => (
                      <div key={s.n} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                        <span className="w-5 h-5 rounded-full border-2 border-slate-200 text-slate-400 text-[10px] font-black flex items-center justify-center flex-shrink-0">{s.n}</span>
                        <span className="text-[12px] text-slate-600">{s.task}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="bg-[#0D0B1E] rounded-xl p-5 text-center">
                  <p className="text-white font-bold text-sm mb-1">The substitutions system is not a feature.</p>
                  <p className="text-violet-300 text-xs">It is the beginning of AI-managed dental procurement. That is a very large category if executed correctly.</p>
                </div>

              </div>
            </div>

            {/* ── Feature 2: Invoice OCR System ── */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-lg">🧾</span>
                  <h3 className="text-base font-bold text-slate-900">Invoice OCR System</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">Phase 1 — Build Next</span>
                </div>
                <p className="text-sm text-slate-500 ml-7">Turn procurement paperwork into structured operational intelligence. The clinic should feel: <span className="italic">"I never think about invoices anymore."</span></p>
              </div>

              <div className="p-6 space-y-7">

                {/* Strategic importance */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Why Invoices Are the Data Engine</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { icon: "📅", title: "Daily Workflow Usage", desc: "Invoices arrive constantly — every touch increases platform stickiness" },
                      { icon: "💰", title: "Financial Visibility", desc: "Enables spend analytics and margin intelligence clinics currently have zero of" },
                      { icon: "📦", title: "Inventory Sync", desc: "Updates stock levels automatically from delivery confirmations" },
                      { icon: "🔍", title: "Fraud & Error Detection", desc: "Catches overcharges, duplicates, pricing discrepancies — huge trust driver" },
                      { icon: "📊", title: "Supplier Intelligence", desc: "Tracks pricing shifts and inflation per SKU over time" },
                      { icon: "🤖", title: "AI Training Data", desc: "Every processed invoice compounds the procurement intelligence moat" },
                      { icon: "🔗", title: "Accounting Integration", desc: "Expands Dentago's operational role into finance workflows" },
                      { icon: "🧠", title: "Margin Intelligence", desc: "Connects treatment revenue to material cost — procedure-level profitability" },
                    ].map(b => (
                      <div key={b.title} className="bg-white border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-base">{b.icon}</span>
                          <span className="text-xs font-bold text-slate-800">{b.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{b.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Architecture */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">System Architecture</h4>
                  <div className="flex flex-wrap gap-2">
                    {["Ingestion Layer", "OCR Layer", "Normalisation Engine", "Matching Engine", "Reconciliation Engine", "Analytics Layer"].map((l, i) => (
                      <div key={l} className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg">{l}</span>
                        {i < 5 && <span className="text-slate-300 text-sm">→</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3">Not just OCR extraction — a full intelligence pipeline from paper to structured data to operational insight.</p>
                </div>

                {/* Phase 1 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                    <h4 className="text-sm font-bold text-slate-800">Phase 1 — Smart Invoice Ingestion</h4>
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Start with friction reduction</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        n: "1.1", title: "Multi-Channel Invoice Capture", badge: "Entry Point",
                        body: "PDF upload · drag/drop · forwarded emails · supplier email auto-ingestion · mobile camera scans · bulk uploads. Eventually: supplier inbox sync. Clinics receive invoices in chaotic formats. You win by centralising intake into one place.",
                      },
                      {
                        n: "1.2", title: "Supplier Detection Engine", badge: "Template Intelligence",
                        body: "Automatically identify supplier, invoice format, currency, VAT structure, account numbers — via email domain, logo detection, invoice templates, keyword signatures. Every supplier invoice is structured differently. Template intelligence is the foundation.",
                      },
                      {
                        n: "1.3", title: "OCR + Document Parsing", badge: "🔑 Core Engine",
                        body: "Extract: invoice number, order number, supplier, line items, quantities, SKU/product codes, VAT, shipping, discounts, totals, delivery dates. Use layout-aware parsing and table extraction. Critical: line-item extraction matters more than total extraction. The real value is SKU-level intelligence.",
                      },
                      {
                        n: "1.4", title: "Confidence Layer", badge: "Trust Architecture",
                        body: "Every extracted field gets a confidence score and verification state. Low-confidence fields are highlighted for review and editable inline. Healthcare procurement cannot tolerate silent inaccuracies. Explainability is not optional.",
                      },
                    ].map(f => (
                      <div key={f.n} className="border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black text-slate-400 w-7">{f.n}</span>
                          <span className="text-sm font-bold text-slate-800">{f.title}</span>
                          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{f.badge}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed ml-7">{f.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 2 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <h4 className="text-sm font-bold text-slate-800">Phase 2 — Procurement Intelligence</h4>
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Where OCR becomes strategic</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { n: "5", title: "SKU Normalisation Engine", badge: "Foundational Infrastructure", desc: "Problem: supplier naming is inconsistent. \"Filtek Supreme Flow A2\" = \"3M Filtek Flow A2\" = \"3M Flowable A2 Syringe\" — all map to one canonical product entity. Without this: analytics break, substitutions fail, inventory becomes inaccurate." },
                      { n: "6", title: "Invoice-to-Order Reconciliation", badge: "🔥 High Value", desc: "Automatically compare ordered vs delivered vs invoiced items. Detect: missing items, overcharges, duplicate billing, quantity mismatches, pricing discrepancies. \"Supplier charged 14% above agreed contract pricing.\" Clinics rarely audit this manually." },
                      { n: "7", title: "Inventory Auto-Update", badge: "Workflow Win", desc: "When invoice is processed, stock levels update automatically. Received 40 boxes gloves + 12 composites + 5 implant kits → inventory instantly syncs. Removes manual stock entry completely." },
                      { n: "8", title: "Price Change Detection", badge: "Intelligence Layer", desc: "Track SKU price movements over time, supplier inflation, hidden increases. \"This product increased 11% in 60 days.\" Procurement visibility is weak in most clinics — this becomes high-value intelligence." },
                      { n: "9", title: "Duplicate Invoice Detection", badge: "Easy Trust Win", desc: "Detect repeated invoices, duplicate uploads, suspicious totals, accidental reprocessing. Very common operational issue. Fast to build, high perceived value." },
                    ].map(f => (
                      <div key={f.n} className="border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-black text-slate-400">{f.n}</span>
                          <span className="text-xs font-bold text-slate-800">{f.title}</span>
                          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">{f.badge}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 3 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">3</span>
                    <h4 className="text-sm font-bold text-slate-800">Phase 3 — Financial OS</h4>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">The system becomes infrastructure</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { title: "Invoice Approval Workflows", desc: "Role permissions, approval chains, budget thresholds. Nurse submits → manager approves → owner reviews large purchases." },
                      { title: "Payment Status Tracking", desc: "Paid · overdue · pending · disputed. Foundation for accounting system integration." },
                      { title: "Spend Categorisation", desc: "Auto-categorise: restorative, implants, hygiene, ortho, PPE, consumables. Enables benchmarking + margin analysis." },
                      { title: "Margin Intelligence", desc: "Connect treatment revenue to material usage to invoice spend. \"Implant procedure margin dropped 8% this quarter.\"" },
                    ].map(f => (
                      <div key={f.title} className="border border-slate-100 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-800 mb-1.5">{f.title}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 4 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-slate-400 text-white text-[10px] font-black flex items-center justify-center">4</span>
                    <h4 className="text-sm font-bold text-slate-800">Phase 4 — AI Financial Copilot</h4>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Long-term moat</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { title: "Procurement Anomaly Detection", desc: "\"Your composite spend is 31% above normal.\" AI flags unusual spend, excessive ordering, abnormal price jumps." },
                      { title: "Smart Invoice Queries", desc: "\"Show all invoices where gloves exceeded £200.\" \"Compare implant spend between locations.\"" },
                      { title: "Contract Compliance Monitoring", desc: "AI compares invoices against negotiated pricing, agreements, rebates. Flags violations automatically." },
                      { title: "Forecasting Engine", desc: "Predict monthly spend, inventory burn, seasonal purchasing, supplier dependency. Planning infrastructure." },
                    ].map(f => (
                      <div key={f.title} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                        <p className="text-xs font-bold text-slate-600 mb-1.5">{f.title}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* UX Principles */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">UX Principles — Non-Negotiable</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { icon: "👻", title: "Make OCR invisible", desc: "The clinic should not feel \"I am using OCR.\" They should feel \"my invoices organise themselves.\"" },
                      { icon: "⚡", title: "Human review must be fast", desc: "Low-confidence items: editable inline, keyboard optimised, bulk correction capable. Admin teams hate friction." },
                      { icon: "✅", title: "Show operational outcomes, not extracted text", desc: "Bad: \"Text successfully extracted.\" Good: inventory updated · discrepancies found · spend categorised · missing items flagged." },
                      { icon: "🔍", title: "Build trust aggressively", desc: "Always show confidence scores, source references, extracted line mapping. Financial systems require explainability." },
                    ].map(p => (
                      <div key={p.title} className="flex items-start gap-3">
                        <span className="text-base flex-shrink-0 mt-0.5">{p.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{p.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{p.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Build sequence */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Build Sequence</h4>
                  <div className="space-y-1.5">
                    {[
                      { n: 1, task: "PDF upload UI + email forwarding address per clinic" },
                      { n: 2, task: "Supplier detection engine (domain, logo, template matching)" },
                      { n: 3, task: "OCR + line-item extraction (layout-aware, table parsing)" },
                      { n: 4, task: "Confidence scoring + inline review UI" },
                      { n: 5, task: "SKU normalisation mapping to dentago_products catalogue" },
                      { n: 6, task: "Invoice-to-order reconciliation and discrepancy alerts" },
                      { n: 7, task: "Inventory auto-update from processed invoices" },
                      { n: 8, task: "Price change detection + spend analytics dashboard" },
                      { n: 9, task: "Phase 3 Financial OS — trigger: 100+ active clinics" },
                      { n: 10, task: "Phase 4 AI Copilot — trigger: £1M/month GMV" },
                    ].map(s => (
                      <div key={s.n} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                        <span className="w-5 h-5 rounded-full border-2 border-slate-200 text-slate-400 text-[10px] font-black flex items-center justify-center flex-shrink-0">{s.n}</span>
                        <span className="text-[12px] text-slate-600">{s.task}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="bg-[#0D0B1E] rounded-xl p-5 text-center">
                  <p className="text-white font-bold text-sm mb-1">Invoice OCR is not a document feature.</p>
                  <p className="text-blue-300 text-xs">It is the bridge between procurement, inventory, finance, analytics, and AI operations. Once invoices become structured data, Dentago evolves from ordering platform into operational intelligence infrastructure.</p>
                </div>

              </div>
            </div>

          </div>
        )}

        {tab === "Chat" && (
          <div className="flex gap-0 flex-1 min-h-0 rounded-none overflow-hidden border-t border-[#EDEAF5]">
            {/* ── Sidebar ── */}
            <div className="w-80 flex-shrink-0 flex flex-col bg-[#0D0B1E]">
              {/* Sidebar header */}
              <div className="px-5 pt-6 pb-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span className="text-[13px] font-bold text-white tracking-tight">Live Chat</span>
                  {chatSessions.filter(s => s.status === "open").length > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded-full">
                      {chatSessions.filter(s => s.status === "open").length} open
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/30 pl-[18px]">Visitor conversations</p>
              </div>

              {/* Search / refresh row */}
              <div className="px-4 pb-3 flex items-center gap-2">
                <div className="flex-1 bg-white/[0.06] rounded-lg px-3 py-2 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 flex-shrink-0">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <span className="text-[11px] text-white/25">Search conversations</span>
                </div>
                <button
                  onClick={() => { setChatLoaded(false); fetchChatSessions(); }}
                  className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
                  title="Refresh"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50">
                    <path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M22 11.5A10 10 0 0 1 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/>
                  </svg>
                </button>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto scrollbar-none">
                {chatSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-4">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <p className="text-[12px] font-semibold text-white/30">No conversations yet</p>
                    <p className="text-[11px] text-white/15 mt-1">Visitor chats will appear here in real time</p>
                  </div>
                ) : (
                  chatSessions.map((s) => {
                    const isActive = activeChat === s.id;
                    const initials = (s.name ?? "?").slice(0, 2).toUpperCase();
                    const colors = ["bg-violet-500", "bg-indigo-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
                    const color = colors[s.id.charCodeAt(0) % colors.length];
                    const timeAgo = (() => {
                      const diff = Date.now() - new Date(s.last_message_at).getTime();
                      const m = Math.floor(diff / 60000);
                      if (m < 1) return "just now";
                      if (m < 60) return `${m}m ago`;
                      const h = Math.floor(m / 60);
                      if (h < 24) return `${h}h ago`;
                      return `${Math.floor(h / 24)}d ago`;
                    })();
                    return (
                      <button
                        key={s.id}
                        onClick={async () => { setActiveChat(s.id); await fetchChatMessages(s.id); }}
                        className={`w-full text-left px-4 py-3.5 border-b border-white/[0.04] transition-all duration-150 ${
                          isActive
                            ? "bg-white/[0.1] border-l-2 border-l-violet-400"
                            : "hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mt-0.5`}>
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[13px] font-semibold text-white truncate">{s.name ?? "Visitor"}</span>
                              <span className="text-[10px] text-white/30 flex-shrink-0">{timeAgo}</span>
                            </div>
                            {s.email && <p className="text-[11px] text-white/40 truncate">{s.email}</p>}
                            {s.page_url && (
                              <p className="text-[10px] text-white/20 truncate mt-0.5">
                                {s.page_url.replace(/^https?:\/\/[^/]+/, "")}
                              </p>
                            )}
                          </div>
                          {s.status === "open" && !isActive && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 mt-2" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Thread pane ── */}
            <div className="flex-1 flex flex-col bg-white">
              {!activeChat ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-[#F4F2FC] flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-bold text-[#0D0B1E]">Select a conversation</p>
                    <p className="text-[13px] text-slate-400 mt-1">Choose a visitor chat from the left to reply</p>
                  </div>
                </div>
              ) : (() => {
                const session = chatSessions.find(s => s.id === activeChat);
                return (
                  <>
                    {/* Thread header */}
                    <div className="px-6 py-4 border-b border-[#EDEAF5] flex items-center gap-3">
                      {session && (
                        <>
                          <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-[13px] font-bold text-violet-600 flex-shrink-0">
                            {(session.name ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-bold text-[#0D0B1E] truncate">{session.name ?? "Visitor"}</p>
                            <p className="text-[12px] text-slate-400 truncate">{session.email ?? session.page_url ?? "No contact info"}</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${session.status === "open" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                            {session.status === "open" ? "● Active" : "Closed"}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-[#FAFAF9]">
                      {chatMessages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <p className="text-[13px] text-slate-400">No messages yet in this conversation</p>
                        </div>
                      )}
                      {chatMessages.map((m, i) => {
                        const isAgent = m.role === "agent";
                        const showTime = i === 0 || new Date(m.created_at).getTime() - new Date(chatMessages[i-1].created_at).getTime() > 5 * 60 * 1000;
                        return (
                          <div key={m.id}>
                            {showTime && (
                              <div className="flex items-center justify-center mb-3">
                                <span className="text-[10px] text-slate-400 bg-[#EDEAF5]/60 px-2.5 py-0.5 rounded-full">
                                  {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                                </span>
                              </div>
                            )}
                            <div className={`flex items-end gap-2.5 ${isAgent ? "flex-row-reverse" : ""}`}>
                              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ${isAgent ? "bg-[#111111]" : "bg-slate-300"}`}>
                                {isAgent ? "M" : (session?.name ?? "V").slice(0, 1).toUpperCase()}
                              </div>
                              <div className={`max-w-[66%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                                isAgent
                                  ? "bg-[#111111] text-white rounded-br-sm shadow-[0_2px_12px_rgba(17,17,17,0.25)]"
                                  : "bg-white text-[#151121] border border-[#EDEAF5] rounded-bl-sm shadow-sm"
                              }`}>
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reply box */}
                    <div className="px-5 py-4 border-t border-[#EDEAF5] bg-white">
                      <div className="flex items-end gap-3 bg-[#F7F6FB] rounded-2xl px-4 py-3 border border-[#EDEAF5] focus-within:border-[#111111]/40 focus-within:shadow-[0_0_0_3px_rgba(17,17,17,0.08)] transition-all">
                        <textarea
                          value={chatReply}
                          onChange={(e) => setChatReply(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatReply(activeChat); } }}
                          placeholder="Reply as Dentago…"
                          rows={1}
                          className="flex-1 text-[13px] text-[#151121] bg-transparent border-none outline-none resize-none placeholder-slate-400 leading-relaxed"
                          disabled={chatSending}
                          style={{ minHeight: "20px", maxHeight: "120px" }}
                        />
                        <button
                          onClick={() => sendChatReply(activeChat)}
                          disabled={!chatReply.trim() || chatSending}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-30 hover:opacity-90 transition-all flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #7C4FEE, #111111)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {tab === "Dentago Pro" && (
          <div className="space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#111111] to-violet-500 rounded-2xl p-7 text-white">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Dentago Pro — £299/month</h2>
                  <p className="text-violet-200 text-sm mt-0.5">The all-in-one procurement OS for dental clinics. Built to replace whiteboards, group chats, and spreadsheets.</p>
                </div>
              </div>
            </div>

            {/* 21 Features Grid */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">21 Pro Features — All Shipped</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { icon: "dashboard", title: "Procurement Hub", desc: "Central command centre — spend, stock alerts, staff requests, quick reorder in one view." },
                  { icon: "person_raised_hand", title: "Staff Request Workflow", desc: "Nurses submit supply requests via QR link. Manager reviews, approves, adds to cart in one tap." },
                  { icon: "qr_code_2", title: "QR Staff Request Link", desc: "Per-clinic token link — staff submit from any device without a Dentago account." },
                  { icon: "inventory_2", title: "Par Level Stock Alerts", desc: "Set reorder thresholds. Dashboard alerts when stock is due or overdue based on last order rhythm." },
                  { icon: "favorite", title: "Favourites & Quick Reorder", desc: "Save products for instant reorder — one-tap from the Hub sidebar." },
                  { icon: "payments", title: "Monthly Budget Tracker", desc: "Set a monthly spend limit. Real-time BudgetBar shows progress with amber/red overspend warnings." },
                  { icon: "bar_chart", title: "Spend Analytics", desc: "Month-over-month spend, savings vs list price, supplier breakdown — all in one dashboard." },
                  { icon: "storefront", title: "Supplier Scorecards", desc: "Rate each supplier on price, delivery, quality. Materialised view aggregated from order history." },
                  { icon: "trending_down", title: "Savings Estimates", desc: "~12% benchmark vs list price shown across every order and on the hub metric cards." },
                  { icon: "price_change", title: "Price History", desc: "Track price movements per product over time. Visual chart of supplier pricing trends." },
                  { icon: "compare_arrows", title: "Price Comparison", desc: "Compare the same product across all connected suppliers side-by-side before ordering." },
                  { icon: "schedule", title: "Reorder Rhythm Forecasting", desc: "Stockout projections based on last order date + reorder interval. Tightens with each order." },
                  { icon: "bolt", title: "One-Tap Cart Add", desc: "Add favourites or staff-requested items to cart with a single click from the hub." },
                  { icon: "lock_open", title: "Free tier wedge (ops)", desc: "Inventory, approvals, analytics, par alerts, and reorder hints ship unlocked on Free — clinics live in-app daily. Pro = deeper automation (e.g. assistant), not core workflow locks." },
                  { icon: "notifications", title: "Budget Alert Warnings", desc: "Visual indicator when monthly spend exceeds 80% or 100% of set budget." },
                  { icon: "people", title: "Requester Attribution", desc: "Staff requests carry requester name — manager knows who needs what and why." },
                  { icon: "task_alt", title: "Request Approve/Reject", desc: "Manager approves or declines each staff request inline — approved items go straight to cart." },
                  { icon: "receipt_long", title: "Order Attribution", desc: "Every order linked to a clinic. Budget, spend, and analytics all scoped per clinic." },
                  { icon: "sync_alt", title: "Parallel Data Fetching", desc: "Hub loads all 6 data sources simultaneously with Promise.all — no waterfall, instant render." },
                  { icon: "smartphone", title: "Mobile-First Sidebar", desc: "ProSidebar collapses to hamburger drawer on mobile — full Pro navigation on any device." },
                  { icon: "verified", title: "Pro Tier Badge", desc: "Green 'Pro' badge in sidebar — visible signal that the clinic is on the premium plan." },
                ].map(f => (
                  <div key={f.title} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-[#111111]" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Files shipped */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Files Shipped</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {[
                  { file: "components/ProSidebar.tsx", note: "Fixed 220px sidebar with mobile drawer, active states, Pro badge" },
                  { file: "app/clinic/layout.tsx", note: "Wraps all /clinic/* routes with ProSidebar" },
                  { file: "app/dashboard/layout.tsx", note: "Wraps /dashboard with ProSidebar" },
                  { file: "app/dashboard/page.tsx", note: "Full Procurement Hub — metric cards, staff requests, stock alerts, favourites, budget, QR" },
                  { file: "app/request/page.tsx", note: "Public nurse QR request page — no auth required" },
                  { file: "app/api/clinic/staff-requests/route.ts", note: "GET pending requests, PATCH approve/reject" },
                  { file: "app/api/public/staff-request/route.ts", note: "POST create request via token, GET validate token" },
                  { file: "app/api/clinic/budget/route.ts", note: "GET monthly budget + current spend, PUT set budget" },
                  { file: "app/api/clinic/staff-request-token/route.ts", note: "GET or generate per-clinic staff request token, POST regenerate" },
                ].map((row, i) => (
                  <div key={row.file} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                    <span className="material-symbols-outlined text-[14px] text-slate-300 mt-0.5 flex-shrink-0">code</span>
                    <div>
                      <code className="text-xs font-mono text-[#111111]">{row.file}</code>
                      <p className="text-xs text-slate-400 mt-0.5">{row.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SQL Migration reminder */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[18px] text-amber-500 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">SQL Migration Pending</p>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Run the Pro migration in Supabase SQL editor to add: <code className="bg-amber-100 px-1 rounded text-[11px]">plan</code>, <code className="bg-amber-100 px-1 rounded text-[11px]">staff_request_token</code>, <code className="bg-amber-100 px-1 rounded text-[11px]">monthly_budget</code> columns on <code className="bg-amber-100 px-1 rounded text-[11px]">clinic_accounts</code>, plus <code className="bg-amber-100 px-1 rounded text-[11px]">clinic_staff_requests</code> and <code className="bg-amber-100 px-1 rounded text-[11px]">product_price_history</code> tables, supplier scorecard view.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
