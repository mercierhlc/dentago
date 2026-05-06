"use client";

import { useMemo, useState } from "react";
import {
  OUTREACH_TEMPLATE_GROUPS,
  OUTREACH_TEMPLATES,
  type OutreachTemplate,
  type OutreachTemplateGroupId,
} from "@/lib/os/outreach-templates-data";

const BORDER = "border-[#EDEAF5]";
const P = "#6C3DE8";

export function OsTemplatesPanel() {
  const [group, setGroup] = useState<OutreachTemplateGroupId | "all">("start_here");
  const [selectedId, setSelectedId] = useState<string>("gates");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return OUTREACH_TEMPLATES.filter((t) => {
      if (group !== "all" && t.groupId !== group) return false;
      if (!qq) return true;
      const blob = `${t.title} ${t.whenToUse} ${t.body} ${t.pickerHint} ${t.subject ?? ""}`.toLowerCase();
      return blob.includes(qq);
    });
  }, [group, q]);

  const selected: OutreachTemplate | undefined =
    OUTREACH_TEMPLATES.find((t) => t.id === selectedId) ?? filtered[0];

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-[#F5F3FB]">
      <div className="flex-shrink-0 bg-white border-b border-[#EDEAF5] px-6 py-4">
        <div className="relative max-w-md mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C0B8D8]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#EDEAF5] text-sm bg-[#F9F8FD] focus:outline-none focus:ring-2 focus:ring-violet-100 text-[#0D0B1E] placeholder-[#C0B8D8]"
          />
        </div>

        <p className="text-[10px] font-semibold text-[#A89DC8] uppercase tracking-[0.12em] mb-2">
          Categories
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setGroup("all");
              setSelectedId(OUTREACH_TEMPLATES[0]!.id);
            }}
            className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all border ${group === "all" ? "text-white border-transparent shadow-sm" : "bg-[#F9F8FD] border-[#EDEAF5] text-[#7A7090] hover:border-[#D4CDE8]"}`}
            style={
              group === "all"
                ? { background: P, borderColor: P }
                : {}
            }
          >
            All
            <span className={`text-[10px] font-bold ml-0.5 ${group === "all" ? "opacity-70" : "text-[#C0B8D8]"}`}>
              {OUTREACH_TEMPLATES.length}
            </span>
          </button>
          {[...OUTREACH_TEMPLATE_GROUPS].sort((a, b) => a.sort - b.sort).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGroup(g.id);
                const first = OUTREACH_TEMPLATES.find((t) => t.groupId === g.id);
                if (first) setSelectedId(first.id);
              }}
              className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all border ${group === g.id ? "text-white border-transparent shadow-sm" : "bg-[#F9F8FD] border-[#EDEAF5] text-[#7A7090] hover:border-[#D4CDE8]"}`}
              style={
                group === g.id ? { background: "#2563eb", borderColor: "#2563eb" } : {}
              }
            >
              <span>{g.emoji}</span>
              {g.title}
              <span
                className={`text-[10px] font-bold ml-0.5 ${group === g.id ? "opacity-70" : "text-[#C0B8D8]"}`}
              >
                {OUTREACH_TEMPLATES.filter((t) => t.groupId === g.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* list */}
        <div className="w-[340px] flex-shrink-0 border-r border-[#EDEAF5] overflow-y-auto bg-white">
          {filtered.length === 0 ? (
            <p className="p-5 text-sm text-[#A89DC8]">Nothing matches.</p>
          ) : (
            filtered.map((t) => {
              const on = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#F5F3FB] transition-all ${on ? "bg-[#F0ECFA] border-l-2 border-l-[#6C3DE8]" : "hover:bg-[#F9F8FD] border-l-2 border-l-transparent"}`}
                >
                  <p className={`text-[13px] font-semibold leading-snug ${on ? "text-[#6C3DE8]" : "text-[#0D0B1E]"}`}>
                    {t.title}
                  </p>
                  <p className="text-[11px] text-[#7A7090] mt-1 leading-relaxed">{t.pickerHint}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-[#A89DC8] bg-[#F9F8FD] px-1.5 py-0.5 rounded-md">
                      {t.audience === "internal" ? "internal" : t.audience}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-[#2563eb] bg-blue-50/80 px-1.5 py-0.5 rounded-md">
                      {t.channel}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* detail */}
        <div className="flex-1 overflow-y-auto bg-white">
          {selected ? (
            <article className="max-w-3xl mx-auto px-10 py-8">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A89DC8] mb-3">
                {OUTREACH_TEMPLATE_GROUPS.find((g) => g.id === selected.groupId)?.emoji}{" "}
                {OUTREACH_TEMPLATE_GROUPS.find((g) => g.id === selected.groupId)?.title}
              </p>
              <h2 className="text-xl font-bold text-[#0D0B1E] leading-snug">{selected.title}</h2>

              <div className="mt-4 space-y-3">
                <div className={`rounded-2xl border ${BORDER} bg-[#F9F8FD] px-4 py-3`}>
                  <p className="text-[10px] font-semibold text-[#A89DC8] uppercase tracking-wide mb-1">
                    When to use
                  </p>
                  <p className="text-sm text-[#37304a] leading-relaxed">{selected.whenToUse}</p>
                </div>
                {selected.prerequisites && selected.prerequisites.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
                      Prerequisites / gates
                    </p>
                    <ul className="text-sm text-amber-900 list-disc list-inside space-y-1">
                      {selected.prerequisites.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.warnings && selected.warnings.length > 0 && (
                  <div className="rounded-2xl border border-violet-100 bg-[#EDE9F8]/50 px-4 py-3">
                    <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1">
                      Watch-outs
                    </p>
                    <ul className="text-sm text-[#524178] list-disc list-inside space-y-1">
                      {selected.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.subject && (
                  <div>
                    <p className="text-[10px] font-semibold text-[#A89DC8] uppercase tracking-wide mb-1">
                      Subject line
                    </p>
                    <p className="text-sm font-medium text-[#0D0B1E] bg-white border border-[#EDEAF5] rounded-xl px-4 py-2.5">
                      {selected.subject}
                    </p>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[10px] font-semibold text-[#A89DC8] uppercase tracking-wide">
                      Copy — highlight and paste
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(selected.body);
                      }}
                      className="text-[11px] font-bold text-[#6C3DE8] hover:underline"
                    >
                      Copy body
                    </button>
                  </div>
                  <pre className="text-[13px] leading-relaxed text-[#231d37] whitespace-pre-wrap font-sans bg-[#FAFBFF] border border-[#EDEAF5] rounded-2xl p-5">
                    {selected.body}
                  </pre>
                </div>
              </div>
            </article>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#A89DC8]">
              Select a template from the left.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
