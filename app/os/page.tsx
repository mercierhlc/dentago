"use client";

import { useEffect, useState, useCallback } from "react";
import { OsEventRow } from "@/components/os/OsEventRow";
import { OsTemplatesPanel } from "@/components/os/OsTemplatesPanel";
import { OS_PLAYBOOKS } from "@/lib/os-playbooks";

const P = "#6C3DE8";

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
const CARD_SHADOW = "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(108,61,232,0.04)]";

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
  const c = type.includes("order") ? "#22c55e" : type.includes("demo") ? P : type.includes("outreach") ? "#3b82f6" : type.includes("supplier") ? "#f59e0b" : type.includes("clinic") ? "#8b5cf6" : "#D1C9E8";
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
    Agents: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    Goals: <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    Approvals: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2h8V3a1 1 0 0 0-1-1z"/><path d="M9 12h6"/><path d="M9 16h4"/></>,
    Events: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    "Context Log": <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    "OS State": <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    Templates: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></>,
    Playbooks: <><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {icons[id]}
    </svg>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

/** Approvals is early so it stays above the fold — agents file questions here for founder sign-off. */
const TABS = ["Overview", "Approvals", "Playbooks", "Objectives", "Outreach", "Templates", "Workspace", "Employees", "Supplier GMV", "Agents", "Goals", "Events", "Audit Log", "Context Log", "OS State"] as const;
type Tab = typeof TABS[number];

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
    color: "#6C3DE8",
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
    if (tab === "Approvals") fetchApprovalsList();
    if (tab === "Audit Log" && !auditLoaded) fetchAuditLog();
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${active ? "text-[#6C3DE8]" : "text-[#7A7090] hover:text-[#0D0B1E] hover:bg-[#F5F3FB]"}`}
                style={active ? { background: `linear-gradient(135deg, #EDE9F8 0%, #F0ECFA 100%)` } : {}}>
                <span className={`flex-shrink-0 ${active ? "text-[#6C3DE8]" : "text-[#B0A8C8] group-hover:text-[#7A7090]"}`}>
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

        <div className={`flex-1 ${(tab === "Workspace" || tab === "Outreach" || tab === "Templates" || tab === "Playbooks") ? "overflow-hidden flex flex-col min-h-0" : "overflow-y-auto px-8 py-6 space-y-5"}`}>
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
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_24px_rgba(108,61,232,0.06)] flex flex-col">

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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-[#151121]">Supplier GMV Dashboard</h2>
              <p className="text-sm text-slate-400 mt-1">£ directed to each supplier — your primary sales asset for monetisation conversations.</p>
            </div>
            <div className="flex gap-2">
              {(["week", "month", "all"] as const).map(p => (
                <button key={p} onClick={() => setGmvPeriod(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${gmvPeriod === p ? "bg-violet-600 text-white border-violet-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {p === "week" ? "This week" : p === "month" ? "This month" : "All time"}
                </button>
              ))}
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
                <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(108,61,232,0.05)] p-4 flex flex-col gap-1">
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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_12px_rgba(108,61,232,0.05)]">
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
                    className={`bg-white rounded-2xl border transition-all duration-200 ${isExpanded ? "border-violet-200 shadow-[0_4px_24px_rgba(108,61,232,0.10)]" : "border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:border-slate-200"}`}>

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
                              className="rounded-xl bg-[#6C3DE8] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
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
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${outreachStatus === s ? "bg-[#6C3DE8] text-white border-[#6C3DE8]" : "bg-[#F9F8FD] border-[#EDEAF5] text-[#7A7090] hover:border-[#D4CDE8]"}`}>
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
                        warm: "#8b5cf6", replied: "#22c55e", bounced: "#ef4444", demo: "#6C3DE8",
                      };
                      const dot = STATUS_COLOR[c.status] ?? "#94a3b8";
                      return (
                        <button key={c.id} onClick={() => { setOutreachContact(c); fetchContactMsgs(c.id); }}
                          className={`w-full text-left px-4 py-3 border-b border-[#F5F3FB] transition-all ${outreachContact?.id === c.id ? "bg-[#F0ECFA] border-l-2 border-l-[#6C3DE8]" : "hover:bg-[#F9F8FD] border-l-2 border-l-transparent"}`}>
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: dot }} />
                            <div className="min-w-0">
                              <p className={`text-[12px] font-semibold truncate ${outreachContact?.id === c.id ? "text-[#6C3DE8]" : "text-[#0D0B1E]"}`}>
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
                  "All":          { emoji: "◉", color: "#6C3DE8" },
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
                      const meta = CAT_META[cat.name] ?? { emoji: "•", color: "#6C3DE8" };
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
                      className={`w-full text-left px-5 py-3.5 border-b border-[#F5F3FB] transition-all ${wsActive?.id === note.id ? "bg-[#F0ECFA] border-l-2 border-l-[#6C3DE8]" : "hover:bg-[#F9F8FD] border-l-2 border-l-transparent"}`}>
                      <p className={`text-[13px] font-semibold leading-snug mb-1 ${wsActive?.id === note.id ? "text-[#6C3DE8]" : "text-[#0D0B1E]"}`}>{note.title}</p>
                      {isTodo && total > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-[#EDEAF5] overflow-hidden">
                            <div className="h-full rounded-full bg-[#6C3DE8] transition-all" style={{ width: `${pct}%` }} />
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
                                    className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 transition-all flex items-center justify-center ${checked ? 'bg-[#6C3DE8] border-[#6C3DE8]' : 'border-[#C0B8D8] group-hover:border-[#6C3DE8]'}`}>
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
            <div className="rounded-3xl p-7 text-white" style={{ background: "linear-gradient(135deg, #6C3DE8 0%, #4338ca 100%)" }}>
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
            "Growth & Distribution": "#0891b2", "Product & Platform": "#6C3DE8",
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
                  className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 transition-all flex items-center justify-center ${done ? 'bg-[#6C3DE8] border-[#6C3DE8]' : 'border-[#C0B8D8] group-hover:border-[#6C3DE8]'}`}>
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
                    <div className="h-full rounded-full transition-all duration-500" style={{ background: "linear-gradient(90deg, #6C3DE8, #9B7BF5)", width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-4xl font-black flex-shrink-0" style={{ color: "#6C3DE8" }}>{pct.toFixed(0)}%</div>
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
                  <div key={week} className="bg-white rounded-2xl border border-[#EDEAF5] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(108,61,232,0.04)" }}>
                    {/* Week header */}
                    <div className="px-6 pt-4 pb-3 border-b border-[#F5F3FB] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <p className="text-[10px] font-black text-[#A89DC8] uppercase tracking-[0.12em] flex-shrink-0">Week {week}</p>
                        <div className="flex-1 h-1.5 bg-[#F0ECFA] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500 bg-[#6C3DE8]" style={{ width: `${wPct}%` }} />
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#6C3DE8] flex-shrink-0">{wDone}/{wGoals.length}</span>
                    </div>
                    {/* Area sub-groups */}
                    <div className="divide-y divide-[#F5F3FB]">
                      {Object.entries(wByArea).map(([area, aGoals]) => (
                        <div key={area}>
                          <div className="px-6 pt-3 pb-1 flex items-center gap-2">
                            <span className="text-[11px]">{BIZ_EMOJI[area] ?? "•"}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: BIZ_COLOR[area] ?? "#6C3DE8" }}>{area}</span>
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
                  <div className="bg-white rounded-2xl border border-[#EDEAF5] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(108,61,232,0.04)" }}>
                    <div className="px-6 pt-4 pb-3 border-b border-[#F5F3FB]">
                      <p className="text-[10px] font-black text-[#A89DC8] uppercase tracking-[0.12em]">Standing Goals</p>
                    </div>
                    <div className="divide-y divide-[#F5F3FB]">
                      {Object.entries(nByArea).map(([area, aGoals]) => (
                        <div key={area}>
                          <div className="px-6 pt-3 pb-1 flex items-center gap-2">
                            <span className="text-[11px]">{BIZ_EMOJI[area] ?? "•"}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: BIZ_COLOR[area] ?? "#6C3DE8" }}>{area}</span>
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
                          ? "border-violet-400 bg-violet-50 shadow-[0_1px_3px_rgba(108,61,232,0.08)]"
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

        </div>
      </div>
    </div>
  );
}
