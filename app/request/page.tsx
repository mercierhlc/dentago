"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type ProductSuggestion = {
  id: number;
  name: string;
  brand: string;
  category: string;
};

function RequestForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [clinicName, setClinicName] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);

  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [requesterName, setRequesterName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setValidating(false); return; }
    fetch(`/api/public/staff-request?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        setValid(d.valid);
        setClinicName(d.clinic_name ?? null);
      })
      .catch(() => setValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/staff-request?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: productName.trim(),
          quantity: parseInt(quantity) || 1,
          note: note.trim() || null,
          requester_name: requesterName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to submit"); return; }
      setSubmitted(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (validating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA]">
        <div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA] px-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-sm w-full text-center">
          <span className="material-symbols-outlined text-[40px] text-red-300 mb-3 block">link_off</span>
          <h1 className="text-lg font-bold text-slate-800 mb-2">Invalid Link</h1>
          <p className="text-sm text-slate-400">This request link is invalid or has expired. Ask your practice manager for an updated link.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA] px-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[28px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <h1 className="text-lg font-bold text-slate-800 mb-2">Request Sent!</h1>
          <p className="text-sm text-slate-500 mb-6">Your request has been sent to {clinicName ?? "the practice manager"} for review.</p>
          <button
            onClick={() => { setSubmitted(false); setProductName(""); setQuantity("1"); setNote(""); setRequesterName(""); }}
            className="text-sm font-semibold text-[#111111] hover:underline"
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4 py-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full">

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-[22px] text-[#111111]" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Supply Request</p>
          <h1 className="text-lg font-bold text-slate-800">{clinicName ?? "Request Supplies"}</h1>
          <p className="text-xs text-slate-400 mt-1">Your practice manager will review and order this for you.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Product */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">What do you need? <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="e.g. Nitrile gloves size M, impression material…"
              required
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111111]/30 focus:border-[#111111]"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111111]/30 focus:border-[#111111]"
            />
          </div>

          {/* Your name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Your name <span className="text-slate-300">(optional)</span></label>
            <input
              type="text"
              value={requesterName}
              onChange={e => setRequesterName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111111]/30 focus:border-[#111111]"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Note <span className="text-slate-300">(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Urgency, brand preference, where it's stored…"
              rows={2}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111111]/30 focus:border-[#111111] resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !productName.trim()}
            className="w-full py-2.5 text-sm font-semibold text-white bg-[#111111] hover:brightness-110 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending…" : "Submit Request"}
          </button>
        </form>

        <p className="text-[10px] text-slate-300 text-center mt-4">Powered by Dentago</p>
      </div>
    </div>
  );
}

export default function RequestPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA]">
        <div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RequestForm />
    </Suspense>
  );
}
