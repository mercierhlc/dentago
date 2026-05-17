"use client";

import { useMemo, useState } from "react";
import { describeOsEvent, type OsEventInput } from "@/lib/os-readable-event";

const VIOLET = "#111111";

function EventDot({ type }: { type: string }) {
  const c = type.includes("order")
    ? "#22c55e"
    : type.includes("demo")
      ? VIOLET
      : type.includes("outreach")
        ? "#3b82f6"
        : type.includes("supplier")
          ? "#f59e0b"
          : type.includes("clinic") || type.includes("gdc")
            ? "#555555"
            : type.includes("feature_used")
              ? "#64748b"
              : type.includes("deployment") || type.includes("production")
              ? "#0ea5e9"
              : type.includes("os_live_doc") || type.includes("os_approval")
                ? "#a855f7"
                : "#D1C9E8";
  return (
    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 inline-block" style={{ background: c }} />
  );
}

export type OsTimelineEvent = OsEventInput & { id?: string | null };

export function OsEventRow({ ev, compact }: { ev: OsTimelineEvent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const r = useMemo(() => describeOsEvent(ev), [ev]);
  const payload = ev.payload && typeof ev.payload === "object" ? ev.payload : {};
  const metrics = ev.metrics && typeof ev.metrics === "object" ? ev.metrics : {};
  const hasRaw = Object.keys(payload).length > 0 || Object.keys(metrics).length > 0;

  return (
    <div className={`${compact ? "py-3" : "py-4"} border-b border-slate-50 last:border-b-0`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-start gap-4 text-left rounded-xl transition-colors hover:bg-slate-50/80 ${compact ? "-mx-2 px-2 py-1" : "-mx-1 px-1 py-2"}`}
        aria-expanded={open}
      >
        <EventDot type={ev.event_type} />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-[#151121] ${compact ? "text-[15px] leading-snug" : "text-base"}`}>
            {r.headline}
          </p>
          {r.subtitle ? (
            <p className={`text-slate-500 mt-0.5 leading-snug ${compact ? "text-xs" : "text-sm"}`}>{r.subtitle}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            <span className="text-[10px] uppercase tracking-wide text-[#A89DC8] font-bold">
              {ev.event_type.replace(/_/g, " ")}
            </span>
            {ev.source ? <span className="text-[10px] text-slate-400">· {ev.source}</span> : null}
            <span className="text-[10px] ml-0.5 font-semibold text-violet-600 flex items-center gap-0.5">
              <span aria-hidden>{open ? "▼" : "▶"}</span>
              {open ? "Hide" : "Show"} details
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-sm text-slate-400 whitespace-nowrap">
            {ev.created_at
              ? new Date(ev.created_at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        </div>
      </button>

      {open && (
        <div className={`mt-2 ml-8 pl-1 border-l-2 border-violet-100 space-y-3 ${compact ? "text-sm" : "text-[15px]"}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#A89DC8] mb-2">What happened</p>
            <ul className="list-disc list-outside pl-5 space-y-1.5 text-slate-600 leading-relaxed">
              {r.details.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          {(ev.entity_type || ev.entity_id) && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Linked record:</span>{" "}
              {[ev.entity_type, ev.entity_id].filter(Boolean).join(" ") || "—"}
            </p>
          )}
          {r.sourceLabel ? (
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Actor / channel:</span> {r.sourceLabel}
            </p>
          ) : null}
          {hasRaw ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A89DC8] mb-2">
                Raw data (for debugging / AI)
              </p>
              {Object.keys(payload).length > 0 ? (
                <pre className="text-[11px] leading-relaxed bg-slate-900 text-emerald-100/90 rounded-xl p-3 overflow-x-auto max-h-64 overflow-y-auto font-mono">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              ) : null}
              {Object.keys(metrics).length > 0 ? (
                <>
                  <p className="text-[10px] font-bold text-slate-500 mt-2 mb-1">Metrics</p>
                  <pre className="text-[11px] leading-relaxed bg-slate-800 text-amber-100/90 rounded-xl p-3 overflow-x-auto font-mono">
                    {JSON.stringify(metrics, null, 2)}
                  </pre>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No payload or metrics on this row.</p>
          )}
        </div>
      )}
    </div>
  );
}
