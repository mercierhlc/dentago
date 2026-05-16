"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  email?: string;
  name?: string;
  practice_name?: string;
  phone?: string;
  whatsapp_id?: string;
  linkedin_url?: string;
  type: string;
  status: string;
  tags: string[];
  source?: string;
  notes?: string;
  location?: string;
  last_contacted_at?: string;
  last_replied_at?: string;
  last_message_preview?: string;
  total_messages_sent: number;
  total_replies_received: number;
  created_at: string;
}

interface Message {
  id: string;
  contact_id: string;
  channel: string;
  direction: string;
  subject?: string;
  body: string;
  status: string;
  classification?: string;
  classification_confidence?: number;
  suggested_response?: string;
  metadata: Record<string, unknown>;
  sent_at: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PURPLE = "#6C3DE8";
const DARK   = "#0D0B1E";

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  replied:       { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "#10b981", label: "Replied" },
  interested:    { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "#10b981", label: "Interested" },
  demo_booked:   { bg: "bg-violet-50",   text: "text-violet-700",  dot: "#6C3DE8", label: "Demo booked" },
  warm:          { bg: "bg-amber-50",    text: "text-amber-700",   dot: "#f59e0b", label: "Warm" },
  cold:          { bg: "bg-slate-50",    text: "text-slate-500",   dot: "#94a3b8", label: "Cold" },
  client:        { bg: "bg-blue-50",     text: "text-blue-700",    dot: "#3b82f6", label: "Client" },
  unsubscribed:  { bg: "bg-red-50",      text: "text-red-600",     dot: "#ef4444", label: "Unsubscribed" },
  do_not_contact:{ bg: "bg-red-100",     text: "text-red-700",     dot: "#dc2626", label: "DNC" },
  prospect:      { bg: "bg-purple-50",   text: "text-purple-700",  dot: "#7c3aed", label: "Prospect" },
};

const CHANNEL_CONFIG: Record<string, { icon: string; label: string }> = {
  email:    { icon: "✉", label: "Email" },
  whatsapp: { icon: "💬", label: "WhatsApp" },
  sms:      { icon: "📱", label: "SMS" },
  linkedin: { icon: "💼", label: "LinkedIn" },
  note:     { icon: "📝", label: "Note" },
  call:     { icon: "📞", label: "Call" },
};

const CLASS_CONFIG: Record<string, { bg: string; text: string }> = {
  INTERESTED:   { bg: "bg-emerald-50", text: "text-emerald-700" },
  NOT_NOW:      { bg: "bg-amber-50",   text: "text-amber-700" },
  QUESTION:     { bg: "bg-blue-50",    text: "text-blue-700" },
  WRONG_PERSON: { bg: "bg-slate-50",   text: "text-slate-500" },
  UNSUBSCRIBE:  { bg: "bg-red-50",     text: "text-red-600" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function initials(c: Contact) {
  const n = c.name || c.email || "?";
  return n.split(/[\s@.]+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

const AVATAR_PALETTE = [PURPLE, "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#06b6d4", "#8b5cf6"];
function avatarColor(id: string) {
  return AVATAR_PALETTE[id.charCodeAt(0) % AVATAR_PALETTE.length];
}

function statusCfg(status: string) {
  return STATUS_CONFIG[status] ?? { bg: "bg-slate-50", text: "text-slate-500", dot: "#94a3b8", label: status };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg(status);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function Avatar({ contact, size = "md" }: { contact: Contact; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-12 h-12 text-sm" : size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${sizeClass} rounded-full flex-shrink-0 flex items-center justify-center text-white font-black`}
      style={{ background: avatarColor(contact.id) }}
    >
      {initials(contact)}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [total, setTotal]             = useState(0);
  const [selected, setSelected]       = useState<Contact | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [loading, setLoading]         = useState(true);
  const [msgLoading, setMsgLoading]   = useState(false);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [reply, setReply]             = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyChannel, setReplyChannel] = useState("email");
  const [sending, setSending]         = useState(false);
  const [noteText, setNoteText]       = useState("");
  const [savingNote, setSavingNote]   = useState(false);
  const [editStatus, setEditStatus]   = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [stats, setStats]             = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "300" });
    if (search)       params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    const res = await fetch(`/api/crm/contacts?${params}`);
    const j = await res.json();
    const data: Contact[] = j.data ?? [];
    setContacts(data);
    setTotal(j.count ?? data.length);
    // Build status counts
    const counts: Record<string, number> = {};
    for (const c of data) counts[c.status] = (counts[c.status] ?? 0) + 1;
    setStats(counts);
    setLoading(false);
  }, [search, filterStatus]);

  const fetchMessages = useCallback(async (contactId: string) => {
    setMsgLoading(true);
    const res = await fetch(`/api/crm/contacts/${contactId}`);
    const j = await res.json();
    setMessages(j.messages ?? []);
    setMsgLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => {
    if (selected) {
      fetchMessages(selected.id);
      setReplySubject(`Re: Dentago — ${selected.practice_name || selected.name || selected.email}`);
      setEditStatus(selected.status);
      setComposeOpen(false);
      setReply("");
    }
  }, [selected, fetchMessages]);

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    await fetch("/api/crm/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: selected.id,
        channel: replyChannel,
        subject: replySubject,
        message_body: reply,
        direction: "outbound",
      }),
    });
    setReply("");
    setSending(false);
    setComposeOpen(false);
    await fetchMessages(selected.id);
    await fetchContacts();
  }

  async function saveNote() {
    if (!selected || !noteText.trim()) return;
    setSavingNote(true);
    await fetch("/api/crm/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: selected.id,
        channel: "note",
        message_body: noteText,
        direction: "outbound",
      }),
    });
    setNoteText("");
    setSavingNote(false);
    await fetchMessages(selected.id);
  }

  async function updateStatus(newStatus: string) {
    if (!selected) return;
    await fetch(`/api/crm/contacts/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setEditStatus(newStatus);
    setSelected(prev => prev ? { ...prev, status: newStatus } : prev);
    await fetchContacts();
  }

  // Sort: replied/demo_booked first, then warm, then cold
  const PRIORITY: Record<string, number> = { replied: 0, demo_booked: 1, interested: 2, warm: 3, prospect: 4, client: 5, cold: 6, unsubscribed: 7, do_not_contact: 8 };
  const sorted = [...contacts].sort((a, b) => {
    const pa = PRIORITY[a.status] ?? 5;
    const pb = PRIORITY[b.status] ?? 5;
    if (pa !== pb) return pa - pb;
    return (b.last_replied_at ?? b.last_contacted_at ?? "").localeCompare(a.last_replied_at ?? a.last_contacted_at ?? "");
  });

  const repliedCount    = stats.replied ?? 0;
  const warmCount       = (stats.warm ?? 0) + (stats.interested ?? 0);
  const unsubCount      = stats.unsubscribed ?? 0;

  return (
    <div className="h-screen flex flex-col" style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "#F8F7FC" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <a href="/os" className="text-slate-400 hover:text-slate-600 text-sm font-medium flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          OS
        </a>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ background: PURPLE }}>C</div>
          <div>
            <p className="font-bold text-[#0D0B1E] text-sm leading-none">CRM</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{total.toLocaleString()} contacts</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 ml-4">
          {[
            { label: "Replied", count: repliedCount, color: "#10b981" },
            { label: "Warm",    count: warmCount,    color: "#f59e0b" },
            { label: "Unsub",   count: unsubCount,   color: "#ef4444" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs font-bold" style={{ color }}>{count}</span>
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="ml-auto relative max-w-xs w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, practice…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* ── Status filter pills ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-5 py-2 flex items-center gap-1.5 flex-shrink-0">
        {["", "replied", "demo_booked", "warm", "interested", "cold", "unsubscribed"].map(s => {
          const cfg = s ? statusCfg(s) : null;
          const active = filterStatus === s;
          const count = s ? (stats[s] ?? 0) : total;
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                active
                  ? "border-transparent text-white shadow-sm"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
              }`}
              style={active ? { background: cfg?.dot ?? DARK } : {}}>
              {s === "" ? "All contacts" : (cfg?.label ?? s)}
              <span className={`font-bold tabular-nums ${active ? "opacity-80" : "text-slate-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Contact list */}
        <div className="w-72 flex-shrink-0 border-r border-slate-100 bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-2.5 bg-slate-100 rounded-full w-3/4" />
                      <div className="h-2 bg-slate-100 rounded-full w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400 font-medium">No contacts found</p>
                <p className="text-xs text-slate-300 mt-1">Run outreach to populate</p>
              </div>
            ) : (
              sorted.map(contact => {
                const cfg = statusCfg(contact.status);
                const isActive = selected?.id === contact.id;
                const hasReply = !!contact.last_replied_at;
                return (
                  <button
                    key={contact.id}
                    onClick={() => setSelected(contact)}
                    className={`w-full text-left px-3.5 py-3 flex gap-3 border-b border-slate-50 transition-colors relative ${
                      isActive ? "bg-violet-50" : "hover:bg-slate-50"
                    }`}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-600 rounded-r" />}
                    <Avatar contact={contact} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-xs font-semibold truncate ${isActive ? "text-violet-900" : "text-slate-800"}`}>
                          {contact.name || contact.email?.split("@")[0] || "Unknown"}
                        </p>
                        {contact.last_contacted_at && (
                          <p className="text-[10px] text-slate-400 flex-shrink-0">{relativeTime(contact.last_contacted_at)}</p>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{contact.practice_name || contact.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${cfg.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                          {cfg.label}
                        </span>
                        {hasReply && (
                          <span className="text-[10px] text-emerald-600 font-semibold">· replied</span>
                        )}
                        <span className="text-[10px] text-slate-300 ml-auto">{contact.total_messages_sent}✉</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail pane */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: `${PURPLE}15` }}>
                <svg className="w-7 h-7" style={{ color: PURPLE }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0H4m8-4h.01"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">Select a contact</p>
              <p className="text-xs text-slate-400">View conversation history and send messages</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0">

            {/* Contact header */}
            <div className="bg-white border-b border-slate-100 px-6 py-4 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar contact={selected} size="lg" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-slate-900 text-base">{selected.name || selected.email || "Unknown"}</h2>
                      <StatusBadge status={editStatus} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {selected.practice_name && <p className="text-sm text-slate-500">{selected.practice_name}</p>}
                      {selected.email && <p className="text-xs text-slate-400">✉ {selected.email}</p>}
                      {selected.location && <p className="text-xs text-slate-400">📍 {selected.location}</p>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={editStatus}
                    onChange={e => updateStatus(e.target.value)}
                    className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 text-slate-700 cursor-pointer"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <div className="text-right text-xs text-slate-400">
                    <p><span className="font-semibold text-slate-700">{selected.total_messages_sent}</span> sent</p>
                    <p><span className="font-semibold text-slate-700">{selected.total_replies_received}</span> replies</p>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {[
                  { label: "Last contacted",  value: selected.last_contacted_at ? relativeTime(selected.last_contacted_at) : "Never" },
                  { label: "Last reply",       value: selected.last_replied_at  ? relativeTime(selected.last_replied_at)   : "—" },
                  { label: "Source",           value: selected.source ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                    <p className="text-xs font-semibold text-slate-700">{value}</p>
                  </div>
                ))}
              </div>

              {selected.notes && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 italic">
                  {selected.notes}
                </div>
              )}
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ background: "#F8F7FC" }}>
              {msgLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                      <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" style={{ width: "55%" }} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-slate-400">No messages yet — send the first one below.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOut  = msg.direction === "outbound";
                  const isNote = msg.channel === "note";
                  const chanCfg = CHANNEL_CONFIG[msg.channel] ?? { icon: "•", label: msg.channel };
                  return (
                    <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[68%] ${isNote ? "w-full max-w-full" : ""}`}>
                        {/* Meta */}
                        <div className={`flex items-center gap-1.5 mb-1.5 text-[10px] text-slate-400 ${isOut ? "justify-end" : "justify-start"}`}>
                          <span>{chanCfg.icon} {chanCfg.label}</span>
                          <span>·</span>
                          <span>{relativeTime(msg.sent_at)}</span>
                          {msg.subject && <><span>·</span><span className="font-semibold text-slate-500 max-w-[180px] truncate">{msg.subject}</span></>}
                        </div>
                        {/* Bubble */}
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isNote
                            ? "bg-amber-50 border border-amber-200 text-amber-900 italic w-full"
                            : isOut
                              ? "text-white"
                              : "bg-white border border-slate-200 text-slate-800 shadow-sm"
                        }`} style={isOut && !isNote ? { background: DARK } : {}}>
                          {msg.body}
                        </div>
                        {/* Classification */}
                        {msg.classification && (
                          <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${CLASS_CONFIG[msg.classification]?.bg ?? "bg-slate-50"} ${CLASS_CONFIG[msg.classification]?.text ?? "text-slate-500"}`}>
                            {msg.classification.replace(/_/g, " ")}
                            {msg.classification_confidence && (
                              <span className="opacity-50">{Math.round(msg.classification_confidence * 100)}%</span>
                            )}
                          </div>
                        )}
                        {/* Suggested reply */}
                        {msg.suggested_response && !isOut && (
                          <div className="mt-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1">Suggested reply</p>
                            <p className="text-xs text-violet-700 leading-relaxed">{msg.suggested_response}</p>
                            <button
                              onClick={() => { setReply(msg.suggested_response ?? ""); setComposeOpen(true); }}
                              className="mt-1.5 text-[10px] font-bold text-violet-600 hover:underline"
                            >
                              Use this →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Compose bar */}
            <div className="bg-white border-t border-slate-100 flex-shrink-0">
              {composeOpen ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={replyChannel} onChange={e => setReplyChannel(e.target.value)}
                      className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 text-slate-700"
                    >
                      <option value="email">✉ Email</option>
                      <option value="whatsapp">💬 WhatsApp</option>
                      <option value="sms">📱 SMS</option>
                    </select>
                    {replyChannel === "email" && (
                      <input
                        value={replySubject} onChange={e => setReplySubject(e.target.value)}
                        placeholder="Subject line…"
                        className="flex-1 text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 text-slate-800"
                      />
                    )}
                  </div>
                  <textarea
                    value={reply} onChange={e => setReply(e.target.value)}
                    rows={4}
                    placeholder={`Write your ${replyChannel} message…`}
                    className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 text-slate-800"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setComposeOpen(false)}
                      className="text-sm px-4 py-2 text-slate-500 hover:text-slate-700 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendReply} disabled={sending || !reply.trim()}
                      className="text-sm font-bold px-5 py-2 rounded-xl text-white disabled:opacity-40 transition-all"
                      style={{ background: DARK }}
                    >
                      {sending ? "Sending…" : `Send ${replyChannel}`}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 flex gap-2 items-center">
                  <input
                    value={noteText} onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note…"
                    onKeyDown={e => e.key === "Enter" && saveNote()}
                    className="flex-1 text-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 text-slate-800 placeholder-slate-400"
                  />
                  <button
                    onClick={saveNote} disabled={savingNote || !noteText.trim()}
                    className="text-sm px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors font-medium"
                  >
                    Save note
                  </button>
                  <button
                    onClick={() => setComposeOpen(true)}
                    className="text-sm font-bold px-5 py-2.5 text-white rounded-xl transition-colors"
                    style={{ background: DARK }}
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
