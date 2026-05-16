"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";
import { getSiteHeaderScrollOffsetPx, SITE_NAV_BAR_HEIGHT_PX, SITE_HEADER_SCROLL_GAP_PX } from "@/lib/site-layout";
import {
  PLATFORM_HASH_NAV_EVENT,
  animateScrollToElement,
  consumePlatformPendingHash,
  waitForPlatformSection,
} from "@/lib/platform-hash-scroll";
import "@/styles/design-export/pro-features.css";

const HIGHLIGHT_MS = 1300;

function usePlatformHashHighlight(onUnlockSection?: (sectionKey: string) => void) {
  const pathname = usePathname();
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const scrollToHash = useCallback(
    async (raw: string) => {
      const id = raw.replace(/^#/, "");
      if (!id) return;
      const el = await waitForPlatformSection(id);
      if (!el) return;
      /* Scroll the category section so "01 · Procurement" (etc.) sits under the fixed header — not the deeper feat card / spot */
      const scrollTarget = (el.closest("section.cat-sec") as HTMLElement | null) ?? el;
      await animateScrollToElement(scrollTarget, getSiteHeaderScrollOffsetPx(), 720);
      /* IO + DOM `.in` are unreliable after React re-renders from setHighlightId — unlock via section class */
      const sectionKey = scrollTarget.getAttribute("data-platform-section");
      if (sectionKey) onUnlockSection?.(sectionKey);
      setHighlightId(id);
      window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), HIGHLIGHT_MS);
    },
    [onUnlockSection],
  );

  useEffect(() => {
    if (pathname !== "/platform") return;
    let hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash) {
      const pending = consumePlatformPendingHash();
      if (pending) {
        hash = pending;
        window.history.replaceState(null, "", `/platform${hash}`);
      }
    }
    if (!hash) return;
    /* Brief delay so route transition + framer layout settle (cross-page nav). */
    const t = window.setTimeout(() => void scrollToHash(hash), 80);
    return () => clearTimeout(t);
  }, [pathname, scrollToHash]);

  useEffect(() => {
    const onHashChange = () => void scrollToHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [scrollToHash]);

  useEffect(() => {
    const onNav = (e: Event) => {
      const ce = e as CustomEvent<{ hash?: string }>;
      const h = ce.detail?.hash;
      if (h) void scrollToHash(h);
    };
    window.addEventListener(PLATFORM_HASH_NAV_EVENT, onNav);
    return () => window.removeEventListener(PLATFORM_HASH_NAV_EVENT, onNav);
  }, [scrollToHash]);

  return highlightId;
}

function useRevealMarkers(rootSelector: string) {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    const nodes = root?.querySelectorAll<HTMLElement>(".reveal");
    if (!nodes?.length || typeof IntersectionObserver === "undefined") {
      nodes?.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px", threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
}

function FeatCard({
  id,
  highlightId,
  ic,
  icTone,
  delayCls,
  title,
  body,
  microLeft,
  microRight,
  vTone,
}: {
  id?: string;
  highlightId: string | null;
  ic: string;
  icTone?: "" | "t" | "p" | "o";
  delayCls?: "d1" | "d2" | "d3";
  title: string;
  body: string;
  microLeft: string;
  microRight: string;
  vTone?: "" | "t" | "p" | "o" | "w" | "c";
}) {
  const icClass = icTone ? `ic ${icTone}` : "ic";
  const vClass = vTone ? `v ${vTone}` : "v";
  const hl = id && highlightId === id;
  return (
    <div
      id={id}
      className={`feat reveal ${delayCls ?? ""} platform-pro-anchor ${hl ? "platform-pro-highlight" : ""}`.trim()}
    >
      <span className={icClass}>{ic}</span>
      <h4>{title}</h4>
      <p>{body}</p>
      <div className="micro">
        {microLeft} <span className={vClass}>{microRight}</span>
      </div>
    </div>
  );
}

export default function ProFeaturesView() {
  const [unlockedRevealSections, setUnlockedRevealSections] = useState(() => new Set<string>());
  const unlockSection = useCallback((sectionKey: string) => {
    setUnlockedRevealSections((prev) => new Set(prev).add(sectionKey));
  }, []);
  const highlightId = usePlatformHashHighlight(unlockSection);
  useRevealMarkers(".dentago-marketing-root.platform-pro-page");

  const sectionEase = [0.22, 1, 0.36, 1] as const;

  return (
    <>
      <Navbar />

      <div
        className="dentago-marketing-root platform-pro-page"
        style={
          {
            "--site-header-scroll-margin": `calc(var(--dentago-announce-px, 43px) + ${SITE_NAV_BAR_HEIGHT_PX}px + ${SITE_HEADER_SCROLL_GAP_PX}px)`,
          } as CSSProperties
        }
      >
        <motion.section
          className="pro-hero"
          style={{ paddingTop: `calc(var(--dentago-announce-px, 43px) + ${SITE_NAV_BAR_HEIGHT_PX}px + 44px)` }}
          initial={{ opacity: 0.92 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, ease: sectionEase }}
        >
          <div className="pro-hero-inner">
            <span className="pro-tag">
              <span className="d" />
              Dentago Pro · £299/mo
            </span>
            <h1 className="pro-h1">
              21 features
              <br />
              that run your <em>practice</em>
              <br />
              while you run your <em>chair</em>.
            </h1>
            <p className="pro-sub">
              Predictive stock, auto-reorder, approvals, spend analytics, AI assistant — every back-office workflow your clinic does on Mondays,
              automated.
            </p>
            <div className="pro-cta">
              <Link href="/signup" className="btn-white">
                Get started free <span className="arr">→</span>
              </Link>
              <Link href="/demo" className="btn-outline">
                Book a tour
              </Link>
            </div>
            <div className="ribbon">
              <div className="r">
                <div className="num">
                  <em>21</em>
                </div>
                <div className="lbl">
                  automation features
                  <br />
                  across 4 workflows
                </div>
              </div>
              <div className="r">
                <div className="num">
                  <em>4.2h</em>
                </div>
                <div className="lbl">
                  a week saved per
                  <br />
                  practice manager
                </div>
              </div>
              <div className="r">
                <div className="num">
                  <em>0</em>
                </div>
                <div className="lbl">
                  stockouts mid-procedure
                  <br />
                  on Pro accounts (90d avg)
                </div>
              </div>
              <div className="r">
                <div className="num">
                  <em>14d</em>
                </div>
                <div className="lbl">
                  average payback
                  <br />
                  vs subscription
                </div>
              </div>
            </div>
          </div>

          <div className="hero-mock-wrap">
            <div className="hero-mock" style={{ maxWidth: 1320, margin: "56px auto 0" }}>
              <div className="mock-side">
                <div className="ms-logo">
                  <span className="d" />
                  Your clinic
                </div>
                <h6>Workspace</h6>
                <div className="mock-nav-row on">
                  <span className="d" />
                  Procurement Hub
                </div>
                <div className="mock-nav-row">
                  <span className="d" />
                  Stock
                </div>
                <div className="mock-nav-row">
                  <span className="d" />
                  Approvals · 3
                </div>
                <div className="mock-nav-row">
                  <span className="d" />
                  Spend analytics
                </div>
                <h6>Automation</h6>
                <div className="mock-nav-row">
                  <span className="d" />
                  Predictive par
                </div>
                <div className="mock-nav-row">
                  <span className="d" />
                  Auto-reorder
                </div>
              </div>
              <div className="mock-main">
                <h3>
                  Today&apos;s procurement <em>at a glance</em>.
                </h3>
                <p>Multiple sites · every supplier · everything routed through one hub.</p>
                <div className="mock-grid">
                  <div className="mock-card">
                    <span className="ttl">Spend · last 12 weeks</span>
                    <div className="big">
                      £<em>—</em>
                    </div>
                    <div className="mock-bars">
                      <i style={{ height: "30%" }} />
                      <i style={{ height: "50%" }} />
                      <i className="h" style={{ height: "65%" }} />
                      <i style={{ height: "55%" }} />
                      <i className="h" style={{ height: "80%" }} />
                      <i style={{ height: "62%" }} />
                      <i className="h" style={{ height: "75%" }} />
                      <i style={{ height: "48%" }} />
                      <i className="h" style={{ height: "88%" }} />
                      <i style={{ height: "60%" }} />
                      <i className="h" style={{ height: "72%" }} />
                      <i style={{ height: "58%" }} />
                    </div>
                  </div>
                  <div className="mock-card">
                    <span className="ttl">Needs attention</span>
                    <div className="mock-list">
                      <div className="ln">
                        <span>Anaesthetic · 3 left</span>
                        <span className="warn">Par alert</span>
                      </div>
                      <div className="ln">
                        <span>3 orders · approve</span>
                        <span className="pr">£4.2k</span>
                      </div>
                      <div className="ln">
                        <span>Wrights · invoice diff</span>
                        <span className="crit">£14.20</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 01 Procurement */}
        <motion.section
          className={`cat-sec platform-pro-anchor${unlockedRevealSections.has("procurement") ? " platform-pro-reveal-unlocked" : ""}`}
          data-platform-section="procurement"
          style={{ background: "#fff" }}
          initial={{ y: 22 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, amount: 0.02 }}
          transition={{ duration: 0.5, ease: sectionEase }}
        >
          <div className="cat-head">
            <div>
              <span className="cat-num">01 · Procurement</span>
              <h2>
                Buy with the <em>full picture</em>.
              </h2>
            </div>
            <p>
              Marketplace becomes a hub: dashboards across all sites, multi-clinic carts, accounting integrations, and an AI assistant that just answers
              &quot;did we save money on Septanest last month.&quot;
            </p>
          </div>
          <div className="feat-grid">
            <FeatCard
              id="procurement-hub"
              highlightId={highlightId}
              ic="H"
              title="Procurement Hub"
              body="Single dashboard across every site, every supplier, every order. Drill from spend to PO to invoice in two clicks."
              microLeft="All sites · all suppliers"
              microRight="One view"
            />
            <FeatCard
              id="multi-clinic-management"
              ic="M"
              icTone="t"
              delayCls="d1"
              highlightId={highlightId}
              title="Multi-clinic management"
              body="Group orders across practices to unlock bulk pricing. Each clinic keeps its own budget, accounts and approvers."
              microLeft="Multiple practices · shared catalogue"
              microRight="Bulk pricing"
              vTone="t"
            />
            <FeatCard
              id="smart-order-gen"
              ic="A"
              icTone="p"
              delayCls="d2"
              highlightId={highlightId}
              title="AI Purchasing Assistant"
              body="&quot;What did we spend on PPE last quarter?&quot; Ask in plain English. Answers in seconds, with the source data attached."
              microLeft="Avg. answer time"
              microRight="1.4s"
              vTone="p"
            />
            <FeatCard
              ic="$"
              icTone="o"
              highlightId={highlightId}
              title="Custom-pricing PO"
              body="Got a deal with Henkel direct? Drop the price list in. Dentago factors it into compare alongside the live suppliers."
              microLeft="3 PO suppliers · 142 SKUs"
              microRight="Active"
              vTone="o"
            />
            <FeatCard
              ic="I"
              delayCls="d1"
              highlightId={highlightId}
              title="Accounting integrations"
              body="Push every approved invoice to Xero, QuickBooks or Sage with the right code. Reconciliation drops from 2.1h to 12 min."
              microLeft="Xero · QuickBooks · Sage"
              microRight="Connected"
            />
            <FeatCard
              id="consolidated-invoice"
              highlightId={highlightId}
              ic="C"
              icTone="t"
              delayCls="d2"
              title="Consolidated invoice"
              body="Eight supplier invoices land each month. Dentago consolidates into one statement, line-mapped to your POs."
              microLeft="April · 8 suppliers"
              microRight="1 invoice"
              vTone="t"
            />
          </div>
        </motion.section>

        {/* 02 Stock */}
        <motion.section className={`cat-sec platform-pro-anchor${unlockedRevealSections.has("stock") ? " platform-pro-reveal-unlocked" : ""}`} data-platform-section="stock" style={{ background: "#f7f6f4" }} initial={{ y: 22 }} whileInView={{ y: 0 }} viewport={{ once: true, amount: 0.02 }} transition={{ duration: 0.5, ease: sectionEase }}>
          <div className="cat-head">
            <div>
              <span className="cat-num">02 · Stock</span>
              <h2>
                Never run out, <em>mid-procedure</em>.
              </h2>
            </div>
            <p>
              Pro tracks every item — burn rate, expiry, par level, lot number — and quietly drafts the next reorder before you hit zero. The nurse-WhatsApp
              scramble disappears.
            </p>
          </div>
          <motion.div
            id="predictive-par"
            className={`spot platform-pro-anchor${highlightId === "predictive-par" ? " platform-pro-highlight" : ""}`}
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, amount: 0.02 }}
            transition={{ duration: 0.52, ease: sectionEase }}
          >
            <div>
              <span className="cat-num">Predictive par alerts</span>
              <h3>
                Know <em>4 days before</em> you run out.
              </h3>
              <p>
                Dentago learns each clinic&apos;s burn rate from real ordering and treatment volume, then alerts your manager when an item will hit zero —
                with the cheapest reorder pre-staged in the cart.
              </p>
            </div>
            <div className="vis-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e" }}>
                  Stock health · live
                </span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#1f6f5c" }}>
                  ● 184 OK
                </span>
              </div>
              <div className="vis-line alert">
                <span>
                  <span className="av" style={{ background: "#b04a4a" }}>
                    !
                  </span>
                  Septanest 1:100k
                </span>
                <span className="pr">3 left · zero in 4d</span>
              </div>
              <div className="vis-line warn">
                <span>
                  <span className="av" style={{ background: "#c97a3a" }}>
                    !
                  </span>
                  Nitrile gloves M
                </span>
                <span className="pr">14 boxes · zero in 9d</span>
              </div>
              <div className="vis-line">
                <span>
                  <span className="av">✓</span>
                  Filtek Universal A2
                </span>
                <span className="pr">28 syringes</span>
              </div>
              <div className="vis-line">
                <span>
                  <span className="av">✓</span>
                  Scotchbond Universal
                </span>
                <span className="pr">11 bottles</span>
              </div>
            </div>
          </motion.div>
          <div className="feat-grid">
            <FeatCard
              id="stock-tracking"
              highlightId={highlightId}
              ic="S"
              title="Stock + expiry tracking"
              body="Every item, every site, every lot — with expiry alerts and lot recall traceability built in."
              microLeft="186 SKUs tracked"
              microRight={"3 expire < 30d"}
            />
            <FeatCard
              ic="P"
              icTone="t"
              delayCls="d1"
              highlightId={highlightId}
              title="Predictive par levels"
              body="ML model learns each clinic&apos;s pace, sets the right par dynamically, never leaves you short before a busy day."
              microLeft="Learns your clinic's pace"
              microRight="Auto-adjusts"
              vTone="t"
            />
            <FeatCard
              id="auto-reorder"
              highlightId={highlightId}
              ic="A"
              icTone="o"
              delayCls="d2"
              title="Auto-reorder drafts"
              body="When stock hits par, Dentago drafts the order at today&apos;s best price and sits it in the approval queue."
              microLeft="This week · drafts"
              microRight="7 ready"
              vTone="o"
            />
            <FeatCard
              ic="Q"
              icTone="p"
              highlightId={highlightId}
              title="Stockroom QR requests"
              body="Nurses scan a QR on the shelf to request restock. Adds straight to the next basket, no WhatsApp, no sticky note."
              microLeft="Requests · today"
              microRight="12"
              vTone="p"
            />
            <FeatCard
              ic="T"
              icTone="t"
              delayCls="d1"
              highlightId={highlightId}
              title="Treatment-to-stock map"
              body="Connect to your PMS. Each completed treatment auto-decrements the stock items it consumed."
              microLeft="PMS · SOE · Dentally · iSmile"
              microRight="Linked"
              vTone="t"
            />
            <FeatCard
              ic="L"
              delayCls="d2"
              highlightId={highlightId}
              title="Lot & recall lookup"
              body="Search any lot number, see every patient who received it, and notify in one click if a recall lands."
              microLeft="Lookups · 90d"
              microRight="214"
            />
          </div>
        </motion.section>

        {/* 03 Approvals */}
        <motion.section className={`cat-sec platform-pro-anchor${unlockedRevealSections.has("approvals") ? " platform-pro-reveal-unlocked" : ""}`} data-platform-section="approvals" style={{ background: "#fff" }} initial={{ y: 22 }} whileInView={{ y: 0 }} viewport={{ once: true, amount: 0.02 }} transition={{ duration: 0.5, ease: sectionEase }}>
          <div className="cat-head">
            <div>
              <span className="cat-num">03 · Approvals</span>
              <h2>
                Spend with <em>guard rails</em>, not gates.
              </h2>
            </div>
            <p>Set the rules once: who can buy, what they can buy, up to what budget. Dentago routes the rest. No more &quot;can you sign off this PO&quot; Slack threads.</p>
          </div>
          <div className="feat-grid">
            <FeatCard
              id="approval-queue"
              highlightId={highlightId}
              ic="Q"
              title="Approval queue"
              body="Orders over your threshold flow to a single approver inbox. Approve from the phone in a tap."
              microLeft="Pending · today"
              microRight="3 orders"
            />
            <FeatCard
              id="budget-ceiling"
              highlightId={highlightId}
              ic="B"
              icTone="t"
              delayCls="d1"
              title="Budget ceilings"
              body="Set monthly budgets per category, per site. Dentago warns at 80%, blocks at 100% — until override."
              microLeft="PPE · Apr"
              microRight="68% used"
              vTone="t"
            />
            <FeatCard
              ic="R"
              icTone="p"
              delayCls="d2"
              highlightId={highlightId}
              title="Role-based purchasing"
              body="Hygienists buy hygiene. Nurses request, managers approve. Finance sees everything, locks nothing."
              microLeft="Roles · 4 active"
              microRight="14 users"
              vTone="p"
            />
            <FeatCard
              ic="D"
              icTone="o"
              highlightId={highlightId}
              title="Delegated approvers"
              body="Practice manager on holiday? Auto-route to a delegate. Clinic doesn&apos;t pause buying for two weeks."
              microLeft="Active rule"
              microRight="22 Apr–05 May"
              vTone="o"
            />
            <FeatCard
              ic="A"
              delayCls="d1"
              highlightId={highlightId}
              title="Audit trail"
              body="Every approval, override and price comparison is logged with who, when, why. CQC-ready in one export."
              microLeft="90-day events"
              microRight="2,142"
            />
          </div>
        </motion.section>

        {/* 04 Insight */}
        <motion.section className={`cat-sec platform-pro-anchor${unlockedRevealSections.has("insight") ? " platform-pro-reveal-unlocked" : ""}`} data-platform-section="insight" style={{ background: "#f7f6f4" }} initial={{ y: 22 }} whileInView={{ y: 0 }} viewport={{ once: true, amount: 0.02 }} transition={{ duration: 0.5, ease: sectionEase }}>
          <div className="cat-head">
            <div>
              <span className="cat-num">04 · Insight</span>
              <h2>
                The <em>&quot;what did we actually spend&quot;</em> question, gone.
              </h2>
            </div>
            <p>
              Spend analytics at clinic, category and SKU level. Benchmark your costs against the UK dental market average. Get a quarterly savings report your owner will actually read.
            </p>
          </div>
          <motion.div
            id="ai-assistant"
            className={`spot dark platform-pro-anchor${highlightId === "ai-assistant" ? " platform-pro-highlight" : ""}`}
            initial={{ y: 22 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, amount: 0.02 }}
            transition={{ duration: 0.52, ease: sectionEase }}
          >
            <div>
              <span className="cat-num" style={{ color: "#c5b8e8" }}>
                AI Assistant · live
              </span>
              <h3>
                Ask the clinic <em>anything</em>, in English.
              </h3>
              <p>
                Spend trends, supplier comparisons, budget pacing, savings opportunities — phrased as questions, answered in plain English with the data attached.
              </p>
            </div>
            <div className="ai-mock">
              <div className="you">› did we save money on PPE last quarter?</div>
              <div className="ai">
                <span className="h">Dentago AI ·</span> Yes — your clinic spent less on PPE this quarter vs last. Switching gloves supplier saved on unit price. Bulk ordering across sites reduced per-unit cost further.
                <br />
                <br />
                Want me to lock the cheaper supplier as default for these SKUs?
              </div>
              <div className="you" style={{ marginTop: 14 }}>
                › yes, do it
              </div>
            </div>
          </motion.div>
          <div className="feat-grid">
            <FeatCard
              id="spend-analytics"
              highlightId={highlightId}
              ic="A"
              title="Spend analytics"
              body="Dashboards by category, supplier, site, treatment. Benchmark against your last 12 weeks or your whole 12 months."
              microLeft="Category · supplier · site"
              microRight="Full drill-down"
              vTone="t"
            />
            <FeatCard
              ic="S"
              icTone="t"
              delayCls="d1"
              highlightId={highlightId}
              title="Savings report"
              body="Quarterly PDF: total saved, top SKUs, supplier mix, missed opportunities. Auto-emailed to the principal."
              microLeft="Quarterly PDF"
              microRight="Auto-emailed"
              vTone="t"
            />
            <FeatCard
              ic="B"
              icTone="p"
              delayCls="d2"
              highlightId={highlightId}
              title="Industry benchmark"
              body="See how your prices compare to the median UK clinic. Negotiating leverage, in a single chart."
              microLeft="vs UK market median"
              microRight="Negotiating data"
              vTone="p"
            />
            <FeatCard
              ic="F"
              icTone="o"
              highlightId={highlightId}
              title="Forecast & cash plan"
              body="Predict next quarter&apos;s spend by category. Plan cash flow, not chase invoices."
              microLeft="Next quarter"
              microRight="Spend forecast"
              vTone="o"
            />
          </div>
        </motion.section>

        <motion.section className="pro-cta-final platform-pro-anchor" initial={{ y: 16 }} whileInView={{ y: 0 }} viewport={{ once: true, amount: 0.02 }} transition={{ duration: 0.48, ease: sectionEase }}>
          <h2>
            Pro pays for itself <em>in two weeks</em>.
          </h2>
          <p>Pro pays for itself. Search smarter, cut admin, and see exactly where your supply spend goes — starting day one.</p>
          <Link href="/signup" className="btn-hero">
            Get started free <span className="arr">→</span>
          </Link>
        </motion.section>
      </div>

      <Footer />
    </>
  );
}
