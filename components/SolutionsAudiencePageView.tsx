import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";
import SolutionsCapabilityCard from "@/components/solutions/SolutionsCapabilityCard";
import { getProcurementFeaturesByIds } from "@/lib/solutions-capabilities";
import type { SolutionsAudiencePageConfig } from "@/lib/solutions-audience-pages";
import { SITE_NAV_BAR_HEIGHT_PX } from "@/lib/site-layout";

/** Air below fixed announce + nav before breadcrumb (uses measured announce height) */
const AUDIENCE_HERO_TOP_PADDING = `calc(var(--dentago-announce-px, 43px) + ${SITE_NAV_BAR_HEIGHT_PX}px + 52px)`;

const SEGMENT_LABEL: Record<SolutionsAudiencePageConfig["segment"], string> = {
  "clinic-type": "Clinic type",
  role: "Role",
  workflow: "Workflow",
};

export default function SolutionsAudiencePageView({ config }: { config: SolutionsAudiencePageConfig }) {
  const features = getProcurementFeaturesByIds(config.featureIds);

  return (
    <>
      <style>{`
        .solutions-audience-breadcrumb a { color: #5b606b; text-decoration: none; }
        .solutions-audience-breadcrumb a:hover { color: #3a2e6e; text-decoration: underline; }
      `}</style>
      <Navbar />

      <section
        style={{
          padding: `${AUDIENCE_HERO_TOP_PADDING} 32px 72px`,
          background: "linear-gradient(180deg,#faf8fc 0%,#f7f6f4 55%,#ffffff 100%)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <nav className="solutions-audience-breadcrumb" aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 28 }}>
            <Link href="/solutions">Solutions</Link>
            <span style={{ color: "#b0b4bc", margin: "0 10px" }}>/</span>
            <span style={{ color: "#5b606b" }}>{SEGMENT_LABEL[config.segment]}</span>
            <span style={{ color: "#b0b4bc", margin: "0 10px" }}>/</span>
            <span style={{ color: "#15151a", fontWeight: 500 }}>{config.menuLabel}</span>
          </nav>

          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#3a2e6e",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ width: 18, height: 1, background: "#3a2e6e" }} aria-hidden />
            {config.heroEyebrow}
          </span>

          <h1
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontWeight: 400,
              fontSize: "clamp(44px,6vw,76px)",
              lineHeight: 0.98,
              letterSpacing: "-0.028em",
              margin: "20px 0 24px",
              color: "#15151a",
            }}
          >
            {config.heroTitleSegments.map((seg, idx) =>
              seg.italic ? (
                <em key={`${idx}-${seg.text}`} style={{ fontStyle: "italic", color: "#3a2e6e" }}>
                  {seg.text}
                </em>
              ) : (
                <span key={`${idx}-${seg.text}`}>{seg.text}</span>
              ),
            )}
          </h1>

          <p style={{ fontSize: 19, color: "#3a3b40", lineHeight: 1.55, margin: "0 0 40px", maxWidth: 640 }}>
            {config.heroLead}
          </p>

          <div
            style={{
              background: "#fff",
              border: "1px solid rgba(14,15,18,0.08)",
              borderRadius: 22,
              padding: "28px 32px",
              boxShadow: "0 8px 24px -12px rgba(20,20,30,0.08)",
            }}
          >
            <h2
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontWeight: 400,
                fontSize: 26,
                margin: "0 0 18px",
                color: "#15151a",
              }}
            >
              {config.outcomesHeading}
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {config.outcomes.map((o) => (
                <li key={o} style={{ fontSize: 15, lineHeight: 1.5, color: "#2a2b30", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "#1f6f5c", fontWeight: 700, flexShrink: 0 }}>✓</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section style={{ padding: "56px 32px 96px", background: "#fff" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#3a2e6e",
              fontWeight: 600,
              display: "block",
              marginBottom: 12,
            }}
          >
            Capabilities for you
          </span>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontWeight: 400,
              fontSize: "clamp(32px,4vw,46px)",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: "#15151a",
              margin: "0 0 16px",
              maxWidth: 720,
            }}
          >
            How Dentago <em style={{ fontStyle: "italic", color: "#3a2e6e" }}>supports</em> this lens
          </h2>
          <p style={{ fontSize: 17, color: "#5b606b", lineHeight: 1.55, margin: "0 0 36px", maxWidth: 680 }}>
            {config.capabilityIntro}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
              gap: 22,
            }}
          >
            {features.map((f, i) => (
              <SolutionsCapabilityCard key={f.id} title={f.title} tag={f.tag} bullets={f.bullets} purpose={f.purpose} toneIndex={i} />
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 32px 110px", background: "#f7f6f4", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 36, color: "#15151a", margin: "0 0 12px" }}>
            See it on your sites
          </h2>
          <p style={{ fontSize: 16, color: "#5b606b", lineHeight: 1.55, margin: "0 0 28px" }}>
            Walk the platform with our team — or explore every capability on the Solutions overview.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href="/demo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "14px 26px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                background: "#0e0f12",
                color: "#fff",
              }}
            >
              Book a demo →
            </Link>
            <Link
              href="/solutions"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "14px 26px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                background: "#fff",
                color: "#0e0f12",
                border: "1px solid rgba(14,15,18,0.12)",
              }}
            >
              All solutions
            </Link>
            <Link
              href="/platform"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "14px 26px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                color: "#3a2e6e",
                border: "1px solid rgba(58,46,110,0.25)",
                background: "rgba(58,46,110,0.04)",
              }}
            >
              Platform tour
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
