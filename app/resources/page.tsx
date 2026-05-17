import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";

const GUIDES = [
  {
    tag: "Report",
    title: "The UK Dental Supply Cost Report 2026",
    desc: "Benchmarks for supply spend across 800+ UK practices — broken down by practice size, location, and speciality. Find out if you're paying more than you should.",
    readTime: "12 min read",
    gradient: "linear-gradient(160deg,#f5d4c7,#ead8c8)",
    href: "/blog/uk-dental-supply-cost-report-2026",
  },
  {
    tag: "Guide",
    title: "How to audit your supplier pricing in 1 hour",
    desc: "A step-by-step framework for identifying overspend across your active supplier accounts. No spreadsheets required — just your last 3 invoices.",
    readTime: "8 min read",
    gradient: "linear-gradient(160deg,#d8e8d8,#c8d8c8)",
    href: "/blog/audit-supplier-pricing",
  },
  {
    tag: "Guide",
    title: "Par level guide for NHS practices",
    desc: "How to set minimum stock thresholds for a high-throughput NHS practice — with specific recommendations for the 40 most-ordered SKUs.",
    readTime: "10 min read",
    gradient: "linear-gradient(160deg,#e0d8f0,#d0c8e4)",
    href: "/blog/par-level-guide-nhs",
  },
  {
    tag: "Playbook",
    title: "Switching suppliers without disrupting orders",
    desc: "A practical playbook for adding a new supplier or moving spend without creating gaps in your supply chain — from connection to first order.",
    readTime: "6 min read",
    gradient: "linear-gradient(160deg,#f0e8d8,#e4dcc8)",
    href: "/blog/switching-suppliers",
  },
];

const TOOLS = [
  { name: "Savings calculator", desc: "Enter your monthly spend and see your estimated annual saving with Dentago.", href: "/signup" },
  { name: "Par level template", desc: "A pre-filled spreadsheet template for the 60 most common dental consumables.", href: "/signup" },
  { name: "Supplier comparison matrix", desc: "Download the current price comparison for the 200 most-ordered dental products.", href: "/signup" },
];

export default function ResourcesPage() {
  return (
    <>
      <style>{`
        .eyebrow-bar::before { content: ""; display: inline-block; width: 18px; height: 1px; background: #3a2e6e; margin-right: 8px; vertical-align: middle; }
        .resource-card:hover { transform: translateY(-3px); box-shadow: 0 16px 40px -16px rgba(58,46,110,0.2); }
      `}</style>
      <Navbar />

      {/* Hero */}
      <section style={{ padding: "140px 32px 80px", background: "linear-gradient(180deg,#f7f6f4,#fff)", textAlign: "center" }}>
        <span className="eyebrow-bar" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e", fontWeight: 500, display: "inline-flex", alignItems: "center" }}>Resources</span>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(40px,6vw,80px)", lineHeight: 0.95, letterSpacing: "-0.025em", margin: "18px auto 0", maxWidth: 900, color: "#15151a" }}>
          Guides, data and tools for <em style={{ fontStyle: "italic", color: "#3a2e6e" }}>UK dental procurement</em>
        </h1>
        <p style={{ fontSize: 19, color: "#3a3b40", lineHeight: 1.5, margin: "24px auto 0", maxWidth: 560 }}>Everything a UK practice manager needs to understand, audit and reduce their supply costs.</p>
      </section>

      {/* Guide cards */}
      <section style={{ padding: "40px 32px 80px", background: "#fff" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24 }}>
            {GUIDES.map(guide => (
              <Link key={guide.title} href={guide.href} style={{ textDecoration: "none" }}>
                <div className="resource-card" style={{ background: "#fff", border: "1px solid rgba(14,15,18,0.08)", borderRadius: 24, overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s", cursor: "pointer" }}>
                  <div style={{ background: guide.gradient, padding: "32px 28px 28px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(255,255,255,0.7)", color: "#3a2e6e", padding: "4px 10px", borderRadius: 999 }}>{guide.tag}</span>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.15, color: "#15151a", marginTop: 16, fontWeight: 400 }}>{guide.title}</div>
                  </div>
                  <div style={{ padding: 28 }}>
                    <p style={{ fontSize: 15, lineHeight: 1.6, color: "#3a3b40", margin: "0 0 16px" }}>{guide.desc}</p>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5b606b", letterSpacing: "0.06em" }}>{guide.readTime}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section style={{ padding: "80px 32px 120px", background: "#f7f6f4" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <span className="eyebrow-bar" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e", fontWeight: 500 }}>Tools</span>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(36px,5vw,56px)", lineHeight: 1.0, margin: "18px 0 48px", color: "#15151a" }}>
            Free tools for <em style={{ fontStyle: "italic", color: "#3a2e6e" }}>practice managers</em>.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {TOOLS.map(tool => (
              <div key={tool.name} style={{ background: "#fff", border: "1px solid rgba(14,15,18,0.08)", borderRadius: 20, padding: 28 }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "#15151a", fontWeight: 400 }}>{tool.name}</div>
                <p style={{ fontSize: 14, lineHeight: 1.55, color: "#3a3b40", margin: "12px 0 20px" }}>{tool.desc}</p>
                <Link href={tool.href} style={{ fontSize: 14, fontWeight: 500, color: "#3a2e6e", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Access free →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
