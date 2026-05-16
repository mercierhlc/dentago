"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import ProfileMenu from "@/components/ProfileMenu";
import { DentagoLogo } from "@/components/DentagoLogo";
import { getClinic } from "@/lib/auth";
import { platformProHref, PLATFORM_FEATURED_PREDICTIVE_PAR_HASH } from "@/lib/platform-pro-hashes";
import { dispatchPlatformHashNav, stashPlatformNavHash } from "@/lib/platform-hash-scroll";
import { MARKETPLACE_HREF_FROM_MARKETING, SITE_ANNOUNCE_BAR_HEIGHT_PX, SITE_NAV_BAR_HEIGHT_PX } from "@/lib/site-layout";

type Clinic = { id: string; clinic_name: string; email: string };

interface NavbarProps {
  searchSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  transparent?: boolean;
}

const CLOSE_DELAY = 180;

function Arr() {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14, background: "currentColor", flexShrink: 0,
      WebkitMask: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'><path d='M5 12h14M13 6l6 6-6 6'/></svg>") center/contain no-repeat`,
      mask: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'><path d='M5 12h14M13 6l6 6-6 6'/></svg>") center/contain no-repeat`,
    }} />
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{ opacity: 0.5, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>
      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Mega menu content ──────────────────────────────────────────────────── */

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5b606b", margin: "0 0 18px" };

function MegaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ display: "block", padding: "10px 14px", margin: "0 -14px", borderRadius: 10, fontSize: 14.5, fontWeight: 500, color: "#1a1c20", textDecoration: "none", transition: "background 0.15s, color 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#f7f6f4"; e.currentTarget.style.color = "#3a2e6e"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#1a1c20"; }}>
      {children}
    </Link>
  );
}

function FeaturedCard({
  label,
  title,
  href,
  onNavigate,
  onPlatformHashClick,
}: {
  label: string;
  title: string;
  href: string;
  onNavigate?: () => void;
  onPlatformHashClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        onPlatformHashClick?.(e);
        onNavigate?.();
      }}
      style={{ display: "block", background: "linear-gradient(160deg,#efe6d8,#e8d5e0)", borderRadius: 16, padding: 20, textDecoration: "none" }}>
      <div style={MONO}>{label}</div>
      <h5 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 22, lineHeight: 1.15, fontWeight: 400, letterSpacing: "-0.01em", margin: "14px 0 0", color: "#0e0f12" }}>{title}</h5>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 13, fontWeight: 500, color: "#3a2e6e" }}>Read more →</div>
    </Link>
  );
}

function MegaPlatform({
  onNavigate,
  onPlatformHashClick,
}: {
  onNavigate?: () => void;
  onPlatformHashClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1fr", gap: 36 }}>
      <div>
        <h4 style={MONO}>Free · Procurement</h4>
        {[
          { ic: "M", label: "Marketplace", desc: "Search every UK supplier in one place. See your real prices side-by-side.", href: MARKETPLACE_HREF_FROM_MARKETING },
          { ic: "C", label: "Unified Cart", desc: "One basket, every supplier. One checkout, every order.", href: MARKETPLACE_HREF_FROM_MARKETING, cls: "t" },
          { ic: "F", label: "Favourites & Reorder", desc: "Save what you order most. Reorder in one tap at your best price.", href: "/clinic/favorites", cls: "p" },
        ].map(f => (
          <Link key={f.label} href={f.href} onClick={onNavigate} style={{ display: "block", padding: 14, borderRadius: 14, margin: "-2px 0", textDecoration: "none", color: "inherit", transition: "background 0.18s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f7f6f4")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600, color: "#0e0f12" }}>
              <span style={{
                width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600, fontFamily: "'Instrument Serif',serif", fontStyle: "italic",
                background: f.cls === "t" ? "#d6e9df" : f.cls === "p" ? "#f5e0e6" : "#e8e2f5",
                color: f.cls === "t" ? "#1f6f5c" : f.cls === "p" ? "#b04a72" : "#3a2e6e",
              }}>{f.ic}</span>
              {f.label}
            </div>
            <div style={{ fontSize: 13, color: "#5b606b", marginTop: 4, lineHeight: 1.4 }}>{f.desc}</div>
          </Link>
        ))}
      </div>
      <div>
        <h4 style={{ ...MONO, display: "flex", alignItems: "center", gap: 8, margin: "0 0 18px" }}>
          Pro · Automation
          <span style={{ background: "#e8e2f5", color: "#3a2e6e", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 999, fontFamily: "'Inter',sans-serif", textTransform: "uppercase" }}>£299/mo</span>
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
          {["Procurement Hub","Stock Tracking","Predictive Par","Auto-Reorder","Approval Queue","Spend Analytics","Budget Ceiling","Consolidated Invoice","Smart Order Gen","AI Assistant"].map((f) => (
            <Link
              key={f}
              href={platformProHref(f)}
              onClick={(e) => {
                onPlatformHashClick(e);
                onNavigate?.();
              }}
              style={{ display: "block", padding: "8px 12px", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600, color: "#0e0f12", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f7f6f4")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}>
              {f}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <h4 style={MONO}>Featured</h4>
        <FeaturedCard
          label="Now in beta"
          title="Predictive par alerts: know 4 days before you run out."
          href={`/platform#${PLATFORM_FEATURED_PREDICTIVE_PAR_HASH}`}
          onNavigate={onNavigate}
          onPlatformHashClick={onPlatformHashClick}
        />
      </div>
    </div>
  );
}

function MegaSolutions() {
  const byClinic: [string, string][] = [
    ["Single-site practices", "/solutions/single-site-practices"],
    ["Multi-site groups", "/solutions/multi-site-groups"],
    ["DSOs & corporates", "/solutions/dsos-corporates"],
    ["NHS practices", "/solutions/nhs-practices"],
    ["Specialist clinics", "/solutions/specialist-clinics"],
  ];
  const byRole: [string, string][] = [
    ["Practice managers", "/solutions/practice-managers"],
    ["Principal dentists", "/solutions/principal-dentists"],
    ["Group operations", "/solutions/group-operations"],
    ["Finance teams", "/solutions/finance-teams"],
  ];
  const byWorkflow: [string, string][] = [
    ["Daily ordering", "/solutions/daily-ordering"],
    ["Stockroom requests", "/solutions/stockroom-requests"],
    ["Monthly reconciliation", "/solutions/monthly-reconciliation"],
    ["Spend review", "/solutions/spend-review"],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: 36 }}>
      <div>
        <h4 style={MONO}>By clinic type</h4>
        {byClinic.map(([l, href]) => (
          <MegaLink key={l} href={href}>
            {l}
          </MegaLink>
        ))}
      </div>
      <div>
        <h4 style={MONO}>For roles</h4>
        {byRole.map(([l, href]) => (
          <MegaLink key={l} href={href}>
            {l}
          </MegaLink>
        ))}
      </div>
      <div>
        <h4 style={MONO}>For workflows</h4>
        {byWorkflow.map(([l, href]) => (
          <MegaLink key={l} href={href}>
            {l}
          </MegaLink>
        ))}
      </div>
      <div>
        <h4 style={MONO}>Featured</h4>
        <FeaturedCard label="Get started" title="Connect your supplier accounts in under 5 minutes." href="/signup" />
      </div>
    </div>
  );
}

function MegaResources() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: 36 }}>
      <div>
        <h4 style={MONO}>Explore</h4>
        {["Blog","Procurement playbook","Spend benchmark report","Newsletter"].map(l => <MegaLink key={l} href="/resources">{l}</MegaLink>)}
      </div>
      <div>
        <h4 style={MONO}>Get started</h4>
        {[["Talk to sales","/demo"],["Help center","/resources"],["Connect a supplier","/suppliers"],["Onboarding guide","/resources"]].map(([l,h]) => <MegaLink key={l} href={h}>{l}</MegaLink>)}
      </div>
      <div>
        <h4 style={MONO}>Customers</h4>
        {["Case studies","Testimonials"].map(l => <MegaLink key={l} href="/customers">{l}</MegaLink>)}
      </div>
      <div>
        <h4 style={MONO}>Featured</h4>
        <FeaturedCard label="2026 report" title="The state of UK dental procurement." href="/resources" />
      </div>
    </div>
  );
}

/* ─── MAIN NAVBAR ─────────────────────────────────────────────────────────── */

export default function Navbar({ searchSlot, rightSlot, transparent }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceRef = useRef<HTMLDivElement | null>(null);
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const [announcePx, setAnnouncePx] = useState(SITE_ANNOUNCE_BAR_HEIGHT_PX);
  const [chromeBottomPx, setChromeBottomPx] = useState(SITE_ANNOUNCE_BAR_HEIGHT_PX + SITE_NAV_BAR_HEIGHT_PX);

  useLayoutEffect(() => {
    const wrap = chromeRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      setChromeBottomPx(wrap.getBoundingClientRect().height);
      const ann = announceRef.current;
      if (ann) {
        const h = ann.getBoundingClientRect().height;
        setAnnouncePx(Math.max(SITE_ANNOUNCE_BAR_HEIGHT_PX, h));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--dentago-announce-px", `${announcePx}px`);
    return () => {
      document.documentElement.style.removeProperty("--dentago-announce-px");
    };
  }, [announcePx]);

  useEffect(() => {
    setClinic(getClinic());
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const openM = useCallback((id: string) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpenMenu(id);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), CLOSE_DELAY);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const onPlatformHashLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const href = e.currentTarget.getAttribute("href");
      if (!href?.startsWith("/platform#")) return;
      if (pathname === "/platform") {
        e.preventDefault();
        window.history.replaceState(null, "", href);
        dispatchPlatformHashNav(href.slice("/platform".length));
        return;
      }
      e.preventDefault();
      stashPlatformNavHash(href);
      router.push("/platform");
    },
    [pathname, router],
  );

  const isTransparent = transparent && !scrolled;

  const MENUS: Record<string, React.ReactNode> = {
    platform: (
      <MegaPlatform
        onNavigate={() => setOpenMenu(null)}
        onPlatformHashClick={onPlatformHashLinkClick}
      />
    ),
    solutions: <MegaSolutions />,
    resources: <MegaResources />,
  };

  const dropdowns = ["platform", "solutions"] as const;

  function NavPill({ id, label }: { id: string; label: string }) {
    return (
      <button
        onMouseEnter={() => openM(id)}
        onMouseLeave={scheduleClose}
        onClick={() => openMenu === id ? setOpenMenu(null) : openM(id)}
        aria-expanded={openMenu === id}
        style={{
          padding: "9px 18px", borderRadius: 999, fontSize: 14.5, fontWeight: 500, border: "none", fontFamily: "inherit", cursor: "pointer",
          color: isTransparent ? (openMenu === id ? "#0e0f12" : "rgba(255,255,255,0.9)") : "#1a1c20",
          background: openMenu === id ? "#fff" : "none",
          boxShadow: openMenu === id ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
          display: "inline-flex", alignItems: "center", gap: 6, transition: "background 0.2s",
        }}>
        {label} <Caret open={openMenu === id} />
      </button>
    );
  }

  function NavLinkPill({ href, label }: { href: string; label: string }) {
    const active = pathname === href;
    return (
      <Link href={href} style={{
        padding: "9px 18px", borderRadius: 999, fontSize: 14.5, fontWeight: 500,
        color: isTransparent ? "rgba(255,255,255,0.9)" : "#1a1c20",
        background: active ? "#fff" : "none",
        textDecoration: "none", transition: "background 0.2s",
      }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#fff"; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "none"; }}>
        {label}
      </Link>
    );
  }

  return (
    <>
      {/* Fixed chrome: announce + nav in one column so there is no `top: Npx` seam between strips */}
      <div
        ref={chromeRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <div ref={announceRef} className="announce shrink-0">
          <span className="dot" aria-hidden />
          <span>
            Every major UK dental supplier. One search, one order. —{" "}
            <Link href="/signup">Get started free →</Link>
          </span>
        </div>

        {/* Nav bar — flows directly under announce (same fixed stack; no top offset seam) */}
        <nav
          className="shrink-0"
          style={{
            position: "relative",
            background: isTransparent ? "transparent" : "rgba(255,255,255,0.85)",
            backdropFilter: isTransparent ? "none" : "blur(20px)",
            WebkitBackdropFilter: isTransparent ? "none" : "blur(20px)",
            borderBottom: isTransparent ? "1px solid transparent" : "1px solid rgba(14,15,18,0.08)",
            transition: "all 0.2s",
          }}>
        <div
          className="flex w-full max-w-[1320px] items-center gap-4 px-8 py-3 mx-auto md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4"
        >
          {/* Logo */}
          <Link
            href="/"
            style={{
              justifySelf: "start",
              display: "flex",
              alignItems: "center",
              color: isTransparent ? "#fff" : "#0e0f12",
              textDecoration: "none",
              flexShrink: 0,
              lineHeight: 1,
            }}
            aria-label="Dentago"
          >
            <DentagoLogo size={28} variant="brand" onDark={isTransparent} />
          </Link>

          {/* Center nav pill — centered in viewport on md+ */}
          {!searchSlot && (
            <div className="hidden md:flex" style={{ justifySelf: "center", alignItems: "center", gap: 2, background: isTransparent ? "rgba(255,255,255,0.15)" : "#f3f1ec", borderRadius: 999, padding: 5 }}>
              <NavPill id="platform" label="Platform" />
              <NavPill id="solutions" label="Solutions" />
              <NavLinkPill href={MARKETPLACE_HREF_FROM_MARKETING} label="Marketplace" />
              <NavPill id="resources" label="Resources" />
              <NavLinkPill href="/pricing" label="Pricing" />
            </div>
          )}

          {searchSlot && (
            <div className="min-w-0 md:justify-self-stretch md:max-w-[560px] md:mx-auto md:w-full" style={{ width: "100%" }}>
              {searchSlot}
            </div>
          )}

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", justifySelf: "end" }} className="md:ml-0">
            {rightSlot}
            {clinic ? (
              <ProfileMenu clinic={clinic} />
            ) : (
              <>
                <Link href="/login" className="hidden sm:inline-flex" style={{
                  alignItems: "center", fontSize: 14, fontWeight: 500, padding: "11px 18px",
                  borderRadius: 999, border: `1px solid ${isTransparent ? "rgba(255,255,255,0.3)" : "rgba(14,15,18,0.14)"}`,
                  color: isTransparent ? "#fff" : "#0e0f12", background: isTransparent ? "none" : "#fff", textDecoration: "none",
                }}>Sign in</Link>
                <Link href="/demo" style={{
                  display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500,
                  padding: "11px 18px", borderRadius: 999, flexShrink: 0,
                  background: isTransparent ? "#fff" : "#0e0f12",
                  color: isTransparent ? "#0e0f12" : "#fff", textDecoration: "none",
                }}>Get a demo <Arr /></Link>
              </>
            )}
            <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}
              style={{ padding: 6, borderRadius: 8, marginLeft: 4, color: isTransparent ? "rgba(255,255,255,0.7)" : "#5b606b", background: "none", border: "none", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileOpen ? <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></> : <><path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" /></>}
              </svg>
            </button>
          </div>
        </div>
      </nav>
      </div>

      {/* Mega backdrop */}
      {openMenu && (
        <div onClick={() => setOpenMenu(null)} style={{
          position: "fixed", inset: 0, background: "rgba(255,255,255,0.4)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          zIndex: 55, transition: "opacity 0.25s",
        }} />
      )}

      {/* Mega panels */}
      {Object.entries(MENUS).map(([id, content]) => (
        <div key={id}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: "fixed", left: "50%",
            transform: `translateX(-50%) translateY(${openMenu === id ? "0" : "-12px"})`,
            width: "min(1240px, calc(100vw - 48px))",
            background: "#fff", border: "1px solid rgba(14,15,18,0.08)", borderRadius: 24,
            boxShadow: "0 30px 60px -20px rgba(20,20,30,0.18), 0 8px 16px -8px rgba(20,20,30,0.06)",
            padding: "36px 40px 32px",
            opacity: openMenu === id ? 1 : 0,
            visibility: openMenu === id ? "visible" : "hidden",
            transition: "opacity 0.25s cubic-bezier(.2,.8,.2,1), transform 0.3s cubic-bezier(.2,.8,.2,1), visibility 0.3s",
            pointerEvents: openMenu === id ? "auto" : "none",
            zIndex: 62,
            top: chromeBottomPx,
          }}>
          {content}
        </div>
      ))}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="fixed left-0 right-0 border-b border-black/[0.08] shadow-xl"
            style={{
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px)",
              top: chromeBottomPx,
            }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 2 }}>
              {[["Marketplace", MARKETPLACE_HREF_FROM_MARKETING],["Platform","/platform"],["Solutions","/solutions"],["Pricing","/pricing"],["Resources","/resources"],["Customers","/customers"]].map(([label, href]) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                  style={{ display: "block", padding: "12px 16px", fontSize: 15, fontWeight: 500, color: "#1a1c20", borderRadius: 10, textDecoration: "none" }}>
                  {label}
                </Link>
              ))}
              <div style={{ borderTop: "1px solid rgba(14,15,18,0.06)", paddingTop: 12, marginTop: 8, display: "flex", gap: 10 }}>
                <Link href="/login" onClick={() => setMobileOpen(false)}
                  style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 500, color: "#0e0f12", padding: 12, borderRadius: 999, border: "1px solid rgba(14,15,18,0.14)", textDecoration: "none" }}>
                  Sign in
                </Link>
                <Link href="/demo" onClick={() => setMobileOpen(false)}
                  style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 500, color: "#fff", background: "#0e0f12", padding: 12, borderRadius: 999, textDecoration: "none" }}>
                  Get a demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
