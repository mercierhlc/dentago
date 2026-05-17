import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";
import SolutionsProcurementSection from "@/components/SolutionsProcurementSection";
import { PROCUREMENT_CAPABILITY_GROUPS } from "@/lib/solutions-capabilities";

const SOLUTIONS = [
  {
    anchorId: "single-practice",
    name: "Single Practice",
    desc: "For independent practices with 1–3 chairs. Replace all supplier portals with one login and start saving in 10 minutes.",
    price: "Free",
    gradient: "linear-gradient(160deg,#f6e4dc,#eed8c8)",
    features: [
      "Unified supplier ordering & live pricing",
      "Smart search · SKU, brand, procedure",
      "One cart, multi-supplier checkout",
      "Order history & delivery visibility",
      "Staff request QR link",
      "Up to 2 users · email support",
    ],
  },
  {
    anchorId: "multi-site-group",
    name: "Multi-Site Group",
    desc: "For groups with 2–10 practices. Centralise procurement, track spend by location, and manage budgets across sites.",
    price: "Pro · £299/site/mo",
    gradient: "linear-gradient(160deg,#e0d8f0,#d0c8e4)",
    features: [
      "Everything in Free",
      "Inventory, par alerts & reorder drafts",
      "Spend analytics & budget ceilings",
      "Approval workflows & audit trail",
      "Multi-clinic control tower views",
      "Accounting integrations · unlimited users",
    ],
  },
  {
    anchorId: "dso-corporate",
    name: "DSO / Corporate",
    desc: "For dental corporates managing 10+ sites. Enterprise controls, accounting integrations, and dedicated support.",
    price: "Enterprise",
    gradient: "linear-gradient(160deg,#1a1426,#2a2040)",
    dark: true,
    features: [
      "Everything in Pro",
      "Closed-loop procurement analytics",
      "Supplier scorecards & governance",
      "Custom PO, OCR & reconciliation workflows",
      "ERP-grade integrations · vendor messaging",
      "Dedicated AM · SLA · DPA / ISO roadmap alignment",
    ],
  },
];

const TABLE: [string, string, string, string][] = [
  ["Marketplace search", "✓", "✓", "✓"],
  ["One cart checkout", "✓", "✓", "✓"],
  ["Order history", "✓", "✓", "✓"],
  ["Spend analytics", "—", "✓", "✓"],
  ["Par-level alerts", "—", "✓", "✓"],
  ["Approval queue", "—", "✓", "✓"],
  ["Budget ceilings", "—", "✓", "✓"],
  ["Multi-clinic view", "—", "✓", "✓"],
  ["Accounting integrations", "—", "—", "✓"],
  ["PMS connectors", "—", "—", "✓"],
  ["Custom PO workflows", "—", "—", "✓"],
  ["Dedicated account manager", "—", "—", "✓"],
];

export default function SolutionsPage() {
  return (
    <>
      <style>{`
        .eyebrow-bar::before { content: ""; display: inline-block; width: 18px; height: 1px; background: #3a2e6e; margin-right: 8px; vertical-align: middle; }
        .solutions-anchor-target { scroll-margin-top: 120px; }
      `}</style>
      <Navbar />

      {/* Hero */}
      <section style={{ padding: "140px 32px 80px", background: "linear-gradient(180deg,#f7f6f4,#fff)", textAlign: "center" }}>
        <span className="eyebrow-bar" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e", fontWeight: 500, display: "inline-flex", alignItems: "center" }}>Solutions</span>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(48px,7vw,96px)", lineHeight: 0.95, letterSpacing: "-0.025em", margin: "18px auto 0", maxWidth: 900, color: "#15151a" }}>
          Built for <em style={{ fontStyle: "italic", color: "#3a2e6e" }}>every</em> part of your practice
        </h1>
        <p style={{ fontSize: 19, color: "#3a3b40", lineHeight: 1.5, margin: "24px auto 0", maxWidth: 620 }}>
          Search, order, stock, approvals, invoices, and analytics — structured like the procurement OS growing clinics expect. Pick your footprint below.
        </p>
      </section>

      <SolutionsProcurementSection groups={PROCUREMENT_CAPABILITY_GROUPS} />

      {/* Solution cards */}
      <section style={{ padding: "60px 32px 80px", background: "#fff" }}>
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 24,
          }}
        >
          {SOLUTIONS.map((sol) => (
            <div
              key={sol.name}
              id={sol.anchorId}
              className="solutions-anchor-target"
              style={{ background: sol.dark ? "#1a1426" : "#fff", border: sol.dark ? "none" : "1px solid rgba(14,15,18,0.08)", borderRadius: 28, padding: 36, display: "flex", flexDirection: "column", gap: 20, backgroundImage: sol.gradient ? undefined : undefined }}>
              <div style={{ borderRadius: 16, background: sol.gradient, padding: "28px 24px", minHeight: 100 }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: sol.dark ? "#fff" : "#15151a", fontWeight: 400 }}>{sol.name}</div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: sol.dark ? "#c5b8e8" : "#3a2e6e" }}>{sol.price}</div>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: sol.dark ? "#c8c5d6" : "#3a3b40", margin: 0 }}>{sol.desc}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {sol.features.map(f => (
                  <li key={f} style={{ fontSize: 14, color: sol.dark ? "#dad6e4" : "#2a2b30", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: sol.dark ? "#c5b8e8" : "#3a2e6e", flexShrink: 0, display: "inline-block" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: "auto" }}>
                <Link href={sol.name === "DSO / Corporate" ? "/demo" : "/signup"} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "14px 24px", borderRadius: 999, fontSize: 14, fontWeight: 500, textDecoration: "none", background: sol.dark ? "#fff" : "#0e0f12", color: sol.dark ? "#0e0f12" : "#fff" }}>
                  {sol.name === "DSO / Corporate" ? "Talk to us" : "Get started free"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature table */}
      <section style={{ padding: "80px 32px 120px", background: "#f7f6f4" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <span className="eyebrow-bar" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e", fontWeight: 500 }}>Compare plans</span>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 48, margin: "14px 0 48px", color: "#15151a", letterSpacing: "-0.02em" }}>Feature by <em style={{ fontStyle: "italic", color: "#3a2e6e" }}>solution</em>.</h2>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                {["Feature", "Single Practice", "Multi-Site", "DSO / Corporate"].map((h, i) => (
                  <th key={h} style={{ padding: "16px 20px", textAlign: i === 0 ? "left" : "center", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "#5b606b", fontWeight: 500, background: "#eeeae2", borderBottom: "1px solid rgba(14,15,18,0.08)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE.map(([feature, single, multi, dso], i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf9f7" }}>
                  <td style={{ padding: "14px 20px", fontSize: 14, color: "#0e0f12", borderBottom: "1px solid rgba(14,15,18,0.06)" }}>{feature}</td>
                  {[single, multi, dso].map((v, j) => (
                    <td key={j} style={{ padding: "14px 20px", textAlign: "center", fontSize: 14, color: v === "✓" ? "#1f6f5c" : "#8a8f9b", fontWeight: v === "✓" ? 600 : 400, borderBottom: "1px solid rgba(14,15,18,0.06)" }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Footer />
    </>
  );
}
