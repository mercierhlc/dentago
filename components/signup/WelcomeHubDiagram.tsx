"use client";

import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";

/** Curves from supplier column toward hub (end ~ hub left edge). */
const PATHS_IN = [
  "M 200 50  C 360 50, 420 220, 540 220",
  "M 160 110 C 340 110, 420 220, 540 220",
  "M 240 170 C 380 170, 440 220, 540 220",
  "M 180 230 C 360 230, 440 220, 540 220",
  "M 260 290 C 400 290, 460 240, 540 220",
  "M 220 350 C 380 350, 460 240, 540 220",
];

/** Curves from hub toward workspace column. */
const PATHS_OUT = [
  "M 600 220 C 720 220, 800 70,  920 70",
  "M 600 220 C 740 220, 820 170, 920 170",
  "M 600 220 C 740 220, 820 270, 920 270",
  "M 600 220 C 720 220, 800 370, 920 370",
];

const CHIP_OFFSET_PCT = [8, 0, 14, 4, 18, 10];

const WORKSPACE_ROWS: {
  title: string;
  sub: string;
  icons: [ReactNode, ReactNode];
}[] = [
  {
    title: "Search & compare",
    sub: "One tab, every supplier price",
    icons: [
      <svg key="a" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="7" cy="7" r="5" />
        <path d="M11 11l3 3" />
      </svg>,
      <svg key="b" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M2 8h12M9 4l4 4-4 4" />
      </svg>,
    ],
  },
  {
    title: "Unified ordering",
    sub: "One basket, splits automatically",
    icons: [
      <svg key="a" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M2 3h2l2 8h8l2-6H5" />
        <circle cx="7" cy="13" r="1" />
        <circle cx="13" cy="13" r="1" />
      </svg>,
      <svg key="b" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="2" y="4" width="12" height="9" rx="1" />
        <path d="M2 7h12" />
      </svg>,
    ],
  },
  {
    title: "Invoice OCR",
    sub: "Drop a PDF, we extract every line",
    icons: [
      <svg key="a" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="3" y="2" width="10" height="12" rx="1" />
        <path d="M5 5h6M5 8h6M5 11h4" />
      </svg>,
      <svg key="b" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M8 2v8M4 6l4 4 4-4M2 13h12" />
      </svg>,
    ],
  },
  {
    title: "Spend analytics",
    sub: "Reports across your practice",
    icons: [
      <svg key="a" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M2 13l3-4 3 2 6-7M14 4h-3M14 4v3" />
      </svg>,
      <svg key="b" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="2" y="9" width="2" height="5" />
        <rect x="6" y="6" width="2" height="8" />
        <rect x="10" y="3" width="2" height="11" />
      </svg>,
    ],
  },
];

export function WelcomeHubDiagram() {
  const markerUid = useId().replace(/:/g, "");
  const markerId = `welcome-arrow-${markerUid}`;

  return (
    <div className="relative mx-auto mt-10 grid min-h-0 w-full max-w-[1100px] grid-cols-1 gap-9 md:mt-12 md:min-h-[440px] md:grid-cols-[1fr_1.15fr_1fr] md:items-center md:gap-0">
      <svg
        className="pointer-events-none absolute inset-0 z-[1] hidden h-full w-full md:block"
        viewBox="0 0 1100 440"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden
      >
        <defs>
          <marker
            id={markerId}
            markerUnits="strokeWidth"
            markerWidth="5"
            markerHeight="5"
            refX="4.2"
            refY="2.5"
            orient="auto"
            viewBox="0 0 5 5"
          >
            <path d="M0 0 L5 2.5 L0 5 Z" className="fill-[#0e0f12]" fillOpacity={0.78} />
          </marker>
        </defs>
        {[...PATHS_IN, ...PATHS_OUT].map((d, i) => (
          <motion.path
            key={d}
            d={d}
            className="stroke-[#0e0f12]"
            strokeWidth={1.5}
            strokeOpacity={0.42}
            vectorEffect="non-scaling-stroke"
            markerEnd={`url(#${markerId})`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { delay: 0.28 + i * 0.12, duration: 1.65, ease: [0.22, 1, 0.36, 1] },
              opacity: { delay: 0.28 + i * 0.12, duration: 0.45 },
            }}
          />
        ))}
      </svg>

      <motion.div
        className="relative z-[2] flex flex-col items-center gap-2.5 md:items-start"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.11, delayChildren: 0.55 } },
        }}
      >
        <span className="mb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-neutral-500 md:absolute md:-top-7 md:left-0 md:mb-0">
          40+ UK suppliers
        </span>
        {[
          { abbr: "HS", name: "Henry Schein" },
          { abbr: "KE", name: "Kent Express" },
          { abbr: "DS", name: "Dental Sky" },
          { abbr: "TC", name: "Trycare" },
          { abbr: "DD", name: "DD Group" },
          { abbr: "WD", name: "Wrights" },
        ].map((s, i) => (
          <motion.div
            key={s.abbr}
            variants={{
              hidden: { opacity: 0, x: -14 },
              show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 28 } },
            }}
            className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-[rgba(14,15,18,0.08)] bg-white py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-[#0e0f12] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-[transform,border-color] duration-150 hover:translate-x-1 hover:border-neutral-400 md:max-w-none"
            style={{ marginLeft: `${CHIP_OFFSET_PCT[i] ?? 0}%` }}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0e0f12] text-[9.5px] font-semibold tracking-wide text-white">
              {s.abbr}
            </span>
            {s.name}
          </motion.div>
        ))}
      </motion.div>

      <div className="relative z-[2] flex flex-col items-center gap-3">
        <motion.div
          className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#0e0f12] text-white shadow-[0_20px_40px_-16px_rgba(20,20,30,0.4)]"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 30, delay: 0.28 }}
        >
          <div className="pointer-events-none absolute inset-[-8px] rounded-full border border-[rgba(14,15,18,0.08)]" />
          <motion.div
            className="pointer-events-none absolute inset-[-22px] rounded-full border border-dashed border-[rgba(14,15,18,0.08)]"
            animate={{ rotate: [0, 2, 0, -2, 0], opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative h-9 w-9 rounded-[10px] bg-white">
            <div
              className="absolute left-[9px] top-[9px] h-[18px] w-[18px] rounded-[5px] bg-[#0e0f12]"
              style={{ clipPath: "polygon(0 0,100% 0,100% 70%,70% 100%,0 100%)" }}
            />
          </div>
        </motion.div>
        <motion.p
          className="text-sm font-semibold tracking-tight text-[#0e0f12]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.65 }}
        >
          Dentago
        </motion.p>
        <p className="-mt-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-neutral-500">Procurement hub</p>
      </div>

      <motion.div
        className="relative z-[2] flex flex-col items-center gap-6 md:items-end"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.14, delayChildren: 0.95 } },
        }}
      >
        <span className="mb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-neutral-500 md:absolute md:-top-7 md:right-0 md:mb-0">
          Your workspace
        </span>

        {WORKSPACE_ROWS.map((row) => (
          <motion.div
            key={row.title}
            variants={{
              hidden: { opacity: 0, x: 16 },
              show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 190, damping: 30 } },
            }}
            className="flex w-full max-w-[320px] items-center justify-center gap-2.5 md:max-w-none md:justify-end"
          >
            <div className="min-w-0 text-center md:text-right">
              <p className="text-sm font-semibold text-[#0e0f12]">{row.title}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{row.sub}</p>
            </div>
            <div className="flex shrink-0">
              {row.icons.map((icon, j) => (
                <div
                  key={j}
                  className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(14,15,18,0.08)] bg-white text-[#0e0f12] shadow-[0_1px_2px_rgba(0,0,0,0.02)] first:ml-0"
                >
                  {icon}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
