import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Dentago — Free Dental Procurement Platform for UK Practices";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: "40px" }}>
          <div
            style={{
              background: "#6C3DE8",
              borderRadius: "16px",
              width: "60px",
              height: "60px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "20px",
              fontSize: "32px",
            }}
          >
            🦷
          </div>
          <span style={{ color: "white", fontSize: "36px", fontWeight: "800", letterSpacing: "-1px" }}>
            Dentago
          </span>
        </div>

        <div
          style={{
            color: "white",
            fontSize: "58px",
            fontWeight: "800",
            lineHeight: 1.1,
            letterSpacing: "-2px",
            marginBottom: "32px",
            maxWidth: "900px",
          }}
        >
          Compare Every UK Dental Supplier. In One Search.
        </div>

        <div style={{ color: "#a5b4fc", fontSize: "26px", marginBottom: "48px", maxWidth: "800px" }}>
          Henry Schein · Kent Express · Dental Sky · 40+ suppliers · Free for UK practices
        </div>

        <div style={{ display: "flex", gap: "20px" }}>
          {["Real-time prices", "One cart", "Free forever"].map((tag) => (
            <div
              key={tag}
              style={{
                background: "rgba(108, 61, 232, 0.3)",
                border: "1px solid rgba(108, 61, 232, 0.6)",
                borderRadius: "100px",
                padding: "12px 24px",
                color: "#c4b5fd",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              ✓ {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
