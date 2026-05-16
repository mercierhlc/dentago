"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { homeProTierHref } from "@/lib/platform-pro-hashes";
import { stashPlatformNavHash } from "@/lib/platform-hash-scroll";
import { MARKETPLACE_HREF_FROM_MARKETING } from "@/lib/site-layout";

const LOGOS = [
  "Henry Schein", "DD Group", "Kent Express", "Dental Sky", "Wrights", "DHB",
];

const DEALS = [
  { icon: "S", ic: "", product: "Septanest 4% Articaine 1:100,000", strike: "£32.75", price: "£29.77 · Dental Sky", save: "−£2.98", lg: false },
  { icon: "N", ic: " g", product: "Nitrile Exam Gloves · M · 200ct", strike: "£14.20", price: "£9.45 · Wrights", save: "−£4.75", lg: false },
  { icon: "B", ic: " o", product: "Bond Universal · 5ml", strike: "£64.00", price: "£48.10 · DHB", save: "−£15.90", lg: true },
  { icon: "I", ic: " p", product: "Impression Tray · upper · pkt 50", strike: "£22.40", price: "£17.80 · Kent Express", save: "−£4.60", lg: false },
];

const FREE_TIER = [
  "Unified Marketplace", "Live price comparison", "One cart, every supplier", "Favourites & reorder",
  "Order history", "Delivery tracking", "Stockroom QR requests", "Mobile ordering",
];

const PRO_TIER = [
  "Procurement Hub", "Predictive par alerts", "Auto-reorder drafts", "Approval queue",
  "Stock + expiry tracking", "Spend analytics", "Budget ceilings", "Consolidated invoice",
  "AI purchasing assistant", "Treatment-to-stock mapping", "Multi-clinic management", "Accounting integrations",
];

export default function DentagoMarketingLanding() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    else searchInputRef.current?.focus();
  }

  useEffect(() => {
    const nodes = document.querySelectorAll(".dentago-marketing-root .reveal");
    if (!nodes.length || typeof IntersectionObserver === "undefined") {
      nodes.forEach((el) => el.classList.add("in"));
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
      { rootMargin: "-40px", threshold: 0.05 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div className="dentago-marketing-root">
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-left">
            <span className="live-pulse">
              <span className="pulse-dot" />
              LIVE · Live prices from every UK dental supplier
            </span>
            <h1 className="headline">
              One tab.
              <br />
              <span className="ital">Every</span> supplier.
            </h1>
            <p className="hero-sub">
              Search every UK dental supplier in one place. See your real prices, place one order, and stop juggling six browser tabs every Monday morning.
            </p>
            <form onSubmit={handleSearch} className="hero-search-form">
              <div className="hero-search-wrap">
                <span className="hero-search-icon material-symbols-outlined">search</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search gloves, composite, impression material…"
                  className="hero-search-input"
                />
                <button type="submit" className="hero-search-btn">Search</button>
              </div>
            </form>
            <div className="hero-cta">
              <Link href="/signup" className="btn-hero">
                Start free <span className="arr">→</span>
              </Link>
              <Link href="/demo" className="btn btn-light">
                Book a demo
              </Link>
            </div>
            <div className="trust">
              <span>No card required</span>
              <span className="sep" />
              <span>Connect your account in 4 mins</span>
              <span className="sep" />
              <span>Free forever</span>
            </div>
          </div>
          <div className="hero-right">
            <div className="deal-feed">
              <div className="feed-head">
                <span>Live deals · last 60s</span>
                <span className="live-tag">
                  <span className="d" />
                  STREAMING
                </span>
              </div>
              {DEALS.map((d, i) => (
                <div key={i} className="deal-card" style={{ animationDelay: `${i * 0.06}s` }}>
                  <span className={`deal-icon${d.ic}`}>{d.icon}</span>
                  <div className="deal-text">
                    <span className="product">{d.product}</span>
                    <span className="meta">
                      <span className="strike">{d.strike}</span>
                      {d.price}
                    </span>
                  </div>
                  <span className={`deal-save${d.lg ? " lg" : ""}`}>{d.save}</span>
                </div>
              ))}
            </div>
            <div className="savings-card">
              <div className="savings-head">
                <span className="clinic">
                  <span className="av">Q</span>
                  Your clinic · this quarter
                </span>
                <span>Saved vs best price</span>
              </div>
              <div className="savings-num">
                £<em>—</em>
              </div>
              <div className="savings-sub">
                Connect your supplier accounts to see your real savings
              </div>
              <div className="savings-bar-row">
                <div className="sb-line">
                  <div className="l">
                    <span>Consumables</span>
                    <span className="pct">£2,140</span>
                  </div>
                  <div className="sb-track">
                    <i style={{ width: "78%" }} />
                  </div>
                </div>
                <div className="sb-line">
                  <div className="l">
                    <span>Impression / lab</span>
                    <span className="pct">£1,210</span>
                  </div>
                  <div className="sb-track">
                    <i className="t" style={{ width: "52%" }} />
                  </div>
                </div>
                <div className="sb-line">
                  <div className="l">
                    <span>PPE &amp; infection</span>
                    <span className="pct">£862</span>
                  </div>
                  <div className="sb-track">
                    <i className="r" style={{ width: "34%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="widget-row">
          <div className="widget w1 reveal">
            <span className="w-tag">Search</span>
            <div className="w-title">Find any product, every supplier.</div>
            <div className="search-mock">
              <span className="q">composite syringe</span>
              <span style={{ marginLeft: "auto", opacity: 0.5 }}>⌘K</span>
            </div>
            <div className="price-rows">
              <div className="price-row">
                <span>Dental Directory</span>
                <span className="pr">
                  £29.77 <span className="pill-best">BEST</span>
                </span>
              </div>
              <div className="price-row">
                <span>Henry Schein</span>
                <span className="pr">£32.10</span>
              </div>
              <div className="price-row">
                <span>Wrights</span>
                <span className="pr">£33.50</span>
              </div>
            </div>
          </div>
          <div className="widget w2 reveal d1">
            <span className="w-tag">One cart</span>
            <div className="w-title">Six suppliers, one order.</div>
            <div className="cart-stack">
              <div className="cart-item">
                <span>Septanest 1:100k × 2</span>
                <span className="src">DD</span>
              </div>
              <div className="cart-item">
                <span>Nitrile gloves M × 4</span>
                <span className="src">WR</span>
              </div>
              <div className="cart-item">
                <span>Composite A2 × 6</span>
                <span className="src">HS</span>
              </div>
              <div className="cart-item">
                <span>Trays upper × 1</span>
                <span className="src">KE</span>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#2a2b30" }}>
              <span>Cart total</span>
              <span className="mono" style={{ fontWeight: 600 }}>
                £412.80
              </span>
            </div>
          </div>
          <div className="widget w3 reveal d2">
            <span className="w-tag">Spend</span>
            <div className="w-title">See where the £ go.</div>
            <div className="chart">
              <div className="bar" style={{ height: "30%" }} />
              <div className="bar" style={{ height: "50%" }} />
              <div className="bar hi" style={{ height: "70%" }} />
              <div className="bar" style={{ height: "55%" }} />
              <div className="bar hi" style={{ height: "88%" }} />
              <div className="bar" style={{ height: "62%" }} />
              <div className="bar hi" style={{ height: "75%" }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#2a2b30" }}>
              <span className="mono" style={{ fontWeight: 600 }}>
                Total spend
              </span>
              &nbsp;·&nbsp; this quarter
            </div>
          </div>
          <div className="widget w4 reveal d3">
            <span className="w-tag">Stock</span>
            <div className="w-title">Never run out, mid-procedure.</div>
            <div className="stock-list">
              <div className="stock-item">
                <div className="lbl">
                  <span>Composite A2</span>
                  <span className="mono">14</span>
                </div>
                <div className="stock-bar">
                  <i style={{ width: "70%" }} />
                </div>
              </div>
              <div className="stock-item">
                <div className="lbl">
                  <span>Anaesthetic</span>
                  <span className="mono">3</span>
                </div>
                <div className="stock-bar">
                  <i className="warn" style={{ width: "25%" }} />
                </div>
              </div>
              <div className="stock-item">
                <div className="lbl">
                  <span>Nitrile gloves M</span>
                  <span className="mono">1</span>
                </div>
                <div className="stock-bar">
                  <i className="crit" style={{ width: "10%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="logos">
        <h2>Connected to every major UK dental supplier</h2>
        <div className="logo-marquee marquee">
          <div className="marquee-track">
            {[...LOGOS, ...LOGOS].map((name, i) => (
              <span key={`${name}-${i}`} className="logo-item">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="problem">
        <div className="sec-inner">
          <span className="eyebrow">The problem</span>
          <h2 className="reveal">
            A typical UK clinic juggles <em>multiple supplier tabs</em>, separate logins, and a WhatsApp full of nurse requests — every single Monday morning.
          </h2>
          <div className="stat-row">
            <div className="stat reveal">
              <div className="num">
                <em>5+</em>
              </div>
              <div className="lbl">
                supplier sites open
                <br />
                during a single order
              </div>
            </div>
            <div className="stat reveal d1">
              <div className="num">
                <em>Hours</em>
              </div>
              <div className="lbl">
                lost each week to
                <br />
                procurement admin
              </div>
            </div>
            <div className="stat reveal d2">
              <div className="num">
                <em>Missed</em>
              </div>
              <div className="lbl">
                savings from not comparing
                <br />
                prices across suppliers
              </div>
            </div>
            <div className="stat reveal d3">
              <div className="num">
                <em>Free</em>
              </div>
              <div className="lbl">
                for every clinic
                <br />
                no card required
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tiers">
        <div className="sec-inner">
          <span className="eyebrow">Two products, one workspace</span>
          <h2 className="big">
            Start <em>free</em>. Scale into <em>full automation</em>.
          </h2>
          <p className="lead">
            Dentago is procurement first — free for every clinic. When you&apos;re ready to automate stock, requests, approvals and analytics, Pro lights up the full workflow on top.
          </p>
          <div className="tier-grid">
            <div className="tier free reveal">
              <span className="price-tag">Free forever · Procurement</span>
              <h3>
                Buy smarter, in <em>one tab</em>.
              </h3>
              <p className="sub">Replace six supplier websites with one Marketplace. Real prices, one cart, one history.</p>
              <ul>
                {FREE_TIER.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <div className="cta-row">
                <span className="price">
                  Free<small>· no card needed</small>
                </span>
                <Link href={MARKETPLACE_HREF_FROM_MARKETING} className="btn btn-dark" style={{ marginLeft: "auto" }}>
                  Open Marketplace <span className="arr">→</span>
                </Link>
              </div>
            </div>
            <div className="tier pro reveal d1">
              <span className="price-tag">Dentago Pro · £299/mo</span>
              <h3>
                The clinic&apos;s <em>command centre</em>.
              </h3>
              <p className="sub">
                21 features that eliminate stockouts, manual reordering, invoice chaos and the monthly &quot;what did we actually spend&quot; question.
              </p>
              <ul>
                {PRO_TIER.map((t) => {
                  const href = homeProTierHref(t);
                  const isDeep = href.includes("#");
                  return (
                    <li key={t}>
                      {isDeep ? (
                        <Link
                          href={href}
                          className="pro-tier-link"
                          onClick={(e) => {
                            if (!href.startsWith("/platform#")) return;
                            e.preventDefault();
                            stashPlatformNavHash(href);
                            router.push("/platform");
                          }}
                        >
                          {t}
                        </Link>
                      ) : (
                        t
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="cta-row">
                <span className="price">
                  £299<small>/mo · per practice</small>
                </span>
                <Link href="/platform" className="btn btn-light" style={{ marginLeft: "auto" }}>
                  Explore Pro <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="sec-inner">
          <span className="eyebrow">Inside the Marketplace</span>
          <h2 className="big">
            Same product. <em>Cheaper supplier.</em>
            <br />
            Surfaced before you click buy.
          </h2>
          <p className="lead">
            Every search compares your account prices across your connected suppliers — Henry Schein, DHB, DD Group, Kent Express, Dental Sky, and Wrights.
          </p>
          <div className="features-grid">
            <div className="f-card reveal">
              <span className="f-tag">Search</span>
              <h3>
                One search box, <em>six suppliers</em>.
              </h3>
              <p>Type a brand, an SKU, or &quot;composite syringe a2.&quot; We surface every connected supplier&apos;s price, in stock, with delivery time — sorted by what&apos;s actually cheapest for you today.</p>
              <div className="compare-card">
                <div className="compare-search">
                  <span className="glass" />
                  <span style={{ fontWeight: 500 }}>Septanest 4% Articaine</span>
                  <span style={{ marginLeft: "auto", color: "#5b606b" }}>6 suppliers</span>
                </div>
                <div className="compare-rows">
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-best" />
                      Dental Sky
                    </span>
                    <span className="price">
                      £29.77 <span className="pill-best">BEST</span>
                    </span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-mid" />
                      DHB
                    </span>
                    <span className="price">£30.10</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-mid" />
                      DD Group
                    </span>
                    <span className="price">£30.45</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-mid" />
                      Henry Schein
                    </span>
                    <span className="price">£31.20</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-mid" />
                      Wrights
                    </span>
                    <span className="price">£32.75</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-hi" />
                      Kent Express
                    </span>
                    <span className="price">£35.13</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="f-card reveal d1">
              <span className="f-tag">Cart</span>
              <h3>
                Build one basket. <em>Place one order.</em>
              </h3>
              <p>Add items from any supplier into a single cart. Hit checkout once — Dentago routes each line to the right supplier, with the right account, at the right price.</p>
              <div className="compare-card" style={{ background: "linear-gradient(180deg,#eaeef2,#dde2ea)" }}>
                <div className="compare-rows">
                  <div className="compare-row">
                    <span className="sup-name">Septanest × 2</span>
                    <span className="price">DD · £59.54</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">Nitrile gloves M × 4</span>
                    <span className="price">WR · £37.80</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">Composite A2 × 6</span>
                    <span className="price">HS · £148.20</span>
                  </div>
                  <div className="compare-row" style={{ background: "#15151a", color: "#fff" }}>
                    <span className="sup-name">Total · 4 suppliers</span>
                    <span className="price">£412.80</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="f-card reveal d2">
              <span className="f-tag">Favourites</span>
              <h3>
                Reorder your <em>weekly basket</em> in one tap.
              </h3>
              <p>Save anything you order regularly. Dentago remembers your preferred supplier — or auto-switches if a cheaper one appears.</p>
              <div className="compare-card" style={{ background: "linear-gradient(180deg,#f0e8d8,#e4d8c0)" }}>
                <div className="compare-rows">
                  <div className="compare-row">
                    <span className="sup-name">★ Mon basket</span>
                    <span className="price">12 items · £318</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">★ Hygienist re-stock</span>
                    <span className="price">7 items · £142</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">★ PPE monthly</span>
                    <span className="price">5 items · £88</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="f-card reveal d3">
              <span className="f-tag">Tracking</span>
              <h3>
                Every delivery, <em>one timeline</em>.
              </h3>
              <p>See what&apos;s shipped, what&apos;s late, and what arrived short — across every supplier you ordered from this week.</p>
              <div className="compare-card" style={{ background: "linear-gradient(180deg,#e8e0f0,#d8cce8)" }}>
                <div className="compare-rows">
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-best" />
                      DD · #44182
                    </span>
                    <span className="price">Delivered · 2d</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-best" />
                      HS · #88012
                    </span>
                    <span className="price">Out for delivery</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-mid" />
                      WR · #20741
                    </span>
                    <span className="price">Delayed · ETA Thu</span>
                  </div>
                  <div className="compare-row">
                    <span className="sup-name">
                      <span className="dot d-best" />
                      KE · #51209
                    </span>
                    <span className="price">In transit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-final">
        <h2>
          Replace six tabs with <em>one</em>.
        </h2>
        <p className="sub">Free forever. Connect your existing supplier accounts in under four minutes — your prices stay yours.</p>
        <Link href="/signup" className="btn-hero">
          Start free <span className="arr">→</span>
        </Link>
      </section>
    </div>
  );
}
