import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";

const CASE_STUDIES = [
  {
    clinic: "Marylebone & Co",
    location: "London W1",
    savings: "£4,212",
    period: "this quarter",
    saving_pct: "14.6%",
    orders: 87,
    description: "A 3-chair independent practice in central London. Connected Henry Schein, Kent Express and Dental Sky. Found £4,212 in savings across 87 orders in their first quarter on Dentago.",
    gradient: "linear-gradient(160deg,#f5d4c7,#ead8c8)",
  },
  {
    clinic: "Clifton Dental Studio",
    location: "Bristol",
    savings: "£3,140",
    period: "last 90 days",
    saving_pct: "11.2%",
    orders: 64,
    description: "A multi-chair private practice in Bristol. Used Dentago's spend analytics to identify £3,140 in avoidable overspend across 4 supplier accounts in 90 days.",
    gradient: "linear-gradient(160deg,#d8e8d8,#c8d8c8)",
  },
  {
    clinic: "Highbury Implants",
    location: "London N5",
    savings: "£6,840",
    period: "6 months",
    saving_pct: "18.4%",
    orders: 142,
    description: "A specialist implant clinic with high-value consumable spend. Dentago's price comparison surfaced £6,840 in savings over 6 months — mostly on impression materials and surgical kits.",
    gradient: "linear-gradient(160deg,#e0d8f0,#d0c8e4)",
  },
];

const TESTIMONIALS = [
  { quote: "I'd been ordering the 100-pack for three years and never noticed the 200-pack worked out £1.50 cheaper per hundred. Dentago found it in about three seconds.", name: "Sarah Whitfield", role: "Practice Manager, Marylebone & Co Dental" },
  { quote: "We were spending an hour every Monday just logging into supplier portals. Now it's one screen, one cart. I genuinely don't know why we didn't have this sooner.", name: "James Clifton", role: "Practice Owner, Clifton Dental Studio" },
  { quote: "The par-level alerts alone are worth it. We used to run out of impression material mid-week at least once a month. That hasn't happened since we switched.", name: "Priya Sharma", role: "Dental Director, Highbury Implants" },
];

export default function CustomersPage() {
  return (
    <>
      <style>{`
        .cust-eyebrow::before {
          content: "";
          display: inline-block;
          width: 18px;
          height: 1px;
          background: #3a2e6e;
          margin-right: 8px;
          vertical-align: middle;
        }
        .cust-hero {
          padding: calc(var(--dentago-announce-px, 43px) + 58px + 56px) 32px 72px;
          background: linear-gradient(180deg, #f7f6f4, #fff);
          text-align: center;
        }
        .cust-hero h1 {
          font-family: 'Instrument Serif', serif;
          font-weight: 400;
          font-size: clamp(36px, 6vw, 80px);
          line-height: 0.95;
          letter-spacing: -0.025em;
          margin: 18px auto 0;
          max-width: 1000px;
          color: #15151a;
        }
        .cust-hero p {
          font-size: 18px;
          color: #3a3b40;
          line-height: 1.5;
          margin: 22px auto 0;
          max-width: 560px;
        }
        .cust-cases {
          padding: 40px 32px 80px;
          background: #fff;
        }
        .cust-cases-grid {
          max-width: 1320px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .cust-card {
          background: #fff;
          border: 1px solid rgba(14,15,18,0.08);
          border-radius: 28px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .cust-card-top {
          padding: 28px 24px;
        }
        .cust-card-clinic {
          font-family: 'Instrument Serif', serif;
          font-size: 22px;
          color: #15151a;
          font-weight: 400;
        }
        .cust-card-loc {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #5b606b;
          margin-top: 4px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .cust-card-savings {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(36px, 5vw, 52px);
          line-height: 1;
          color: #15151a;
          margin-top: 18px;
        }
        .cust-card-meta {
          font-size: 13px;
          color: #3a3b40;
          margin-top: 6px;
        }
        .cust-card-meta span {
          font-family: 'JetBrains Mono', monospace;
          color: #1f6f5c;
          font-weight: 600;
        }
        .cust-card-body {
          padding: 24px;
          flex-grow: 1;
        }
        .cust-card-body p {
          font-size: 14px;
          line-height: 1.6;
          color: #3a3b40;
          margin: 0;
        }
        .cust-card-orders {
          margin-top: 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #5b606b;
          letter-spacing: 0.06em;
        }
        .cust-testimonials {
          padding: 80px 32px 100px;
          background: linear-gradient(180deg, #f5e8da 0%, #e8d5e0 100%);
        }
        .cust-testimonials h2 {
          font-family: 'Instrument Serif', serif;
          font-weight: 400;
          font-size: clamp(32px, 5vw, 60px);
          line-height: 1.0;
          margin: 18px 0 56px;
          color: #15151a;
        }
        .cust-testimonials h2 em { font-style: italic; color: #3a2e6e; }
        .cust-testi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .cust-testi-card {
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.8);
          border-radius: 24px;
          padding: 28px;
        }
        .cust-testi-quote-mark {
          font-family: 'Instrument Serif', serif;
          font-size: 44px;
          line-height: 1;
          color: #3a2e6e;
        }
        .cust-testi-card blockquote {
          font-family: 'Instrument Serif', serif;
          font-weight: 400;
          font-size: clamp(16px, 2.2vw, 20px);
          line-height: 1.45;
          color: #15151a;
          margin: 6px 0 0;
        }
        .cust-testi-byline {
          margin-top: 20px;
          font-size: 13px;
          color: #3a3b40;
        }
        .cust-testi-byline strong { font-weight: 600; color: #15151a; }
        .cust-testi-byline span { color: #5b606b; }
        .cust-cta {
          padding: 80px 20px;
          background: #0e0f12;
          text-align: center;
        }
        .cust-cta h2 {
          font-family: 'Instrument Serif', serif;
          font-weight: 400;
          font-size: clamp(32px, 5vw, 64px);
          color: #fff;
          margin: 0;
        }
        .cust-cta h2 em { font-style: italic; color: #c5b8e8; }
        .cust-cta-btns {
          margin-top: 36px;
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .cust-cta-btns a {
          padding: 15px 28px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 500;
          text-decoration: none;
          display: inline-block;
        }
        .cust-btn-primary { background: #fff; color: #0e0f12; }
        .cust-btn-ghost { color: #fff; border: 1px solid rgba(255,255,255,0.25); }

        @media (max-width: 900px) {
          .cust-cases-grid { grid-template-columns: 1fr; max-width: 560px; }
          .cust-testi-grid { grid-template-columns: 1fr; max-width: 560px; }
        }
        @media (max-width: 640px) {
          .cust-hero { padding: calc(var(--dentago-announce-px, 43px) + 58px + 24px) 20px 48px; }
          .cust-hero p { font-size: 16px; }
          .cust-cases { padding: 28px 20px 56px; }
          .cust-testimonials { padding: 56px 20px 72px; }
          .cust-testimonials h2 { margin-bottom: 36px; }
          .cust-cta { padding: 56px 20px; }
          .cust-cta-btns { flex-direction: column; align-items: center; }
          .cust-cta-btns a { width: 100%; max-width: 320px; text-align: center; }
        }
      `}</style>

      <Navbar />

      {/* Hero */}
      <section className="cust-hero">
        <span className="cust-eyebrow" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e", fontWeight: 500, display: "inline-flex", alignItems: "center" }}>
          Customers
        </span>
        <h1>
          Trusted by UK practices from <em>London to Edinburgh</em>
        </h1>
        <p>From single-chair independents to multi-site groups. Real savings. Real practices.</p>
      </section>

      {/* Case studies */}
      <section className="cust-cases">
        <div className="cust-cases-grid">
          {CASE_STUDIES.map(cs => (
            <div key={cs.clinic} className="cust-card">
              <div className="cust-card-top" style={{ background: cs.gradient }}>
                <div className="cust-card-clinic">{cs.clinic}</div>
                <div className="cust-card-loc">{cs.location}</div>
                <div style={{ marginTop: 18 }}>
                  <div className="cust-card-savings">{cs.savings}</div>
                  <div className="cust-card-meta">
                    saved {cs.period} · <span>↓ {cs.saving_pct} spend</span>
                  </div>
                </div>
              </div>
              <div className="cust-card-body">
                <p>{cs.description}</p>
                <div className="cust-card-orders">{cs.orders} orders placed</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="cust-testimonials">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <span className="cust-eyebrow" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a2e6e", fontWeight: 500 }}>
            What they say
          </span>
          <h2>
            From the <em>practice managers</em>.
          </h2>
          <div className="cust-testi-grid">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="cust-testi-card">
                <div className="cust-testi-quote-mark">&ldquo;</div>
                <blockquote>{t.quote}</blockquote>
                <div className="cust-testi-byline">
                  <strong>{t.name}</strong>
                  <br />
                  <span>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cust-cta">
        <h2>Join them. It&apos;s <em>free</em>.</h2>
        <div className="cust-cta-btns">
          <Link href="/signup" className="cust-btn-primary">Open your free tab</Link>
          <Link href="/demo" className="cust-btn-ghost">Book a demo</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
