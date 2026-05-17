"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";
import "@/styles/design-export/pricing.css";

const FAQS = [
  { q: "Is Marketplace really free, or is there a catch?", a: "It's free, forever, with no card required. We earn a small kickback from suppliers when you buy — never from you, and never on top of the price you see. Your account prices stay yours." },
  { q: "Do I keep my existing supplier accounts and pricing?", a: "Yes. Dentago authenticates against your existing supplier accounts and pulls your real prices — including any negotiated deals or PO pricing. We don't replace your relationships, we surface them." },
  { q: "How long does Pro take to set up?", a: "Most clinics are live in under an hour. Connect supplier accounts (4 min), import current stock from a CSV or our app (15 min), set par levels (auto-suggested), invite your team. We'll do it with you on a 30-min call if you'd like." },
  { q: "What does Pro cost for a multi-site group?", a: "£299/practice/month, with volume discounts at 5+ sites and group-level analytics included. We work with DSOs and corporates on enterprise terms — book a demo." },
  { q: "Can I cancel Pro any time?", a: "Yes — monthly rolling, cancel from your billing page. Your data stays yours and Marketplace continues to work for free. We'll export everything if you want to leave." },
  { q: "Is patient or treatment data ever exposed to suppliers?", a: "No. Suppliers only see purchase orders. PMS-derived treatment volume is used internally to predict stock burn and never leaves your tenant. Dentago is GDPR & ISO 27001 aligned." },
];

const TABLE_ROWS: [string, string, string, string, string][] = [
  ["", "Marketplace search · 8 suppliers", "", "check", "check"],
  ["", "Live price comparison", "", "check", "check"],
  ["", "Unified cart, multi-supplier checkout", "", "check", "check"],
  ["", "Favourites & reorder", "", "check", "check"],
  ["", "Order & delivery tracking", "", "check", "check"],
  ["", "Custom-pricing PO suppliers", "", "dash", "check"],
  ["", "Multi-clinic management", "", "dash", "check"],
  ["stock", "Stock + expiry tracking", "", "dash", "check"],
  ["stock", "Predictive par alerts", "", "dash", "check"],
  ["stock", "Auto-reorder drafts", "", "dash", "check"],
  ["stock", "Treatment-to-stock map (PMS)", "", "dash", "check"],
  ["stock", "Stockroom QR requests", "", "text", "check"],
  ["stock", "Lot & recall lookup", "", "dash", "check"],
  ["approvals", "Approval queue", "", "check", "check"],
  ["approvals", "Budget ceilings", "", "dash", "check"],
  ["approvals", "Role-based purchasing", "", "dash", "check"],
  ["approvals", "Audit trail · CQC-ready", "", "dash", "check"],
  ["insight", "Spend analytics", "", "check", "check"],
  ["insight", "AI assistant (plain-English Q&A)", "", "dash", "check"],
  ["insight", "Quarterly savings report", "", "dash", "check"],
  ["insight", "Industry benchmark", "", "dash", "check"],
  ["insight", "Forecast & cash plan", "", "dash", "check"],
  ["integrations", "Xero / QuickBooks / Sage", "", "dash", "check"],
  ["integrations", "PMS connectors (SOE, Dentally, iSmile)", "", "dash", "check"],
  ["integrations", "Users", "", "text2", "text3"],
  ["integrations", "Support", "", "text4", "text5"],
];

function tdFree(k: string) {
  const map: Record<string, ReactNode> = {
    check: <td className="check">●</td>,
    dash: <td className="dash">—</td>,
    text: <td className="check">basic</td>,
    text2: <td>2</td>,
    text4: <td>email · 24h</td>,
  };
  return map[k] ?? map.dash;
}

function tdPro(k: string) {
  const map: Record<string, ReactNode> = {
    check: <td className="check t">●</td>,
    dash: <td className="dash">—</td>,
    text: <td className="check t">advanced</td>,
    text3: <td className="check t">unlimited</td>,
    text5: <td className="check t">priority · 4h</td>,
  };
  return map[k] ?? map.dash;
}

const FREE_FEATURES = [
  "Unified Marketplace",
  "Live price compare",
  "One cart, every supplier",
  "Favourites & reorder",
  "Order history",
  "Delivery tracking",
  "Par levels & stock alerts",
  "Spend analytics",
  "Order approvals",
  "Stockroom QR requests",
  "Mobile ordering",
  "Up to 2 users",
  "Email support",
];

const PRO_FEATURES = [
  "Everything in free",
  "Procurement Hub",
  "Predictive par alerts",
  "Auto-reorder drafts",
  "Budget ceilings",
  "AI assistant",
  "Multi-clinic management",
  "Xero / Sage / QuickBooks",
  "Custom-pricing PO",
  "Unlimited users",
  "Priority support",
  "CQC audit export",
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const groups: Record<string, string> = {
    stock: "Stock automation",
    approvals: "Approvals",
    insight: "Insight",
    integrations: "Integrations & support",
  };

  let lastGroup = "";
  const rows: ReactNode[] = [];
  rows.push(
    <tr key="g-proc" className="group-row">
      <td colSpan={3}>Procurement</td>
    </tr>,
  );

  TABLE_ROWS.forEach(([group, feature, , free, pro], idx) => {
    if (group && group !== lastGroup) {
      lastGroup = group;
      rows.push(
        <tr key={`g-${group}`} className="group-row">
          <td colSpan={3}>{groups[group]}</td>
        </tr>,
      );
    }
    rows.push(
      <tr key={idx}>
        <td>{feature}</td>
        {tdFree(free)}
        {tdPro(pro)}
      </tr>,
    );
  });

  return (
    <>
      <Navbar />

      <div className="dentago-marketing-root">
        <section className="pri-hero">
          <span className="eyebrow">Pricing</span>
          <h1>
            Free to <em>buy</em>.
            <br />
            Paid to <em>automate</em>.
          </h1>
          <p>Marketplace is free for every UK clinic, forever. Pro is £299/month per practice and pays for itself in the first ordering cycle.</p>
        </section>

        <div className="pri-grid">
          <div className="pri-card">
            <span className="tag">Marketplace</span>
            <h2>
              Buy smarter, in <em>one tab</em>.
            </h2>
            <p className="sub">Replace six supplier websites with one. Real prices, one cart, one history — for every UK clinic.</p>
            <div className="pri-price">
              <span className="big">
                £<em>0</em>
              </span>
              <span className="pp">
                forever
                <br />
                no card needed
              </span>
            </div>
            <div className="cta">
              <Link href="/signup" className="btn btn-dark">
                Open Marketplace <span className="arr">→</span>
              </Link>
            </div>
            <ul>
              {FREE_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          <div className="pri-card dark">
            <span className="tag">Dentago Pro</span>
            <h2>
              Run the clinic on <em>autopilot</em>.
            </h2>
            <p className="sub">All 21 automation features. Predictive stock, auto-reorder, approvals, AI assistant, accounting integrations.</p>
            <div className="pri-price">
              <span className="big">
                £<em>299</em>
              </span>
              <span className="pp">
                per practice
                <br />
                per month
              </span>
            </div>
            <div className="cta">
              <Link href="/signup" className="btn btn-light">
                Get started free <span className="arr">→</span>
              </Link>
            </div>
            <ul>
              {PRO_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        <section className="compare">
          <div className="compare-inner">
            <span className="eyebrow">Compare</span>
            <h2>
              Every feature, <em>side-by-side</em>.
            </h2>
            <table className="ctab">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Free</th>
                  <th>Pro · £299</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        </section>

        <section className="faq">
          <div className="faq-inner">
            <span className="eyebrow">Common questions</span>
            <h2>
              What you ask <em>before signing up</em>.
            </h2>
            {FAQS.map((faq, i) => (
              <div
                key={faq.q}
                className={`q-item ${openFaq === i ? "open" : ""}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenFaq(openFaq === i ? null : i);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="q-head">
                  <span>{faq.q}</span>
                  <span className="pl" aria-hidden />
                </div>
                <div className="q-body">{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="pri-cta-final">
          <h2>
            Try Pro <em>free for 30 days</em>.
          </h2>
          <p>No card to start. We&apos;ll connect your suppliers, import your stock, and show you what you&apos;d save — before you ever pay us a penny.</p>
          <Link href="/signup" className="btn-hero">
            Start free trial <span className="arr">→</span>
          </Link>
        </section>
      </div>

      <Footer />
    </>
  );
}
