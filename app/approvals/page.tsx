"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getToken, freshAuthHeaders } from "@/lib/auth";
import Navbar from "@/components/navbar";
import ProfileMenu from "@/components/ProfileMenu";
import { LockedUntilFirstOrder } from "@/components/LockedUntilFirstOrder";

type PendingOrder = {
  id: string;
  clinic_name: string;
  clinic_email: string;
  total_amount: string;
  notes: string | null;
  created_at: string;
  approval_status: string;
};

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, "approved" | "rejected">>({});

  // Approval policy state
  const [policy, setPolicy] = useState<{ approval_threshold: number; enabled: boolean } | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyThreshold, setPolicyThreshold] = useState<string>("");
  const [policyEnabled, setPolicyEnabled] = useState<boolean>(true);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const headers = await freshAuthHeaders();
    if (!headers) { setError("Please log in"); setLoading(false); return; }

    const [ordersRes, policyRes] = await Promise.all([
      fetch("/api/orders/approve", { headers }),
      fetch("/api/clinic/approval-policy", { headers }),
    ]);

    if (ordersRes.status === 403) {
      setError("Only managers and owners can view the approvals queue.");
      setLoading(false);
      setPolicyLoading(false);
      return;
    }

    if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.orders ?? []);
    }

    if (policyRes.ok) {
      const p = await policyRes.json();
      setPolicy(p);
      setPolicyThreshold(String(p.approval_threshold ?? 500));
      setPolicyEnabled(p.enabled ?? false);
    }

    setLoading(false);
    setPolicyLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(orderId: string, action: "approved" | "rejected") {
    setProcessingId(orderId);
    const headers = { ...(await freshAuthHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/orders/approve", {
      method: "POST",
      headers,
      body: JSON.stringify({ orderId, action, notes: notes[orderId] ?? null }),
    });
    setProcessingId(null);
    if (res.ok) {
      setDone(d => ({ ...d, [orderId]: action }));
      setOrders(os => os.filter(o => o.id !== orderId));
    } else {
      const e = await res.json();
      alert(e.error ?? "Failed to process approval");
    }
  }

  async function savePolicy() {
    const threshold = parseFloat(policyThreshold);
    if (isNaN(threshold) || threshold < 0) {
      setPolicyMsg("Please enter a valid threshold amount");
      return;
    }
    const headers = { ...(await freshAuthHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/clinic/approval-policy", {
      method: "POST",
      headers,
      body: JSON.stringify({ approval_threshold: threshold, enabled: policyEnabled }),
    });
    if (res.ok) {
      setPolicyMsg(policyEnabled ? `Approvals enabled for orders over £${threshold.toFixed(2)}` : "Approval workflows disabled");
      setTimeout(() => setPolicyMsg(null), 3000);
    } else {
      const e = await res.json();
      setPolicyMsg(e.error ?? "Failed to save policy");
    }
  }

  return (
    <LockedUntilFirstOrder
      featureName="Approvals"
      featureIcon="approval"
      featureDesc="Route large orders through an approver queue and keep a full audit trail.">
    <div className="min-h-screen bg-[#F9F8FF]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#151121]">Order Approvals</h1>
            <p className="text-sm text-slate-500 mt-1">Review and approve orders that exceed your spending threshold</p>
          </div>
          <ProfileMenu clinic={null} />
        </div>

        {/* Approval Policy Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 className="text-base font-bold text-[#151121] mb-1">Approval Policy</h2>
          <p className="text-sm text-slate-500 mb-4">
            Orders above the threshold require manager sign-off before being sent to suppliers.
          </p>
          {policyLoading ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse w-64" />
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Threshold (£)</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">£</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={policyThreshold}
                    onChange={e => setPolicyThreshold(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[#111111]/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Status</label>
                <button
                  onClick={() => setPolicyEnabled(e => !e)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    policyEnabled
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  {policyEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              <button
                onClick={savePolicy}
                className="bg-[#111111] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#5a2fd4] transition-colors"
              >
                Save Policy
              </button>
              {policyMsg && (
                <p className="text-sm text-emerald-600 font-medium">{policyMsg}</p>
              )}
            </div>
          )}
        </div>

        {/* Pending Orders */}
        <div>
          <h2 className="text-base font-bold text-[#151121] mb-4">
            Pending Approvals
            {orders.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111111] text-white text-[11px] font-bold">
                {orders.length}
              </span>
            )}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-48 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-32" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-slate-700 font-semibold">No pending approvals</p>
              <p className="text-slate-400 text-sm mt-1">All orders are up to date</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="font-bold text-[#151121] text-base">{order.clinic_name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {order.id.slice(0, 8).toUpperCase()} · {fmtDate(order.created_at)}
                        </p>
                        {order.notes && (
                          <p className="text-sm text-slate-500 mt-1 italic">"{order.notes}"</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-[#111111]">
                          {fmtGBP(parseFloat(order.total_amount))}
                        </p>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Awaiting Approval
                        </span>
                      </div>
                    </div>

                    {/* Manager notes input */}
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Add a note (optional)"
                        value={notes[order.id] ?? ""}
                        onChange={e => setNotes(n => ({ ...n, [order.id]: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#111111]/30 placeholder-slate-300"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <button
                        disabled={processingId === order.id}
                        onClick={() => decide(order.id, "approved")}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {processingId === order.id ? "Processing…" : "✓ Approve"}
                      </button>
                      <button
                        disabled={processingId === order.id}
                        onClick={() => decide(order.id, "rejected")}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent decisions */}
        {Object.keys(done).length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">This Session</h2>
            <div className="space-y-2">
              {Object.entries(done).map(([id, action]) => (
                <div key={id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3">
                  <span className={`w-2 h-2 rounded-full ${action === "approved" ? "bg-emerald-500" : "bg-red-400"}`} />
                  <span className="font-mono text-xs text-slate-500">{id.slice(0, 8).toUpperCase()}</span>
                  <span className={`text-sm font-semibold ${action === "approved" ? "text-emerald-700" : "text-red-600"}`}>
                    {action === "approved" ? "Approved" : "Rejected"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-[#111111] transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
    </LockedUntilFirstOrder>
  );
}
