"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { clearAuth, getClinic, getFreshToken, type Clinic } from "@/lib/auth";
import type { ProUpgradeFeatureId } from "@/lib/pro-upgrade-content";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  proOnly?: boolean;
  /** In-app upsell when Free user taps a Pro row */
  proUpsellFeature?: ProUpgradeFeatureId;
};
type NavEntry = NavItem & { badge?: number };

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const SEARCH_ICON = <Icon d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />;
const CART_ICON = <Icon d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />;
const ORDERS_ICON = <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />;
const STAR_ICON = <Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />;
const START_ICON = <Icon d="M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />;
const GRID_ICON = <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />;
const BOX_ICON = <Icon d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4a2 2 0 001-1.73z" />;
const CHART_ICON = <Icon d="M18 20V10M12 20V4M6 20v-6" />;
const CHECK_ICON = <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />;
const ANALYTICS_ICON = <Icon d="M3 3v18h18M7 16l4-4 4 4 4-8" />;
const SETTINGS_ICON = <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />;
const LOGOUT_ICON = <Icon d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />;
const LOGIN_ICON = <Icon d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />;

/** Orientation + onboarding */
const OVERVIEW_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: GRID_ICON },
  { label: "Get started", href: "/dashboard/onboarding", icon: START_ICON },
];

/** Shop flow: discover → basket → history → saved */
const BUYING_ITEMS: NavItem[] = [
  { label: "Search", href: "/search", icon: SEARCH_ICON },
  { label: "Cart", href: "/cart", icon: CART_ICON },
  { label: "Orders", href: "/orders", icon: ORDERS_ICON },
  { label: "Favourites", href: "/clinic/favorites", icon: STAR_ICON },
];

/** Value first — inventory, approvals, and spend analytics are included on Free (operational wedge). */
const INSIGHTS_ITEMS: NavItem[] = [
  { label: "Savings", href: "/clinic/savings", icon: CHART_ICON },
  { label: "Inventory", href: "/clinic/par-levels", icon: BOX_ICON },
  { label: "Approvals", href: "/approvals", icon: CHECK_ICON },
  { label: "Analytics", href: "/clinic/analytics", icon: ANALYTICS_ICON },
];

const ACCOUNT_ITEMS: NavItem[] = [{ label: "Settings", href: "/settings", icon: SETTINGS_ICON }];

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {collapsed ? (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M10 9l3 3-3 3M14 12h5" />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M14 9l-3 3 3 3M10 12H5" />
        </>
      )}
    </svg>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)]">{label}</div>
  );
}

function NavItemRow({
  item,
  active,
  collapsed,
  locked,
  onboardingLocked,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  locked: boolean;
  onboardingLocked?: boolean;
}) {
  const href = locked
    ? onboardingLocked
      ? "/dashboard/onboarding"
      : `/upgrade?f=${encodeURIComponent(item.proUpsellFeature ?? "default")}&from=sidebar`
    : item.href;
  const title =
    collapsed
      ? `${item.label}${locked ? (onboardingLocked ? " — Complete setup first" : " — Dentago Pro") : ""}`
      : locked
      ? onboardingLocked
        ? `${item.label} — complete setup to unlock`
        : `${item.label} (requires Dentago Pro)`
      : undefined;

  return (
    <Link
      href={href}
      title={title}
      className={`group flex items-center rounded-xl text-[13px] font-medium transition-colors ${
        collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2"
      } ${
        active && !locked
          ? "bg-[rgba(17,17,17,0.08)] text-[var(--dc-text,#0f172a)] shadow-[inset_0_0_0_1px_rgba(17,17,17,0.18)]"
          : "text-[var(--dc-muted,#64748b)] hover:bg-black/[0.04] hover:text-[var(--dc-text,#0f172a)]"
      } ${locked ? "opacity-[0.88]" : ""}`}
    >
      {!collapsed ? (
          <span
          className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors ${
            active && !locked ? "bg-[var(--dc-accent-strong,#111111)]" : "bg-neutral-400 group-hover:bg-[var(--dc-muted)]"
          }`}
          aria-hidden
        />
      ) : null}
      <span
        className={`flex-shrink-0 relative inline-flex ${
          active && !locked ? "text-[var(--dc-accent-strong,#111111)]" : "text-[var(--dc-muted,#64748b)] group-hover:text-[var(--dc-text)]"
        }`}
      >
        {item.icon}
        {locked && collapsed ? (
          onboardingLocked ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-slate-400 text-white text-[7px] font-black flex items-center justify-center leading-none">
              🔒
            </span>
          ) : (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-[var(--dc-accent-strong,#111111)] text-white text-[7px] font-black flex items-center justify-center leading-none">
              P
            </span>
          )
        ) : null}
      </span>
      {!collapsed && (
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <span className="truncate">{item.label}</span>
          {locked ? (
            onboardingLocked ? (
              <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0 border border-slate-200">
                Setup
              </span>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--dc-accent,#c3b1e1)] bg-[rgba(195,177,225,0.12)] px-1.5 py-0.5 rounded-md shrink-0 border border-[rgba(195,177,225,0.2)]">
                Pro
              </span>
            )
          ) : null}
        </span>
      )}
    </Link>
  );
}

export default function ProSidebar({
  pendingRequests = 0,
  collapsed,
  onToggleCollapsed,
}: {
  pendingRequests?: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [firstOrderPlaced, setFirstOrderPlaced] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Mirrors `dentago_token` / Supabase session — search page uses this for CTAs; sidebar must match */
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tok = await getFreshToken();
      if (cancelled) return;
      if (!tok) {
        setHasSession(false);
        setClinic(null);
        setPlan("free");
        return;
      }
      let res: Response;
      try {
        res = await fetch("/api/clinic/me", { headers: { Authorization: `Bearer ${tok}` } });
      } catch {
        // Network error (dev server restart, offline) — keep existing state
        return;
      }
      if (cancelled) return;
      if (res.status === 401) {
        await clearAuth();
        setHasSession(false);
        setClinic(null);
        setPlan("free");
        return;
      }
      setHasSession(true);
      if (res.ok) {
        const body = (await res.json()) as { clinic?: Clinic };
        if (body.clinic) {
          setClinic(body.clinic);
          setPlan(body.clinic.product_plan === "pro" ? "pro" : "free");
        } else {
          const c = getClinic();
          setClinic(c);
          setPlan(c?.product_plan === "pro" ? "pro" : "free");
        }
      } else {
        const c = getClinic();
        setClinic(c);
        setPlan(c?.product_plan === "pro" ? "pro" : "free");
      }
      // Lock insights until supplier is connected
      try {
        const onbRes = await fetch("/api/clinic/onboarding", { headers: { Authorization: `Bearer ${tok}` } });
        if (onbRes.ok) {
          const onbData = (await onbRes.json()) as { steps?: { id: string; completed: boolean }[] };
          const supplierDone = !!onbData.steps?.find((s) => s.id === "connect_supplier")?.completed;
          const gdcDone = !!onbData.steps?.find((s) => s.id === "gdc_document")?.completed;
          const done = supplierDone && gdcDone;
          if (!cancelled) setFirstOrderPlaced(done);
        }
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSignOut() {
    clearAuth();
    setClinic(null);
    setHasSession(false);
    router.push("/login");
  }

  const insightsWithBadge: NavEntry[] = INSIGHTS_ITEMS.map((n) =>
    n.href === "/approvals" ? { ...n, badge: pendingRequests || undefined } : { ...n },
  );

  /** `/dashboard` must not match `/dashboard/onboarding` (prefix bug from shared isActive). */
  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (!pathname) return false;
    const p = pathname.replace(/\/+$/, "") || "/";
    if (href === "/dashboard") return p === "/dashboard";
    return p === href || p.startsWith(`${href}/`);
  };

  const clinicInitial = clinic?.clinic_name?.[0]?.toUpperCase() ?? "C";
  const clinicName = clinic?.clinic_name ?? "Your Clinic";

  function sidebarInner(navCollapsed: boolean) {
    const INSIGHTS_HREFS = ["/clinic/analytics", "/clinic/savings", "/clinic/par-levels", "/approvals"];
    const locked = (item: NavItem) => {
      if (!!item.proOnly && plan === "free") return true;
      // Lock insights until first order placed (null = still loading, treat as unlocked to avoid flicker on return visits)
      if (firstOrderPlaced === false && INSIGHTS_HREFS.includes(item.href)) return true;
      return false;
    };

    return (
      <div className="flex flex-col h-full min-h-0">
        <div
          className={`border-b border-[var(--dc-border)] shrink-0 ${
            navCollapsed ? "px-2 py-4 flex flex-col items-center gap-3" : "px-4 py-5 flex flex-col gap-4"
          }`}
        >
          <div
            className={`flex items-center w-full ${
              navCollapsed ? "flex-col gap-3 justify-center" : "justify-end gap-3"
            }`}
          >
            {!navCollapsed ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                {plan === "pro" ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--dc-accent-strong,#111111)] bg-[rgba(17,17,17,0.08)] px-2 py-0.5 rounded-full border border-[rgba(17,17,17,0.16)]">
                    Pro
                  </span>
                ) : (
                  <Link
                    href="/upgrade?from=sidebar_header"
                    className="text-[10px] font-bold uppercase tracking-wide text-[var(--dc-accent-strong,#111111)] hover:underline px-1"
                  >
                    Upgrade
                  </Link>
                )}
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="hidden md:inline-flex p-2 rounded-lg text-[var(--dc-muted)] hover:bg-black/[0.05] hover:text-[var(--dc-text)] transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <CollapseIcon collapsed={false} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden md:inline-flex p-2 rounded-lg text-[var(--dc-muted)] hover:bg-black/[0.05] transition-colors"
                aria-label="Expand sidebar"
              >
                <CollapseIcon collapsed />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 min-h-0">
          <SectionLabel label="Overview" collapsed={navCollapsed} />
          {OVERVIEW_ITEMS.map((item) => {
            const isGetStarted = item.href === "/dashboard/onboarding";
            const setupDone = isGetStarted && firstOrderPlaced === true;
            return (
              <div key={item.href} className="relative">
                <NavItemRow item={item} collapsed={navCollapsed} locked={false} active={isActive(item.href)} />
                {setupDone && !navCollapsed && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-[11px] font-bold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Done
                  </span>
                )}
                {setupDone && navCollapsed && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--dc-bg,#f0eff6)]" />
                )}
              </div>
            );
          })}

          <div className="my-3 border-t border-[var(--dc-border)]" />
          <SectionLabel label="Buying" collapsed={navCollapsed} />
          {BUYING_ITEMS.map((item) => (
            <NavItemRow key={item.href} item={item} collapsed={navCollapsed} locked={false} active={isActive(item.href)} />
          ))}

          <div className="my-3 border-t border-[var(--dc-border)]" />
          <SectionLabel label="Insights" collapsed={navCollapsed} />
          {insightsWithBadge.map((item) => {
            const isLocked = locked(item);
            const isOnboardingLocked = firstOrderPlaced === false && INSIGHTS_HREFS.includes(item.href);
            return (
              <div key={item.href} className="relative">
                <NavItemRow item={item} collapsed={navCollapsed} locked={isLocked} onboardingLocked={isOnboardingLocked} active={isActive(item.href)} />
                {item.badge && !navCollapsed && !isLocked ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-[var(--dc-accent,#c3b1e1)] text-[#1c1926] text-[9px] font-bold rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
                {item.badge && navCollapsed && !isLocked ? (
                  <span className="absolute right-1 top-1 min-w-[8px] h-2 rounded-full bg-[var(--dc-accent,#c3b1e1)]" aria-hidden />
                ) : null}
              </div>
            );
          })}

          <div className="my-3 border-t border-[var(--dc-border)]" />
          <SectionLabel label="Account" collapsed={navCollapsed} />
          {ACCOUNT_ITEMS.map((item) => (
            <NavItemRow key={item.href} item={item} collapsed={navCollapsed} locked={false} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-[var(--dc-border)] space-y-1 shrink-0">
          {hasSession && clinic && (
            <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1 bg-neutral-50 ${navCollapsed ? "justify-center px-0" : ""}`}>
              <div className="w-7 h-7 rounded-full bg-[rgba(17,17,17,0.12)] flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-[var(--dc-accent-strong,#111111)]">
                {clinicInitial}
              </div>
              {!navCollapsed ? (
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--dc-text,#0f172a)] truncate">{clinic.email}</p>
                  <p className="text-[10px] text-[var(--dc-muted,#64748b)] truncate">Signed in · {clinicName}</p>
                </div>
              ) : null}
            </div>
          )}
          {hasSession ? (
            <button
              type="button"
              onClick={handleSignOut}
              title={navCollapsed ? "Sign out" : undefined}
              className={`w-full flex items-center rounded-xl text-[13px] font-medium text-[var(--dc-muted,#64748b)] hover:bg-black/[0.04] hover:text-[var(--dc-text)] transition-colors ${
                navCollapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2"
              }`}
            >
              <span className="text-[var(--dc-muted)]">{LOGOUT_ICON}</span>
              {!navCollapsed ? "Sign out" : null}
            </button>
          ) : (
            <Link
              href="/login"
              title={navCollapsed ? "Sign in" : undefined}
              className={`w-full flex items-center rounded-xl text-[13px] font-medium text-[var(--dc-muted,#64748b)] hover:bg-black/[0.04] hover:text-[var(--dc-text)] transition-colors ${
                navCollapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2"
              }`}
            >
              <span className="text-[var(--dc-muted)]">{LOGIN_ICON}</span>
              {!navCollapsed ? "Sign in" : null}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const desktopWidth = collapsed ? "md:w-[76px]" : "md:w-[228px]";

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 bg-[var(--dc-surface,#ffffff)] border-r border-[var(--dc-border)] z-40 hidden md:flex flex-col transition-[width] duration-200 ease-out shadow-[4px_0_24px_rgba(15,23,42,0.06)] ${desktopWidth}`}
      >
        {sidebarInner(collapsed)}
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[var(--dc-surface,#ffffff)] border-b border-[var(--dc-border)] h-12 flex items-center px-4 gap-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <button type="button" onClick={() => setMobileOpen((o) => !o)} className="text-[var(--dc-muted)] flex-shrink-0" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? (
              <>
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </>
            ) : (
              <>
                <path d="M3 12h18" />
                <path d="M3 6h18" />
                <path d="M3 18h18" />
              </>
            )}
          </svg>
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 flex-1 min-w-0">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0e0f12] text-white text-[9px] font-black flex-shrink-0">D</span>
          <span className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--dc-text,#0f172a)] truncate">Dentago</span>
        </Link>
        <Link href="/cart" className="text-[var(--dc-muted)] flex-shrink-0" aria-label="Cart">
          {CART_ICON}
        </Link>
      </div>

      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="md:hidden fixed inset-y-0 left-0 w-[228px] bg-[var(--dc-surface,#ffffff)] border-r border-[var(--dc-border)] z-50 flex flex-col pt-12 shadow-xl">
            {sidebarInner(false)}
          </aside>
        </>
      )}
    </>
  );
}
