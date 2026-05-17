export function solutionsCapabilityAccentBar(i: number): string {
  const tones = [
    "linear-gradient(90deg,#f6e4dc,#eed8c8)",
    "linear-gradient(90deg,#e0d8f0,#d0c8e4)",
    "linear-gradient(90deg,#d6e9df,#c5ddd4)",
    "linear-gradient(90deg,#e8e2f5,#ddd4f0)",
  ];
  return tones[i % tones.length];
}

export default function SolutionsCapabilityCard({
  title,
  tag,
  bullets,
  purpose,
  toneIndex,
}: {
  title: string;
  tag: string;
  bullets: string[];
  purpose: string;
  toneIndex: number;
}) {
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid rgba(14,15,18,0.08)",
        borderRadius: 24,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 1px 2px rgba(20,20,30,0.04)",
      }}
    >
      <div style={{ height: 4, background: solutionsCapabilityAccentBar(toneIndex) }} aria-hidden />
      <div style={{ padding: "26px 26px 22px" }}>
        <span
          style={{
            display: "inline-block",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "#3a2e6e",
            background: "rgba(58,46,110,0.08)",
            padding: "5px 10px",
            borderRadius: 999,
            marginBottom: 14,
          }}
        >
          {tag}
        </span>
        <h3
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontWeight: 400,
            fontSize: 26,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: "#15151a",
            margin: "0 0 14px",
          }}
        >
          {title}
        </h3>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          {bullets.map((b) => (
            <li
              key={b}
              style={{
                fontSize: 14,
                lineHeight: 1.45,
                color: "#3a3b40",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#3a2e6e",
                  flexShrink: 0,
                  marginTop: 6,
                  opacity: 0.85,
                }}
              />
              {b}
            </li>
          ))}
        </ul>
        <p
          style={{
            margin: 0,
            paddingTop: 16,
            borderTop: "1px solid rgba(14,15,18,0.06)",
            fontSize: 14,
            lineHeight: 1.55,
            color: "#5b606b",
            fontStyle: "italic",
          }}
        >
          <strong style={{ fontStyle: "normal", color: "#2a2b30", fontWeight: 600 }}>Why it matters · </strong>
          {purpose}
        </p>
      </div>
    </article>
  );
}
