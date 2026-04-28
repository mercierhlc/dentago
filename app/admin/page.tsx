"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const ADMIN_PASSWORD = "dentago-admin-2024";
const SB_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjczNTMsImV4cCI6MjA5MTk0MzM1M30.E4zHiIcf71eGCrGFRiz3D0mLQiufmH-B_T7qtT6UUY8";

type Doc = { id: string; document_type: string; storage_path: string };
type Conn = { id: string; supplier_name: string; account_email: string };
type Log = { id: string; action: string; details: string; performed_at: string };
type Clinic = {
  id: string; email: string; practice_name: string; gdc_number: string;
  practice_type: string; street_address: string; city: string; postcode: string;
  phone: string; status: string; created_at: string; reviewed_at: string | null;
  rejection_reason: string | null; admin_notes: string | null; is_deactivated: boolean;
  documents: Doc[]; connections: Conn[];
};
type TrackerUser = {
  id: string; email: string; practice_name: string | null;
  status: string | null; last_step_completed: number; signed_up_at: string;
};

const DOC_LABEL: Record<string, string> = {
  gdc_registration: "GDC Registration",
  proof_of_address: "Proof of Address",
  insurance: "Insurance Certificate",
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [impersonateLoading, setImpersonateLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"applications" | "tracker" | "suppliers">("applications");

  // Applications state
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [notesSaving, setNotesSaving] = useState<string | null>(null);
  const [logsMap, setLogsMap] = useState<Record<string, Log[]>>({});
  const [reDocModal, setReDocModal] = useState<{ clinicId: string; email: string; name: string } | null>(null);
  const [reDocType, setReDocType] = useState("");
  const [reDocMsg, setReDocMsg] = useState("");

  // Tracker state
  const [tracker, setTracker] = useState<TrackerUser[]>([]);
  const [trackerLoading, setTrackerLoading] = useState(false);

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/clinics");
    const data = await res.json();
    setClinics(data);
    const notes: Record<string, string> = {};
    data.forEach((c: Clinic) => { notes[c.id] = c.admin_notes ?? ""; });
    setNotesMap(notes);
    setLoading(false);
  }, []);

  const fetchTracker = useCallback(async () => {
    setTrackerLoading(true);
    const res = await fetch("/api/admin/tracker");
    const data = await res.json();
    setTracker(data);
    setTrackerLoading(false);
  }, []);

  const fetchLogs = async (clinicId: string) => {
    if (logsMap[clinicId]) return;
    const res = await fetch(`/api/admin/log-activity?clinicId=${clinicId}`);
    const data = await res.json();
    setLogsMap((prev) => ({ ...prev, [clinicId]: data }));
  };

  const logActivity = async (clinicId: string, action: string, details: string) => {
    await fetch("/api/admin/log-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, action, details }),
    });
    setLogsMap((prev) => ({ ...prev, [clinicId]: [] })); // invalidate cache
  };

  const sendEmail = async (to: string, type: string, practiceName: string, extra?: Record<string, string>) => {
    await fetch("/api/admin/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, type, practiceName, ...extra }),
    });
  };

  useEffect(() => {
    if (authed) fetchClinics();
  }, [authed, fetchClinics]);

  useEffect(() => {
    if (authed && activeTab === "tracker") fetchTracker();
  }, [authed, activeTab, fetchTracker]);

  async function updateStatus(userId: string, status: string, reason?: string) {
    setActionLoading(userId);
    await fetch("/api/admin/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status, rejection_reason: reason }),
    });
    const clinic = clinics.find((c) => c.id === userId);
    if (clinic) {
      await sendEmail(clinic.email, status === "approved" ? "approved" : "rejected", clinic.practice_name, reason ? { rejectionReason: reason } : {});
      await logActivity(userId, status === "approved" ? "Approved" : "Rejected", reason ? `Reason: ${reason}` : "");
    }
    await fetchClinics();
    setRejectModal(null);
    setRejectReason("");
    setActionLoading(null);
  }

  async function toggleUser(userId: string, deactivate: boolean) {
    setActionLoading(userId);
    await fetch("/api/admin/toggle-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, deactivate }),
    });
    await logActivity(userId, deactivate ? "Deactivated" : "Reactivated", "");
    await fetchClinics();
    setActionLoading(null);
  }

  async function saveNotes(userId: string) {
    setNotesSaving(userId);
    await fetch("/api/admin/save-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, notes: notesMap[userId] }),
    });
    await logActivity(userId, "Notes updated", "");
    setNotesSaving(null);
  }

  async function sendDocRequest() {
    if (!reDocModal || !reDocType) return;
    await sendEmail(reDocModal.email, "document_request", reDocModal.name, {
      documentType: DOC_LABEL[reDocType] || reDocType,
      message: reDocMsg,
    });
    await logActivity(reDocModal.clinicId, "Document re-requested", `Type: ${DOC_LABEL[reDocType]}`);
    setReDocModal(null);
    setReDocType("");
    setReDocMsg("");
  }

  async function viewDocument(path: string) {
    const res = await fetch("/api/admin/document-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  function exportCSV() {
    const rows = [
      ["Practice Name", "Email", "GDC", "Practice Type", "Address", "City", "Postcode", "Phone", "Status", "Submitted"],
      ...clinics.map((c) => [
        c.practice_name, c.email, c.gdc_number, c.practice_type,
        c.street_address, c.city, c.postcode, c.phone, c.status,
        new Date(c.created_at).toLocaleDateString("en-GB"),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dentago-clinics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // Supplier stats from clinics data
  const supplierStats = clinics
    .flatMap((c) => c.connections)
    .reduce((acc: Record<string, number>, conn) => {
      acc[conn.supplier_name] = (acc[conn.supplier_name] || 0) + 1;
      return acc;
    }, {});
  const sortedSuppliers = Object.entries(supplierStats).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedSuppliers[0]?.[1] || 1;

  async function loginAsClinic(clinicId: string) {
    setImpersonateLoading(clinicId);
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, password: ADMIN_PASSWORD }),
    });
    const data = await res.json();
    setImpersonateLoading(null);
    if (data.link) {
      window.open(data.link, "_blank");
    } else {
      alert(`Failed: ${data.error ?? "unknown error"}`);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4">
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-black/[0.04] p-12 w-full max-w-md">
          <div className="text-2xl font-extrabold tracking-tighter text-[#6C3DE8] mb-1">Dentago</div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-10">Admin Panel</p>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && password === ADMIN_PASSWORD && setAuthed(true)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#6C3DE8]/10 focus:border-[#6C3DE8] font-medium"
                placeholder="Enter admin password"
              />
            </div>
            <button
              onClick={() => { if (password === ADMIN_PASSWORD) setAuthed(true); else alert("Incorrect password"); }}
              className="w-full bg-[#6C3DE8] text-white py-4 rounded-2xl font-extrabold hover:brightness-110 transition-all shadow-lg shadow-[#6C3DE8]/20"
            >Enter</button>
          </div>
        </div>
      </div>
    );
  }

  const counts = {
    pending: clinics.filter((c) => c.status === "pending").length,
    approved: clinics.filter((c) => c.status === "approved").length,
    rejected: clinics.filter((c) => c.status === "rejected").length,
  };

  const filtered = clinics.filter((c) => {
    const matchesFilter = filter === "all" || c.status === filter;
    const q = search.toLowerCase();
    const matchesSearch = !q || c.practice_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.gdc_number?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121]" style={{ fontFamily: "Manrope, sans-serif" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />

      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50">
        <div className="flex justify-between items-center px-8 h-20 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</span>
            <span className="bg-[#6C3DE8]/10 text-[#6C3DE8] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Admin</span>
          </div>
          <div className="flex items-center gap-6">
            {(["applications", "tracker", "suppliers"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-bold capitalize transition-colors ${activeTab === tab ? "text-[#6C3DE8] border-b-2 border-[#6C3DE8] pb-0.5" : "text-slate-400 hover:text-slate-600"}`}
              >{tab === "applications" ? "Applications" : tab === "tracker" ? "Onboarding Tracker" : "Supplier Stats"}</button>
            ))}
            <Link href="/admin/orders" className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 px-3 py-1.5 rounded-xl transition-all ml-4">
              <span className="material-symbols-outlined text-[15px]">receipt_long</span>
              Orders
            </Link>
            <button onClick={() => setAuthed(false)} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors ml-2">Sign out</button>
          </div>
        </div>
      </nav>

      <main className="pt-28 pb-20 max-w-7xl mx-auto px-8">

        {/* ── APPLICATIONS TAB ── */}
        {activeTab === "applications" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mb-10">
              {[
                { label: "Pending Review", count: counts.pending, color: "text-amber-500", bg: "bg-white", border: "border-amber-100" },
                { label: "Approved", count: counts.approved, color: "text-[#10b981]", bg: "bg-white", border: "border-[#10b981]/10" },
                { label: "Rejected", count: counts.rejected, color: "text-red-500", bg: "bg-white", border: "border-red-100" },
              ].map(({ label, count, color, bg, border }) => (
                <div key={label} className={`${bg} rounded-[2rem] border ${border} p-8 shadow-sm`}>
                  <div className={`text-5xl font-extrabold tracking-tighter ${color} mb-2`}>{count}</div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 mb-6 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email or GDC..."
                  className="w-full pl-11 pr-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-[#6C3DE8]/10 focus:border-[#6C3DE8]"
                />
              </div>
              <div className="flex gap-2">
                {["pending", "approved", "rejected", "all"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-5 py-3 rounded-xl font-bold text-sm transition-all capitalize ${filter === f ? "bg-[#6C3DE8] text-white shadow-lg shadow-[#6C3DE8]/20" : "bg-white border border-slate-200 text-slate-500 hover:border-[#6C3DE8]/30"}`}
                  >{f}</button>
                ))}
              </div>
              <button onClick={fetchClinics} className="px-5 py-3 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-500 hover:border-[#6C3DE8]/30 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">refresh</span>
              </button>
              <button onClick={exportCSV} className="px-5 py-3 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-500 hover:border-[#6C3DE8]/30 transition-all flex items-center gap-2 ml-auto">
                <span className="material-symbols-outlined text-[16px]">download</span> Export CSV
              </button>
            </div>

            {/* Clinic list */}
            {loading ? (
              <div className="text-center py-20 text-slate-400 font-bold">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-bold">No {filter} applications{search ? ` matching "${search}"` : ""}.</div>
            ) : (
              <div className="space-y-4">
                {filtered.map((clinic) => (
                  <div key={clinic.id} className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden ${clinic.is_deactivated ? "border-red-100 opacity-75" : "border-black/[0.04]"}`}>
                    {/* Row header */}
                    <div
                      className="flex items-center justify-between p-8 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => {
                        const next = expanded === clinic.id ? null : clinic.id;
                        setExpanded(next);
                        if (next) fetchLogs(next);
                      }}
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-[#6C3DE8]/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-[#6C3DE8]">local_hospital</span>
                        </div>
                        <div>
                          <div className="font-extrabold text-lg text-slate-900">{clinic.practice_name || "—"}</div>
                          <div className="text-sm text-slate-400 font-medium">{clinic.email} · GDC: {clinic.gdc_number || "—"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {clinic.is_deactivated && <span className="px-3 py-1 rounded-full bg-red-50 text-red-400 text-[10px] font-black uppercase tracking-widest">Deactivated</span>}
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${clinic.status === "pending" ? "bg-amber-50 text-amber-500" : clinic.status === "approved" ? "bg-[#10b981]/10 text-[#10b981]" : "bg-red-50 text-red-500"}`}>{clinic.status}</span>
                        <span className="text-sm text-slate-400 font-medium hidden md:block">{new Date(clinic.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className={`material-symbols-outlined text-slate-400 transition-transform duration-300 ${expanded === clinic.id ? "rotate-180" : ""}`}>expand_more</span>
                      </div>
                    </div>

                    {/* Expanded */}
                    {expanded === clinic.id && (
                      <div className="border-t border-slate-50 p-8 space-y-8">

                        {/* Practice details */}
                        <div>
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Practice Details</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                              { label: "Type", value: clinic.practice_type },
                              { label: "Phone", value: clinic.phone },
                              { label: "Address", value: [clinic.street_address, clinic.city, clinic.postcode].filter(Boolean).join(", ") },
                              { label: "Submitted", value: new Date(clinic.created_at).toLocaleDateString("en-GB") },
                            ].map(({ label, value }) => (
                              <div key={label} className="bg-slate-50 rounded-2xl p-5">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</div>
                                <div className="font-bold text-slate-700 text-sm">{value || "—"}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Documents */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documents</h3>
                            <button
                              onClick={() => setReDocModal({ clinicId: clinic.id, email: clinic.email, name: clinic.practice_name })}
                              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#6C3DE8] hover:opacity-70 transition-opacity"
                            >
                              <span className="material-symbols-outlined text-[14px]">forward_to_inbox</span>
                              Re-request Document
                            </button>
                          </div>
                          {clinic.documents.length === 0 ? (
                            <p className="text-sm text-slate-400 font-medium">No documents uploaded.</p>
                          ) : (
                            <div className="flex flex-wrap gap-3">
                              {clinic.documents.map((doc) => (
                                <button
                                  key={doc.id}
                                  onClick={() => viewDocument(doc.storage_path)}
                                  className="flex items-center gap-2 bg-[#6C3DE8]/5 border border-[#6C3DE8]/10 text-[#6C3DE8] px-5 py-3 rounded-xl font-bold text-sm hover:bg-[#6C3DE8]/10 transition-all"
                                >
                                  <span className="material-symbols-outlined text-[16px]">description</span>
                                  {DOC_LABEL[doc.document_type] || doc.document_type}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Supplier connections */}
                        {clinic.connections.length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Supplier Connections</h3>
                            <div className="flex flex-wrap gap-3">
                              {clinic.connections.map((conn) => (
                                <div key={conn.id} className="bg-slate-50 border border-slate-100 px-5 py-3 rounded-xl">
                                  <span className="font-bold text-slate-700 text-sm">{conn.supplier_name}</span>
                                  <span className="text-slate-400 text-xs font-medium ml-2">{conn.account_email}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Admin notes */}
                        <div>
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Internal Notes</h3>
                          <textarea
                            value={notesMap[clinic.id] ?? ""}
                            onChange={(e) => setNotesMap((prev) => ({ ...prev, [clinic.id]: e.target.value }))}
                            placeholder="Add internal notes, e.g. 'Called to verify — waiting on updated GDC cert'"
                            rows={3}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#6C3DE8]/10 focus:border-[#6C3DE8] font-medium text-sm resize-none"
                          />
                          <button
                            onClick={() => saveNotes(clinic.id)}
                            disabled={notesSaving === clinic.id}
                            className="mt-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-xl transition-all disabled:opacity-50"
                          >
                            {notesSaving === clinic.id ? "Saving..." : "Save Notes"}
                          </button>
                        </div>

                        {/* Activity log */}
                        {logsMap[clinic.id]?.length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Activity Log</h3>
                            <div className="space-y-2">
                              {logsMap[clinic.id].map((log) => (
                                <div key={log.id} className="flex items-start gap-4 text-sm">
                                  <span className="text-slate-400 font-medium shrink-0">{new Date(log.performed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                  <span className="font-bold text-slate-700">{log.action}</span>
                                  {log.details && <span className="text-slate-400 font-medium">{log.details}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rejection reason */}
                        {clinic.status === "rejected" && clinic.rejection_reason && (
                          <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                            <div className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Rejection Reason</div>
                            <div className="text-sm font-medium text-red-600">{clinic.rejection_reason}</div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-50">
                          {clinic.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateStatus(clinic.id, "approved")}
                                disabled={actionLoading === clinic.id}
                                className="flex items-center gap-2 bg-[#10b981] text-white px-8 py-3.5 rounded-xl font-extrabold text-sm shadow-lg shadow-[#10b981]/20 hover:brightness-110 transition-all disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                {actionLoading === clinic.id ? "Saving..." : "Approve & Email"}
                              </button>
                              <button
                                onClick={() => setRejectModal(clinic.id)}
                                className="flex items-center gap-2 bg-red-500 text-white px-8 py-3.5 rounded-xl font-extrabold text-sm shadow-lg shadow-red-500/20 hover:brightness-110 transition-all"
                              >
                                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                                Reject & Email
                              </button>
                            </>
                          )}
                          {clinic.status === "approved" && (
                            <button onClick={() => updateStatus(clinic.id, "rejected")} className="flex items-center gap-2 bg-slate-100 text-slate-500 px-6 py-3 rounded-xl font-bold text-sm hover:bg-red-50 hover:text-red-500 transition-all">
                              Revoke Approval
                            </button>
                          )}
                          <button
                            onClick={() => loginAsClinic(clinic.id)}
                            disabled={impersonateLoading === clinic.id}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-[#6C3DE8]/10 text-[#6C3DE8] hover:bg-[#6C3DE8]/20 transition-all disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">login</span>
                            {impersonateLoading === clinic.id ? "Generating..." : "Login as Clinic"}
                          </button>
                          <button
                            onClick={() => toggleUser(clinic.id, !clinic.is_deactivated)}
                            disabled={actionLoading === clinic.id}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ml-auto ${clinic.is_deactivated ? "bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20" : "bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500"}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">{clinic.is_deactivated ? "lock_open" : "block"}</span>
                            {clinic.is_deactivated ? "Reactivate Account" : "Deactivate Account"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ONBOARDING TRACKER TAB ── */}
        {activeTab === "tracker" && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Onboarding Tracker</h2>
                <p className="text-slate-400 font-medium text-sm mt-1">See where every signed-up user dropped off.</p>
              </div>
              <button onClick={fetchTracker} className="px-5 py-3 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-500 hover:border-[#6C3DE8]/30 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
              </button>
            </div>

            {/* Step funnel */}
            <div className="grid grid-cols-4 gap-4 mb-10">
              {[1, 2, 3, 4].map((step) => {
                const count = tracker.filter((u) => u.last_step_completed === step).length;
                const labels = ["Signed Up Only", "Practice Details", "Documents Uploaded", "Fully Complete"];
                return (
                  <div key={step} className="bg-white rounded-[2rem] border border-black/[0.04] p-6 shadow-sm text-center">
                    <div className="text-3xl font-extrabold tracking-tighter text-[#6C3DE8] mb-1">{count}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step {step}</div>
                    <div className="text-xs font-medium text-slate-500 mt-1">{labels[step - 1]}</div>
                  </div>
                );
              })}
            </div>

            {trackerLoading ? (
              <div className="text-center py-20 text-slate-400 font-bold">Loading...</div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-black/[0.04] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-50">
                      {["Email", "Practice Name", "Last Step", "Status", "Signed Up"].map((h) => (
                        <th key={h} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {tracker.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5 text-sm font-medium text-slate-700">{user.email}</td>
                        <td className="px-6 py-5 text-sm font-bold text-slate-900">{user.practice_name || <span className="text-slate-300">—</span>}</td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map((s) => (
                                <div key={s} className={`w-5 h-1.5 rounded-full ${s <= user.last_step_completed ? "bg-[#6C3DE8]" : "bg-slate-100"}`} />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-slate-400">Step {user.last_step_completed}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {user.status ? (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.status === "pending" ? "bg-amber-50 text-amber-500" : user.status === "approved" ? "bg-[#10b981]/10 text-[#10b981]" : "bg-red-50 text-red-500"}`}>{user.status}</span>
                          ) : <span className="text-slate-300 text-sm">—</span>}
                        </td>
                        <td className="px-6 py-5 text-sm font-medium text-slate-400">{new Date(user.signed_up_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── SUPPLIER STATS TAB ── */}
        {activeTab === "suppliers" && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Supplier Stats</h2>
              <p className="text-slate-400 font-medium text-sm mt-1">Which suppliers are most commonly connected across all clinics.</p>
            </div>
            {sortedSuppliers.length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-bold">No supplier connections yet.</div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-black/[0.04] shadow-sm p-10 space-y-6">
                {sortedSuppliers.map(([name, count]) => (
                  <div key={name}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-extrabold text-slate-900">{name}</span>
                      <span className="text-sm font-black text-[#6C3DE8]">{count} clinic{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6C3DE8] rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-[2rem] p-10 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Reject Application</h3>
            <p className="text-sm text-slate-400 font-medium mb-6">This reason will be emailed to the clinic.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. GDC certificate is expired or unclear..."
              rows={4}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-400 font-medium text-slate-700 resize-none mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-4 rounded-2xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={() => updateStatus(rejectModal, "rejected", rejectReason)}
                disabled={!rejectReason.trim() || actionLoading === rejectModal}
                className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 hover:brightness-110 transition-all disabled:opacity-40"
              >{actionLoading === rejectModal ? "Sending..." : "Reject & Email"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Re-request document modal */}
      {reDocModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setReDocModal(null)} />
          <div className="relative bg-white rounded-[2rem] p-10 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Re-request Document</h3>
            <p className="text-sm text-slate-400 font-medium mb-6">An email will be sent to <strong>{reDocModal.email}</strong> asking them to re-upload.</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Document Type</label>
                <select
                  value={reDocType}
                  onChange={(e) => setReDocType(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#6C3DE8]/10 focus:border-[#6C3DE8] font-medium"
                >
                  <option value="">Select document</option>
                  <option value="gdc_registration">GDC Registration</option>
                  <option value="proof_of_address">Proof of Address</option>
                  <option value="insurance">Insurance Certificate</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Message (optional)</label>
                <textarea
                  value={reDocMsg}
                  onChange={(e) => setReDocMsg(e.target.value)}
                  placeholder="e.g. The uploaded file was too blurry to read..."
                  rows={3}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#6C3DE8]/10 focus:border-[#6C3DE8] font-medium resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setReDocModal(null)} className="flex-1 py-4 rounded-2xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={sendDocRequest}
                disabled={!reDocType}
                className="flex-1 py-4 rounded-2xl bg-[#6C3DE8] text-white font-bold shadow-lg shadow-[#6C3DE8]/20 hover:brightness-110 transition-all disabled:opacity-40"
              >Send Email</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
