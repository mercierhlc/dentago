import type { CapabilityGroup } from "@/lib/solutions-capabilities";
import SolutionsCapabilityCard from "@/components/solutions/SolutionsCapabilityCard";

function GroupBlock({ group, baseTone }: { group: CapabilityGroup; baseTone: number }) {
  return (
    <div id={group.slug} style={{ marginBottom: 64, scrollMarginTop: 120 }}>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#3a2e6e",
          fontWeight: 600,
          display: "block",
          marginBottom: 10,
        }}
      >
        {group.eyebrow}
      </span>
      <h2
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontWeight: 400,
          fontSize: "clamp(32px,4vw,44px)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: "#15151a",
          margin: "0 0 12px",
          maxWidth: 720,
        }}
      >
        {group.headline}
      </h2>
      {group.sub ? (
        <p style={{ fontSize: 17, color: "#5b606b", lineHeight: 1.5, margin: "0 0 28px", maxWidth: 640 }}>{group.sub}</p>
      ) : (
        <div style={{ marginBottom: 28 }} />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
          gap: 22,
        }}
      >
        {group.features.map((f, i) => (
          <SolutionsCapabilityCard key={f.id} title={f.title} tag={f.tag} bullets={f.bullets} purpose={f.purpose} toneIndex={baseTone + i} />
        ))}
      </div>
    </div>
  );
}

export default function SolutionsProcurementSection({ groups }: { groups: CapabilityGroup[] }) {
  return (
    <section
      id="capabilities"
      style={{
        scrollMarginTop: 120,
        padding: "72px 32px 96px",
        background: "linear-gradient(180deg,#faf8fc 0%,#f7f6f4 38%,#ffffff 100%)",
      }}
    >
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 56px" }}>
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
            Platform capabilities
          </span>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontWeight: 400,
              fontSize: "clamp(40px,5vw,56px)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              margin: "18px 0 16px",
              color: "#15151a",
            }}
          >
            Procurement built like a <em style={{ fontStyle: "italic", color: "#3a2e6e" }}>modern OS</em>
          </h2>
          <p style={{ fontSize: 18, color: "#3a3b40", lineHeight: 1.55, margin: 0 }}>
            Nineteen capability areas — from unified ordering to closed-loop analytics — designed as one coherent stack. Depth varies by plan; every practice starts on the same Marketplace foundation.
          </p>
        </div>

        {groups.map((g, idx) => (
          <GroupBlock key={g.slug} group={g} baseTone={idx * 3} />
        ))}

        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#8a8f9b",
            margin: "32px 0 0",
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Capability rollout follows our product roadmap — book a demo for enterprise timelines and integrations.
        </p>
      </div>
    </section>
  );
}
