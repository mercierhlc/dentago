import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";

const SUPPLIERS = [
  { name: "Henry Schein", products: "14,200+", status: "Connected", color: "#3a2e6e" },
  { name: "DHB", products: "5,500+", status: "Connected", color: "#3a2e6e" },
  { name: "DD Group", products: "10,000+", status: "Connected", color: "#3a2e6e" },
  { name: "Kent Express", products: "8,400+", status: "Connected", color: "#3a2e6e" },
  { name: "Dental Sky", products: "6,800+", status: "Connected", color: "#3a2e6e" },
  { name: "Wrights", products: "5,200+", status: "Connected", color: "#3a2e6e" },
];

const STEPS = [
  { n: "01", title: "Connect your existing account", body: "Use your current supplier login credentials. We authenticate on your behalf and pull your real negotiated prices — not list prices." },
  { n: "02", title: "We sync your pricing", body: "Dentago pulls your actual account pricing across all connected suppliers and keeps it current. Your negotiated rates stay yours." },
  { n: "03", title: "Search and compare in one place", body: "The next time you search for any product, you'll see every supplier's price side by side — and you can add from any of them into a single cart." },
];

export default function SuppliersPage() {
  return (
    <>
      <style>{`
        .eyebrow-bar::before { content: ""; display: inline-block; width: 18px; height: 1px; background: #3a2e6e; margin-right: 8px; vertical-align: middle; }
        .sup-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -12px rgba(58,46,110,0.2); }
      `}</style>
      <Navbar />

      {/* Hero */}
      <section style={{ padding: "140px 32px 80px", background: "linear-gradient(180deg,#f7f6f4,#fff)", textAlign: "center" }}>
        <span className="eyebrow-bar" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e", fontWeight: 500, display: "inline-flex", alignItems: "center" }}>Suppliers</span>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(48px,7vw,96px)", lineHeight: 0.95, letterSpacing: "-0.025em", margin: "18px auto 0", maxWidth: 900, color: "#15151a" }}>
          The UK suppliers you use most, <em style={{ fontStyle: "italic", color: "#3a2e6e" }}>one place</em>
        </h1>
        <p style={{ fontSize: 19, color: "#3a3b40", lineHeight: 1.5, margin: "24px auto 0", maxWidth: 560 }}>Keep all your existing supplier accounts. Dentago connects to them and pulls your real prices — so you can compare and order without switching portals.</p>
      </section>

      {/* Supplier grid */}
      <section style={{ padding: "60px 32px 120px", background: "#fff" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {SUPPLIERS.map(sup => (
              <div key={sup.name} className="sup-card" style={{ background: "#fff", border: "1px solid rgba(14,15,18,0.08)", borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", gap: 16, transition: "transform 0.2s, box-shadow 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: sup.status === "Connected" ? "rgba(58,46,110,0.08)" : "#f7f6f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Instrument Serif', serif", fontSize: 20, fontStyle: "italic", color: sup.color }}>
                    {sup.name[0]}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: sup.status === "Connected" ? "rgba(31,111,92,0.1)" : "rgba(14,15,18,0.06)", color: sup.status === "Connected" ? "#1f6f5c" : "#5b606b", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>{sup.status}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 17, color: "#0e0f12" }}>{sup.name}</div>
                  <div style={{ fontSize: 13, color: "#5b606b", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{sup.products} products</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How connecting works */}
      <section style={{ padding: "80px 32px 120px", background: "#f7f6f4" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <span className="eyebrow-bar" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e", fontWeight: 500 }}>How it works</span>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.0, margin: "18px 0 64px", color: "#15151a" }}>
            Connected in <em style={{ fontStyle: "italic", color: "#3a2e6e" }}>4 minutes</em>.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, borderTop: "1px solid rgba(14,15,18,0.08)" }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ padding: "28px 32px 0 0", borderRight: i < 2 ? "1px solid rgba(14,15,18,0.08)" : "none" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#3a2e6e", fontWeight: 500, letterSpacing: "0.08em" }}>/ {step.n}</div>
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 28, lineHeight: 1.15, margin: "14px 0 0", color: "#15151a" }}>{step.title}</h3>
                <p style={{ margin: "14px 0 0", fontSize: 15, color: "#3a3b40", lineHeight: 1.55 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 32px", background: "#0e0f12", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "clamp(36px,5vw,64px)", color: "#fff", margin: 0 }}>
          Connect your first supplier in <em style={{ fontStyle: "italic", color: "#c5b8e8" }}>4 minutes</em>.
        </h2>
        <div style={{ marginTop: 36 }}>
          <Link href="/signup" style={{ background: "#fff", color: "#0e0f12", padding: "16px 28px", borderRadius: 999, fontSize: 15, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10 }}>Get started free</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
