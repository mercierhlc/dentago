"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const LS_PREFIX = "dentago_os_p0_verified_v1:";

type CodeVerdict = "shipped" | "partial" | "missing" | "risk";

type P0Row = {
  id: string;
  label: string;
  verdict: CodeVerdict;
  /** Plain-English: what the repo actually does vs the spec */
  critique: string;
  /** Primary code locations (for humans chasing truth) */
  pointers?: string[];
};

type P0Section = { title: string; rows: P0Row[] };

export const P0_CHECKLIST: P0Section[] = [
  {
    title: "7.2.1 Clinic onboarding — ruthlessly simplified",
    rows: [
      {
        id: "onb-4steps",
        label: "Exactly four steps: account → suppliers → import favourites → first order (no extra friction)",
        verdict: "risk",
        critique:
          "The live checklist is not those four steps. `lib/onboarding.ts` defines four *free* steps: connect suppliers, first search, open a product detail page, then first order — so “view a PDP” is an extra gate the spec said to drop. There is no dedicated “import favourites / most-ordered” step in the checklist (favourites exist as `/clinic/favorites` + dashboard quick reorder, but not as a tracked activation step). Pro tier adds par levels, savings review, approvals — more surface than “nothing before first order”.",
        pointers: ["lib/onboarding.ts", "components/OnboardingChecklist.tsx"],
      },
      {
        id: "signup-email-google",
        label: "Self-serve signup: email/password or Google OAuth",
        verdict: "partial",
        critique:
          "Email/password: `POST /api/auth/signup` creates Supabase user + `clinic_accounts`. Google: `/login` uses `signInWithOAuth({ provider: \"google\" })`; `POST /api/auth/complete-clinic` stitches OAuth users to a workspace. Not audited here for whether every signup entry path exposes both options equally.",
        pointers: ["app/api/auth/signup/route.ts", "app/login/page.tsx", "app/api/auth/complete-clinic/route.ts"],
      },
      {
        id: "practice-details",
        label: "Practice details: name, address, GDC, type (private/NHS/mixed)",
        verdict: "partial",
        critique:
          "Legacy HTML onboarding under `public/onboarding/step2.html` collects practice name, GDC, type, address fields into `clinic_profiles`. The newer app signup path may not enforce the same completeness in one linear flow — treat as partially covered until a single Next.js flow owns all fields.",
        pointers: ["public/onboarding/step2.html"],
      },
      {
        id: "doc-upload",
        label: "Document upload: GDC cert, proof of address, insurance",
        verdict: "missing",
        critique:
          "No first-class Next.js upload pipeline was found in this audit for the three named documents tied to verification state. If it exists, it is outside the paths we traced (admin clinic review vs static onboarding HTML).",
      },
      {
        id: "gdc-auto",
        label: "GDC auto-verification + manual queue for exceptions",
        verdict: "partial",
        critique:
          "`lib/gdc-verify.ts` scrapes the public GDC register with `parseGdcSearchResultHtml`. Admin `POST /api/admin/gdc-verify/[clinicId]` infers surname via `inferSurnameForGdcSearch(practice_name)` or accepts `{ \"surname\": \"...\" }`, returning **422** when no usable surname exists — fewer false negatives than an empty field. Cron `gdc-verify-queue` batches. Auto-approve remains only as trustworthy as GDC HTML stability.",
        pointers: ["lib/gdc-verify.ts", "lib/gdc-surname.ts", "lib/gdc-parse.ts", "app/api/admin/gdc-verify/[clinicId]/route.ts", "app/api/cron/gdc-verify-queue/route.ts"],
      },
      {
        id: "admin-mfa",
        label: "Admin MFA required for all admin accounts",
        verdict: "missing",
        critique:
          "There is **no MFA enforcement in application code**. `lib/admin-auth.ts` uses a shared `ADMIN_SECRET` cookie/header and explicitly says Supabase MFA should be configured in the Supabase project — that is operational, not shipped as code. Compromise of the secret or cookie equals full admin API access.",
        pointers: ["lib/admin-auth.ts"],
      },
      {
        id: "verification-audit",
        label: "Verification audit log: who, what, when, outcome for every action",
        verdict: "partial",
        critique:
          "There is a dedicated `verification_audit` table exposed as `GET /api/admin/verification-audit` (per-clinic filter). GDC and other flows also log to generic `events` via `logEvent`. Gaps remain: `getAdminIdentifier` still returns the literal `'admin'` for many admin routes, so “who” is often not a real user identity; coverage of “every action” depends on each code path writing to `verification_audit` consistently — not verified row-by-row in this pass.",
        pointers: ["app/api/admin/verification-audit/route.ts", "app/api/admin/audit-log/route.ts", "lib/admin-auth.ts", "lib/events.ts"],
      },
      {
        id: "onb-checklist-ui",
        label: "Onboarding checklist on dashboard: dismissible, progress-tracked (spec wording)",
        verdict: "partial",
        critique:
          "Implemented: progress bar, dismiss (7-day snooze in `localStorage`), steps from `/api/clinic/onboarding`. Spec asked for: Connect → Search first product → See savings → Place first order. Actual free steps omit explicit “see savings” as its own step (savings is a **Pro** checklist item) and inject “open product detail” instead.",
        pointers: ["components/OnboardingChecklist.tsx", "app/api/clinic/onboarding/route.ts", "lib/onboarding.ts"],
      },
      {
        id: "email-sequences",
        label: "Email sequences: Day 0 / 2 / 5 / 14 nudges",
        verdict: "missing",
        critique:
          "Welcome email fires from `complete-clinic`. No codebase evidence in this pass of scheduled Day 2 / Day 5 / Day 14 lifecycle campaigns (would need Resend automations, crons, or OS scripts — not found by targeted search).",
        pointers: ["app/api/auth/complete-clinic/route.ts", "emails/welcome.ts"],
      },
    ],
  },
  {
    title: "7.2.2 Supplier integration",
    rows: [
      {
        id: "cred-live-prices",
        label: "Clinics connect accounts; prices = clinic negotiated live pricing (not list)",
        verdict: "partial",
        critique:
          "Architecture intent: `supplier_credentials` + sync / live pricing paths. Dashboard bundle now attaches **`main_supplier`** (`catalogue_prices`, `short_note`) per credential from `lib/main-suppliers.ts` so clinics see whether list vs login-sourced pricing is expected. Mixed reality across suppliers unchanged; Kent Express stub called out in code.",
        pointers: ["lib/main-suppliers.ts", "app/api/clinic/credentials/route.ts", "app/api/clinic/dashboard-bundle/route.ts", "app/api/cron/refresh-clinic-prices/route.ts"],
      },
      {
        id: "supplier-list",
        label: "Supported suppliers list (HS, KE, DD, DD Group, Wrights, Trycare, Dental Sky)",
        verdict: "partial",
        critique:
          "Multiple lists exist (OS force-sync names, `MAIN_SUPPLIERS`, marketing copy). Trycare / Dental Directory naming may not match DB `dentago_suppliers.name` everywhere — risk of drift between comms and integration reality.",
        pointers: ["app/os/page.tsx", "lib/main-suppliers.ts", "lib/marketplace-suppliers.ts"],
      },
      {
        id: "tiers-csv-api",
        label: "Tier 1 API/EDI vs Tier 2 CSV vs Tier 3 manual — as a product contract",
        verdict: "partial",
        critique:
          "Operational crons and scrapers exist; supplier portal / AM catalogue update is not a complete self-serve product in this audit. Tiering is engineering reality more than a clinic-visible contract.",
      },
      {
        id: "order-only-api",
        label: "Hard rule: order placement only via API/EDI — no email fallback",
        verdict: "risk",
        critique:
          "**Violated relative to the written hard rule.** `POST /api/orders` persists orders and emails **support@dentago.co.uk** as “supplier notification until suppliers have direct accounts”. That is explicitly an email operational path, not supplier API/EDI placement. Basket push (`push-to-basket`) is headless web automation, not EDI, and is env + per-clinic gated.",
        pointers: ["app/api/orders/route.ts", "app/api/clinic/push-to-basket/route.ts"],
      },
    ],
  },
  {
    title: "7.2.3 Product search & comparison",
    rows: [
      {
        id: "fts-search",
        label: "Full-text search across connected catalogues + filters/sort",
        verdict: "partial",
        critique:
          "`/api/search` joins products and supplier offers; search page has sort including best price / savings. Full coverage of “all connected supplier catalogues only” depends on sync health — not re-verified here against production data volume.",
        pointers: ["app/api/search/route.ts", "app/search/page.tsx"],
      },
      {
        id: "badges-pack",
        label: "Best Price badge, Save £ spread, per-unit normalisation, pack insight badge",
        verdict: "partial",
        critique:
          "Search cards show `Save £X` when saving > £1; `formatPerUnitPrice` exists on product page. Pack-level “30% cheaper per unit on 200-pack” style **inline insight badge across all variants** was not confirmed in `app/search/page.tsx` during this audit.",
        pointers: ["app/search/page.tsx", "app/product/[id]/page.tsx", "lib/pricing.ts"],
      },
      {
        id: "pdp-chart-category",
        label: "PDP: price history chart; category browsing tree",
        verdict: "missing",
        critique:
          "No `price` + `chart` implementation found under `app/product/`. Category browsing as a first-class IA (consumables → …) beyond search filters was not evidenced in this pass.",
        pointers: ["app/product/[id]/page.tsx"],
      },
    ],
  },
  {
    title: "7.2.4 Unified cart & order placement",
    rows: [
      {
        id: "cart-sections",
        label: "Cart by supplier, cross-supplier summary, qty/remove",
        verdict: "shipped",
        critique:
          "Cart page groups lines, computes savings vs max in-stock among loaded offers, supports quantity and removal — matches a large slice of the spec.",
        pointers: ["app/cart/page.tsx", "app/api/cart/route.ts"],
      },
      {
        id: "order-confirm-history",
        label: "Confirmation with supplier refs & delivery; history with reorder & status",
        verdict: "partial",
        critique:
          "Order confirmation emails exist. Per-supplier **live** reference IDs from supplier systems are not guaranteed by `dentago_orders` insert alone — depends on downstream integration. `/orders` and order detail pages exist but full “status tracking per supplier API” is not proven here.",
        pointers: ["app/api/orders/route.ts", "emails/order-confirmation.ts", "app/orders/page.tsx"],
      },
    ],
  },
  {
    title: "7.2.5 Savings calculator",
    rows: [
      {
        id: "savings-math",
        label: "Per-item, cart, annual ×52 with honest labelling",
        verdict: "shipped",
        critique:
          "Cart uses max among competitor prices minus chosen price; annual line says “if ordered weekly” — aligns with the spec’s honesty requirement.",
        pointers: ["app/cart/page.tsx"],
      },
      {
        id: "floating-widget",
        label: "Floating savings widget on search (animates in)",
        verdict: "missing",
        critique:
          "Search page shows inline Save badge on cards when threshold met; no floating animated widget found in `app/search/page.tsx` grep for savings/floating patterns.",
        pointers: ["app/search/page.tsx"],
      },
      {
        id: "credibility-savings",
        label: "Never present list-price savings as negotiated savings",
        verdict: "risk",
        critique:
          "Where data comes from public feeds or stale cache, the UI can still **display** a “saving” vs other suppliers without proving both legs are authenticated negotiated prices. Requires data governance + UI guardrails not fully evidenced here.",
        pointers: ["app/api/search/route.ts", "lib/supplier-price-compare.ts"],
      },
    ],
  },
  {
    title: "7.2.6 Basic dashboard",
    rows: [
      {
        id: "dash-cards",
        label: "Summary cards: spend, orders, suppliers, savings",
        verdict: "shipped",
        critique:
          "`GET /api/clinic/dashboard-bundle` powers one round-trip; `app/dashboard/page.tsx` shows spend, suppliers, savings estimate, staff requests, favourites, **server-side par due list** (`stock_alerts`), **reorder rhythm** from order history, optional **DSO** child count / parent link, and a **Pro procurement assistant** panel — still richer than a four-line spec, but the core snapshot is real product, not placeholder.",
        pointers: ["app/dashboard/page.tsx", "app/api/clinic/dashboard-bundle/route.ts"],
      },
      {
        id: "par-alerts",
        label: "Low stock alerts when par levels set",
        verdict: "shipped",
        critique:
          "Par levels UI (`/clinic/par-levels`), shared logic `lib/par-level-alerts.ts`, cron `stockout-alerts` (email with 48h cooldown), and dashboard **in-app** list with `respectAlertCooldown: false` so clinics always see due rows. Push/mobile app channels are out of scope for this web app.",
        pointers: ["app/clinic/par-levels/page.tsx", "lib/par-level-alerts.ts", "app/api/cron/stockout-alerts/route.ts", "app/api/clinic/dashboard-bundle/route.ts"],
      },
    ],
  },
  {
    title: "7.2.7 Freemium conversion (50 free orders)",
    rows: [
      {
        id: "free-order-counter",
        label: "Visible counter, modals at 40/48/50, cancellation flow",
        verdict: "missing",
        critique:
          "Pro upgrade upsell components exist, but no “23 of 50 free orders” counter or milestone modals were found in this audit. Treat as not shipped until explicitly implemented + tied to `dentago_orders` counts.",
        pointers: ["components/ProUpgradeUpsell.tsx", "app/upgrade/page.tsx"],
      },
    ],
  },
  {
    title: "7.2.8 Internal — supplier GMV tracking",
    rows: [
      {
        id: "gmv-events",
        label: "Every order logs supplier_id, org, value, line_items, timestamp + dashboard",
        verdict: "shipped",
        critique:
          "`order_placed` and per-supplier `supplier_gmv_directed` events with metrics are logged from `POST /api/orders`. OS already has a Supplier GMV tab aggregating admin GMV API — strong alignment with the spec’s “build from day one”.",
        pointers: ["app/api/orders/route.ts", "lib/events.ts", "app/os/page.tsx"],
      },
    ],
  },
  {
    title: "Capability matrix (Mercier list)",
    rows: [
      {
        id: "cap-multi-vendor-real-prices",
        label: "Multi-vendor account connection (real prices)",
        verdict: "partial",
        critique:
          "`supplier_credentials` + live refresh (`/api/clinic/credentials`, `refresh-clinic-prices` cron) + `price_cache` can surface clinic-specific prices when sync succeeds. Coverage is **not uniform** across suppliers (public feeds vs authenticated scrapers); Kent Express called out as stub in `lib/main-suppliers.ts`.",
        pointers: ["app/api/clinic/credentials/route.ts", "app/api/cron/refresh-clinic-prices/route.ts", "lib/main-suppliers.ts"],
      },
      {
        id: "cap-rt-price-compare",
        label: "Real-time price comparison across suppliers",
        verdict: "partial",
        critique:
          "`/api/search` aggregates multiple supplier rows per product, best-price / saving logic, optional clinic `price_cache` merge. Each product now exposes `priceFreshness` (**oldest/newest** `last_synced_at` across offers) so the UI can surface staleness. “Real-time” remains bounded by cron + scrape latency, not live supplier sockets.",
        pointers: ["app/api/search/route.ts", "app/search/page.tsx", "lib/map-supplier-join-row.ts"],
      },
      {
        id: "cap-live-stock-vendor",
        label: "Live stock availability per vendor",
        verdict: "partial",
        critique:
          "Each offer carries `stock` (boolean) in queries; after canonical migration also `stock_status` + `last_synced_at` on `dentago_supplier_products` when crons run. Stock is only as fresh as the last supplier sync — not live POS inventory.",
        pointers: ["app/api/search/route.ts", "lib/map-supplier-join-row.ts", "lib/run-dental-sky-price-refresh.ts"],
      },
      {
        id: "cap-ai-procurement",
        label: "AI procurement assistant",
        verdict: "shipped",
        critique:
          "Clinic-facing **`POST /api/clinic/procurement-assistant`** (Anthropic) with live snapshot: par due rows, heuristic reorder hints, pending approvals, budget — plus dashboard panel (Pro). General `ChatWidget` remains separate. This is **advisory** (no tool calls to cart); not autonomous basket building.",
        pointers: ["app/api/clinic/procurement-assistant/route.ts", "app/dashboard/page.tsx", "components/ChatWidget.tsx"],
      },
      {
        id: "cap-predictive-forecast",
        label: "Predictive reorder / consumption forecasting",
        verdict: "partial",
        critique:
          "No ML consumption model. **`lib/reorder-from-history.ts`** gives deterministic reorder **rhythm** from order-day gaps (due/soon/watch) surfaced on the dashboard bundle — honest v0, not a forecast engine.",
        pointers: ["lib/reorder-from-history.ts", "app/api/clinic/dashboard-bundle/route.ts"],
      },
      {
        id: "cap-par-levels",
        label: "Inventory management + par levels",
        verdict: "partial",
        critique:
          "`/clinic/par-levels` + `app/api/clinic/par-levels` support targets and intervals — not full inventory (no perpetual stock counts from supplier systems in this pass).",
        pointers: ["app/clinic/par-levels/page.tsx", "app/api/clinic/par-levels/route.ts"],
      },
      {
        id: "cap-stockout-alerts",
        label: "Stockout alerts",
        verdict: "shipped",
        critique:
          "Cron emails clinics on due par rows (`computeParLevelAlertsDue` with cooldown). Dashboard shows the same due set **without** cooldown masking. Push notifications outside email are not in scope for the web app.",
        pointers: ["app/api/cron/stockout-alerts/route.ts", "lib/par-level-alerts.ts", "app/api/clinic/dashboard-bundle/route.ts"],
      },
      {
        id: "cap-smart-reorder",
        label: "Smart reorder suggestions",
        verdict: "partial",
        critique:
          "**Heuristic** suggestions from order timestamps (`buildReorderSuggestionsFromOrderDates`) ship in `dashboard-bundle` + UI (“Reorder rhythm”). Not one-tap auto-basket; favourites remain the fast manual path.",
        pointers: ["lib/reorder-from-history.ts", "app/api/clinic/dashboard-bundle/route.ts", "app/clinic/favorites/page.tsx"],
      },
      {
        id: "cap-spend-analytics",
        label: "Spend analytics dashboard",
        verdict: "partial",
        critique:
          "`/clinic/analytics` + `/api/clinic/analytics` exist for clinic-facing charts/metrics. Depth vs BI spec not audited row-by-row.",
        pointers: ["app/clinic/analytics/page.tsx", "app/api/clinic/analytics/route.ts"],
      },
      {
        id: "cap-sku-matching",
        label: "SKU matching across suppliers",
        verdict: "partial",
        critique:
          "Admin SKU review, supplier-ops mapping queue, `match_confidence` / `match_status` on supplier rows when migrations applied, `lib/sku-matcher` / identity tooling — **operational**, not “solved for all SKUs”.",
        pointers: ["app/api/admin/sku-matches/route.ts", "app/api/admin/supplier-ops/mapping-queue/route.ts", "lib/sku-matcher.ts"],
      },
      {
        id: "cap-clinical-equiv",
        label: "Clinical equivalent substitution",
        verdict: "partial",
        critique:
          "`GET /api/products/[id]/substitutes` + scoring (`lib/substitute-scoring.ts`) + PDP wiring when lines are OOS — shipped as **API + logic**; production quality depends on catalogue coverage and tuning.",
        pointers: ["app/api/products/[id]/substitutes/route.ts", "lib/substitute-scoring.ts", "app/product/[id]/page.tsx"],
      },
      {
        id: "cap-supplier-portal",
        label: "Supplier portal",
        verdict: "partial",
        critique:
          "Supplier-facing routes (`/supplier`, orders list/detail, stats APIs) exist — read-path and light ops. Not a full supplier self-serve catalogue contract portal.",
        pointers: ["app/supplier/dashboard/page.tsx", "app/api/supplier/orders/[id]/route.ts"],
      },
      {
        id: "cap-dso-multi",
        label: "Multi-location / DSO structure",
        verdict: "partial",
        critique:
          "**v0 data model:** `parent_clinic_id` on `clinic_accounts` (migration `20260518_clinic_parent_for_dso.sql`) + dashboard bundle returns `child_clinic_count` and `parent_clinic_id` for hub copy. No consolidated multi-site approvals or org tree UI beyond that line yet.",
        pointers: ["supabase/migrations/20260518_clinic_parent_for_dso.sql", "app/api/clinic/dashboard-bundle/route.ts", "app/dashboard/page.tsx"],
      },
      {
        id: "cap-approvals",
        label: "Approval workflows",
        verdict: "partial",
        critique:
          "`/approvals` UI + `approval-policy` API + order approve route — **clinic-side** flows exist. Not enterprise DSO multi-level approval chains.",
        pointers: ["app/approvals/page.tsx", "app/api/clinic/approval-policy/route.ts", "app/api/orders/approve/route.ts"],
      },
      {
        id: "cap-gdc",
        label: "GDC verification",
        verdict: "partial",
        critique:
          "`lib/gdc-verify.ts` + `parseGdcSearchResultHtml` + admin verify route + `gdc-verify-queue` cron. Surname inference + explicit 422 when unusable reduces empty-form risk; scraper/HTML drift remains the long-tail risk.",
        pointers: ["lib/gdc-verify.ts", "lib/gdc-parse.ts", "lib/gdc-surname.ts", "app/api/admin/gdc-verify/[clinicId]/route.ts"],
      },
      {
        id: "cap-uk-market",
        label: "UK market",
        verdict: "shipped",
        critique:
          "Product, suppliers, and copy are UK dental procurement — no international marketplace implementation required for this row.",
        pointers: ["lib/marketplace-suppliers.ts"],
      },
      {
        id: "cap-order-placement",
        label: "Order placement",
        verdict: "partial",
        critique:
          "`POST /api/orders` persists orders and can email **support@** per supplier as ops notification. **`DENTAGO_SUPPLIER_OPS_ORDER_EMAIL`** (`0` / `false` / `off` / `no` disables that ops email only; clinic confirmation emails unchanged). Still not supplier-direct API placement (see `order-only-api`).",
        pointers: ["app/api/orders/route.ts"],
      },
      {
        id: "cap-unified-cart",
        label: "Unified cart",
        verdict: "shipped",
        critique:
          "`/cart` + `/api/cart` with cross-supplier lines and savings vs max competitor price in scope — core unified cart behaviour.",
        pointers: ["app/cart/page.tsx", "app/api/cart/route.ts"],
      },
      {
        id: "cap-savings-calculator",
        label: "Savings calculator",
        verdict: "shipped",
        critique:
          "Cart + search card savings math (`lib/pricing.ts`, compare paths) — aligns with “calculator” for list/trade comparisons in repo.",
        pointers: ["app/cart/page.tsx", "lib/pricing.ts"],
      },
      {
        id: "cap-savings-history",
        label: "My Savings history page",
        verdict: "partial",
        critique:
          "`/clinic/savings` + `/api/clinic/savings` provide a savings-oriented history surface. Completeness vs “all orders lifetime audited” not verified here.",
        pointers: ["app/clinic/savings/page.tsx", "app/api/clinic/savings/route.ts"],
      },
    ],
  },
];

function verdictStyle(v: CodeVerdict): string {
  switch (v) {
    case "shipped":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "partial":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "risk":
      return "bg-red-50 text-red-900 border-red-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function verdictLabel(v: CodeVerdict): string {
  switch (v) {
    case "shipped":
      return "Shipped (code)";
    case "partial":
      return "Partial";
    case "risk":
      return "At risk / gap";
    default:
      return "Missing";
  }
}

export function OsP0Panel() {
  const [verified, setVerified] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const sec of P0_CHECKLIST) {
      for (const row of sec.rows) {
        try {
          next[row.id] = localStorage.getItem(LS_PREFIX + row.id) === "1";
        } catch {
          next[row.id] = false;
        }
      }
    }
    setVerified(next);
  }, []);

  const toggle = useCallback((id: string, on: boolean) => {
    try {
      if (on) localStorage.setItem(LS_PREFIX + id, "1");
      else localStorage.removeItem(LS_PREFIX + id);
    } catch {
      /* ignore */
    }
    setVerified((prev) => ({ ...prev, [id]: on }));
  }, []);

  const stats = useMemo(() => {
    let n = 0,
      ok = 0;
    for (const sec of P0_CHECKLIST) {
      for (const row of sec.rows) {
        n++;
        if (verified[row.id]) ok++;
      }
    }
    return { n, ok };
  }, [verified]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#151121] tracking-tight">P0 — Core product (7.2)</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Code-backed audit snapshot. <strong>“Shipped (code)”</strong> means the behaviour exists in repo paths cited — not that production data or supplier contracts make it true for every clinic.
          Check <strong>Prod verified</strong> after you or an agent have exercised the live site; it persists in this browser only (
          <code className="text-xs bg-slate-100 px-1 rounded">localStorage</code>).
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Human-verified: {stats.ok}/{stats.n} —{" "}
          <button
            type="button"
            className="underline font-semibold text-slate-600 hover:text-[#111111]"
            onClick={() => {
              for (const sec of P0_CHECKLIST) {
                for (const row of sec.rows) {
                  try {
                    localStorage.removeItem(LS_PREFIX + row.id);
                  } catch {
                    /* ignore */
                  }
                }
              }
              setVerified({});
            }}
          >
            Reset all prod checks
          </button>
        </p>
      </div>

      {P0_CHECKLIST.map((sec) => (
        <section key={sec.title} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
            <h3 className="text-sm font-extrabold text-[#151121]">{sec.title}</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {sec.rows.map((row) => (
              <li key={row.id} className="px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border shrink-0 ${verdictStyle(row.verdict)}`}
                  >
                    {verdictLabel(row.verdict)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#151121] leading-snug">{row.label}</p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{row.critique}</p>
                    {row.pointers && row.pointers.length > 0 && (
                      <p className="text-[11px] text-slate-400 mt-2 font-mono break-all">
                        {row.pointers.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2 shrink-0 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!verified[row.id]}
                    onChange={(e) => toggle(row.id, e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Prod verified
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
