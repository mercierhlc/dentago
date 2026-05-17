"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MAIN_SUPPLIERS } from "@/lib/main-suppliers";

type Tab = "overview" | "mapping" | "exceptions" | "prices" | "reliability" | "identity";

type OverviewRow = {
  supplier: { id: number; name: string; website: string | null };
  main_supplier: {
    catalogue_prices: "public_feed" | "clinic_login";
    short_note: string;
  } | null;
  live: {
    supplier_id: number;
    sku_rows: number;
    pending_review: number;
    mapping_ok: number;
    mapping_blocked: number;
    missing_price: number;
    stale_rows: number;
    missing_sku?: number;
    missing_product_name?: number;
    last_row_update_at: string | null;
  } | null;
  persisted_health: {
    sync_status: string;
    last_success_at: string | null;
    last_error: string | null;
  } | null;
  open_exceptions: number;
  price_change_events_7d: number;
};

export type SupplierOpsConsoleProps = {
  /** `admin`: full page + Dentago nav. `os`: embed inside OS (no duplicate shell). */
  variant: "admin" | "os";
};

export function SupplierOpsConsole({ variant }: SupplierOpsConsoleProps) {
  const router = useRouter();
  const [gate, setGate] = useState<"pending" | "ok">(variant === "os" ? "ok" : "pending");
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [forceSyncing, setForceSyncing] = useState<string | null>(null);
  const [forceSyncResult, setForceSyncResult] = useState<{ supplier: string; ok: boolean; msg: string } | null>(null);

  const [mapping, setMapping] = useState<unknown[]>([]);
  const [mappingTotal, setMappingTotal] = useState(0);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingAction, setMappingAction] = useState<number | null>(null);

  const [exceptions, setExceptions] = useState<unknown[]>([]);
  const [exStatus, setExStatus] = useState<"open" | "acknowledged" | "resolved">("open");
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [exPatching, setExPatching] = useState<string | null>(null);

  const [prices, setPrices] = useState<unknown[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);

  const [reliability, setReliability] = useState<unknown[]>([]);
  const [reliabilityLoading, setReliabilityLoading] = useState(false);

  const [identity, setIdentity] = useState<unknown[]>([]);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityStatus, setIdentityStatus] = useState<"pending_review" | "rejected">("pending_review");
  const [identityAction, setIdentityAction] = useState<string | null>(null);

  useEffect(() => {
    if (variant === "os") return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/session", { credentials: "include" });
      if (cancelled) return;
      if (res.status === 401 || !res.ok) {
        router.replace("/admin/login");
        return;
      }
      setGate("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [router, variant]);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    const res = await fetch("/api/admin/supplier-ops/overview", {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) {
      setOverview(data.suppliers ?? []);
    } else {
      setOverviewError(typeof data.error === "string" ? data.error : `Overview failed (${res.status})`);
    }
    setOverviewLoading(false);
  }, []);

  const fetchMapping = useCallback(async () => {
    setMappingLoading(true);
    const res = await fetch("/api/admin/supplier-ops/mapping-queue?limit=100", {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) {
      setMapping(data.items ?? []);
      setMappingTotal(data.total ?? 0);
    }
    setMappingLoading(false);
  }, []);

  const fetchExceptions = useCallback(async () => {
    setExceptionsLoading(true);
    const res = await fetch(`/api/admin/supplier-ops/exceptions?status=${exStatus}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setExceptions(data.items ?? []);
    setExceptionsLoading(false);
  }, [exStatus]);

  const fetchPrices = useCallback(async () => {
    setPricesLoading(true);
    const res = await fetch("/api/admin/supplier-ops/price-recent?limit=100", {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setPrices(data.items ?? []);
    setPricesLoading(false);
  }, []);

  const fetchReliability = useCallback(async () => {
    setReliabilityLoading(true);
    const res = await fetch("/api/admin/supplier-ops/reliability", {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setReliability(data.items ?? []);
    setReliabilityLoading(false);
  }, []);

  const fetchIdentity = useCallback(async () => {
    setIdentityLoading(true);
    const res = await fetch(`/api/admin/catalog-identity?status=${identityStatus}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setIdentity(data.items ?? []);
    setIdentityLoading(false);
  }, [identityStatus]);

  useEffect(() => {
    if (gate !== "ok") return;
    if (tab === "overview") void fetchOverview();
    if (tab === "mapping") void fetchMapping();
    if (tab === "exceptions") void fetchExceptions();
    if (tab === "prices") void fetchPrices();
    if (tab === "reliability") void fetchReliability();
    if (tab === "identity") void fetchIdentity();
  }, [gate, tab, fetchOverview, fetchMapping, fetchExceptions, fetchPrices, fetchReliability, fetchIdentity]);

  const FORCE_SYNC_SUPPLIERS = new Set(["Henry Schein", "DHB", "DD Group", "Dental Sky", "Wrights"]);

  async function forceSync(supplierName: string) {
    setForceSyncing(supplierName);
    setForceSyncResult(null);
    try {
      const res = await fetch("/api/admin/force-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierName }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (res.ok) {
        setForceSyncResult({
          supplier: supplierName,
          ok: true,
          msg: `✅ ${supplierName}: ${data.clinics_synced ?? 0} clinics, ${data.prices_written ?? 0} prices written`,
        });
        await fetchOverview();
      } else {
        setForceSyncResult({
          supplier: supplierName,
          ok: false,
          msg: `❌ ${supplierName}: ${String(data.error ?? "sync failed")}`,
        });
      }
    } catch (e) {
      setForceSyncResult({ supplier: supplierName, ok: false, msg: `❌ ${supplierName}: ${String(e)}` });
    }
    setForceSyncing(null);
  }

  async function refreshCatalogHealth() {
    setRefreshingHealth(true);
    await fetch("/api/admin/supplier-ops/refresh-catalog-health", {
      method: "POST",
      credentials: "include",
    });
    await fetchOverview();
    setRefreshingHealth(false);
  }

  async function decideMapping(supplierProductId: number, decision: "approved" | "rejected") {
    const reason =
      decision === "rejected"
        ? window.prompt("Rejection reason (optional):") ?? ""
        : null;
    setMappingAction(supplierProductId);
    const res = await fetch("/api/admin/supplier-ops/mapping-decision", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_product_id: supplierProductId, decision, reason: reason || null }),
    });
    setMappingAction(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Request failed");
      return;
    }
    await fetchMapping();
    await fetchOverview();
  }

  async function decideIdentity(suggestionId: string, action: "merge" | "reject") {
    const keepRaw =
      action === "merge" ? window.prompt("Keep product id (optional — leave blank for auto):", "")?.trim() ?? "" : "";
    const keepParsed = keepRaw ? parseInt(keepRaw, 10) : NaN;
    const keepProductId = Number.isFinite(keepParsed) ? keepParsed : undefined;
    if (keepRaw && keepProductId === undefined) {
      alert("Invalid product id");
      return;
    }
    setIdentityAction(suggestionId);
    const body: Record<string, unknown> = { suggestionId, action };
    if (action === "merge" && keepProductId !== undefined) body.keepProductId = keepProductId;
    const res = await fetch("/api/admin/catalog-identity", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setIdentityAction(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Request failed");
      return;
    }
    const out = await res.json().catch(() => ({}));
    if (action === "merge" && out.keepProductId != null) {
      alert(`Merged into product ${out.keepProductId} (dropped ${out.droppedProductId}).`);
    }
    await fetchIdentity();
    await fetchOverview();
  }

  async function patchException(id: string, status: "acknowledged" | "resolved") {
    const note = status === "resolved" ? window.prompt("Resolution note (optional):") ?? "" : "";
    setExPatching(id);
    const res = await fetch(`/api/admin/supplier-ops/exceptions/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution_note: note || undefined }),
    });
    setExPatching(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Request failed");
      return;
    }
    await fetchExceptions();
    await fetchOverview();
  }

  if (gate === "pending") {
    return (
      <div className="min-h-[200px] flex items-center justify-center px-4">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Catalogue health" },
    { id: "mapping", label: "SKU mapping" },
    { id: "identity", label: "Catalog identity" },
    { id: "exceptions", label: "Exceptions" },
    { id: "prices", label: "Price feed" },
    { id: "reliability", label: "Reliability" },
  ];

  const tabBar = (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={`text-xs font-bold px-3 py-2 rounded-xl transition-colors ${
            tab === t.id ? "bg-[#111111] text-white" : "text-slate-500 hover:bg-slate-100 bg-white/80 border border-slate-200/80"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  const main = (
    <>
      <header className={variant === "os" ? "mb-6" : ""}>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Supplier operations console</h1>
        <p className="text-slate-500 text-sm mt-2 max-w-3xl">
          Canonical products live in <code className="text-xs bg-white px-1 rounded border border-slate-100">dentago_products</code>;
          supplier rows in <code className="text-xs bg-white px-1 rounded border border-slate-100">dentago_supplier_products</code>. Catalogue
          health, mapping queue, sync exceptions, recent price writes, and reliability snapshots.
        </p>
        <p className="text-slate-600 text-sm mt-3 max-w-3xl rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3">
          <span className="font-bold text-slate-800">Priority suppliers</span> (pinned first in the table):{" "}
          {MAIN_SUPPLIERS.map((s) => s.name).join(", ")}. Rows with a <span className="font-bold">Core</span> badge use the feed type in the
          Price feed column. Public catalogue prices for suppliers on <span className="font-bold text-emerald-800">Public cron</span> run via{" "}
          <code className="text-[11px] bg-white px-1 rounded border border-violet-100/80">scripts/refresh-all-public-supplier-prices.ts</code>{" "}
          (same as production crons). <span className="font-bold text-slate-800">Clinic login</span> rows depend on stored credentials and
          sync-prices / admin force-sync.
        </p>
      </header>

      {variant === "os" ? <div className="mb-6">{tabBar}</div> : null}

      {tab === "overview" && (
        <section className="space-y-4">
          {forceSyncResult && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${forceSyncResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {forceSyncResult.msg}
              <button type="button" onClick={() => setForceSyncResult(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
          {overviewError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-bold">Could not load overview.</span> {overviewError} If you just changed the database, ensure the
              migration that recreates <code className="text-xs bg-white px-1 rounded">supplier_ops_catalog_stats</code> ran successfully,
              then deploy the latest app so this UI matches the API.
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => void fetchOverview()}
              disabled={overviewLoading}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void refreshCatalogHealth()}
              disabled={refreshingHealth}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
            >
              {refreshingHealth ? "Syncing…" : "Persist health from live stats"}
            </button>
          </div>
          {overviewLoading ? (
            <p className="text-slate-400 font-bold">Loading…</p>
          ) : (
            <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Supplier</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Price feed</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Sync</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">SKUs</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">∅ SKU</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">∅ name</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Pending map</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">No price</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Stale 14d</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Last row</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Δ 7d</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Ex.</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {overview.map((row) => {
                    const live = row.live;
                    const core = row.main_supplier != null;
                    return (
                      <tr
                        key={row.supplier.id}
                        className={`hover:bg-slate-50/60 ${core ? "bg-violet-50/35" : ""}`}
                        title={row.main_supplier?.short_note}
                      >
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <div className="flex items-center gap-2 flex-wrap">
                            {row.supplier.name}
                            {core && (
                              <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 bg-violet-100/80 px-2 py-0.5 rounded-lg">
                                Core
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-600 max-w-[140px] leading-snug">
                          {row.main_supplier ? (
                            row.main_supplier.catalogue_prices === "public_feed" ? (
                              <span className="font-bold text-emerald-700">Public cron</span>
                            ) : (
                              <span className="font-bold text-slate-700">Clinic login</span>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold uppercase text-slate-500">
                            {row.persisted_health?.sync_status ?? "—"}
                          </span>
                          {row.persisted_health?.last_error && (
                            <div className="text-[11px] text-red-500 mt-1 max-w-xs truncate" title={row.persisted_health.last_error}>
                              {row.persisted_health.last_error}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{live?.sku_rows ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-xs text-rose-600">{live?.missing_sku ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-xs text-rose-600">{live?.missing_product_name ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-xs text-amber-600">{live?.pending_review ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-xs">{live?.missing_price ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-xs">{live?.stale_rows ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {live?.last_row_update_at
                            ? new Date(live.last_row_update_at).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{row.price_change_events_7d}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.open_exceptions}</td>
                        <td className="px-4 py-3">
                          {FORCE_SYNC_SUPPLIERS.has(row.supplier.name) && (
                            <button
                              type="button"
                              disabled={forceSyncing === row.supplier.name}
                              onClick={() => void forceSync(row.supplier.name)}
                              className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-bold disabled:opacity-40 whitespace-nowrap hover:bg-violet-700"
                            >
                              {forceSyncing === row.supplier.name ? "Syncing…" : "Force sync"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "mapping" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-slate-500">
              Rows with <code className="text-xs bg-white px-1 rounded border border-slate-100">match_status = pending_review</code> (
              {mappingTotal} total).
            </p>
            <button
              type="button"
              onClick={() => void fetchMapping()}
              disabled={mappingLoading}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          {mappingLoading ? (
            <p className="text-slate-400 font-bold">Loading…</p>
          ) : mapping.length === 0 ? (
            <p className="text-slate-400 font-bold">Queue is empty.</p>
          ) : (
            <div className="space-y-3">
              {mapping.map((raw) => {
                const m = raw as Record<string, unknown> & {
                  id: number;
                  sku: string;
                  match_confidence: number | null;
                  match_method: string | null;
                  dentago_products?: { name?: string; brand?: string } | null;
                  dentago_suppliers?: { name?: string } | null;
                };
                return (
                  <div
                    key={m.id}
                    className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                        {m.dentago_suppliers?.name ?? "Supplier"}
                      </div>
                      <div className="font-extrabold text-slate-900 mt-1">{m.dentago_products?.name ?? "—"}</div>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        SKU {m.sku} · conf {m.match_confidence ?? "—"} · {m.match_method ?? "—"}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={mappingAction === m.id}
                        onClick={() => void decideMapping(m.id, "approved")}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={mappingAction === m.id}
                        onClick={() => void decideMapping(m.id, "rejected")}
                        className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "identity" && (
        <section className="space-y-4">
          <p className="text-sm text-slate-600 max-w-3xl">
            Same-brand, 90%+ name similarity across suppliers (high confidence only). Run{" "}
            <code className="text-xs bg-white px-1 rounded border border-slate-100">npm run catalog:identity-scan -- --write-db</code>{" "}
            (optional <code className="text-xs bg-white px-1 rounded border">--max-pairs 5000</code>,{" "}
            <code className="text-xs bg-white px-1 rounded border">--brand-key &quot;3m&quot;</code>) to populate suggestions. Brand must match exactly
            (normalised); ambiguous rows stay here for you to merge or reject. Every supplier line lists its SKU.
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            {(["pending_review", "rejected"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setIdentityStatus(s)}
                className={`px-4 py-2 rounded-xl text-sm font-bold capitalize ${
                  identityStatus === s ? "bg-[#111111] text-white" : "bg-white border border-slate-200 text-slate-600"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void fetchIdentity()}
              disabled={identityLoading}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          {identityLoading ? (
            <p className="text-slate-400 font-bold">Loading…</p>
          ) : identity.length === 0 ? (
            <p className="text-slate-400 font-bold">No rows.</p>
          ) : (
            <div className="space-y-4">
              {(identity as Record<string, unknown>[]).map((row) => {
                const id = String(row.id);
                const payload = (row.payload ?? {}) as {
                  product_lo?: {
                    id?: number;
                    name?: string;
                    brand?: string;
                    supplier_skus?: { supplier_name: string; sku: string | null; price: number | null }[];
                  };
                  product_hi?: {
                    id?: number;
                    name?: string;
                    brand?: string;
                    supplier_skus?: { supplier_name: string; sku: string | null; price: number | null }[];
                  };
                  score?: { name_similarity?: number; distinguishing_conflict?: boolean };
                };
                const lo = payload.product_lo;
                const hi = payload.product_hi;
                const sim = Number(row.name_similarity ?? payload.score?.name_similarity ?? 0);
                const tier = String(row.confidence_tier ?? "");
                const conflict = Boolean(row.distinguishing_conflict ?? payload.score?.distinguishing_conflict);
                return (
                  <div key={id} className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-sm space-y-4">
                    <div className="flex flex-wrap justify-between gap-2 items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-600">
                          {tier} · {(sim * 100).toFixed(1)}% name match
                          {conflict ? " · size/pack conflict flag" : ""}
                        </span>
                        <div className="text-xs text-slate-400 mt-1 font-mono">Suggestion {id}</div>
                      </div>
                      {identityStatus === "pending_review" && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={identityAction === id}
                            onClick={() => void decideIdentity(id, "merge")}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
                          >
                            Merge
                          </button>
                          <button
                            type="button"
                            disabled={identityAction === id}
                            onClick={() => void decideIdentity(id, "reject")}
                            className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[lo, hi].map((side, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                          <div className="text-[10px] font-black uppercase text-slate-400">Product {side?.id ?? "—"}</div>
                          <div className="font-extrabold text-slate-900">{side?.name ?? "—"}</div>
                          <div className="text-xs text-slate-500">
                            Brand <span className="font-semibold text-slate-700">{side?.brand ?? "—"}</span>
                          </div>
                          <div className="text-[10px] font-bold uppercase text-slate-400 mt-2">Supplier SKUs</div>
                          <ul className="text-xs space-y-1 font-mono text-slate-700">
                            {(side?.supplier_skus ?? []).map((line, li) => (
                              <li key={li} className="break-all">
                                <span className="font-sans font-semibold text-slate-600">{line.supplier_name}:</span>{" "}
                                {line.sku ?? "—"}
                                {line.price != null ? ` · £${Number(line.price).toFixed(2)}` : ""}
                              </li>
                            ))}
                            {(side?.supplier_skus ?? []).length === 0 ? <li className="text-slate-400">No supplier rows</li> : null}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "exceptions" && (
        <section className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            {(["open", "acknowledged", "resolved"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setExStatus(s)}
                className={`px-4 py-2 rounded-xl text-sm font-bold capitalize ${
                  exStatus === s ? "bg-[#111111] text-white" : "bg-white border border-slate-200 text-slate-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {exceptionsLoading ? (
            <p className="text-slate-400 font-bold">Loading…</p>
          ) : exceptions.length === 0 ? (
            <p className="text-slate-400 font-bold">No rows.</p>
          ) : (
            <div className="space-y-3">
              {(exceptions as Record<string, unknown>[]).map((ex) => {
                const id = String(ex.id);
                return (
                  <div key={id} className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-600">
                          {String(ex.kind)} · {String(ex.severity)}
                        </span>
                        <div className="font-extrabold text-slate-900 mt-1">{String(ex.title)}</div>
                        <div className="text-xs text-slate-400 mt-1">{new Date(String(ex.created_at)).toLocaleString("en-GB")}</div>
                      </div>
                      {exStatus === "open" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={exPatching === id}
                            onClick={() => void patchException(id, "acknowledged")}
                            className="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700"
                          >
                            Ack
                          </button>
                          <button
                            type="button"
                            disabled={exPatching === id}
                            onClick={() => void patchException(id, "resolved")}
                            className="px-3 py-2 rounded-xl bg-[#111111] text-white text-sm font-bold"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "prices" && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => void fetchPrices()}
            disabled={pricesLoading}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-50"
          >
            Refresh
          </button>
          {pricesLoading ? (
            <p className="text-slate-400 font-bold">Loading…</p>
          ) : (
            <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-sm max-h-[480px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-black uppercase text-slate-400">When</th>
                    <th className="px-3 py-2 font-black uppercase text-slate-400">Supplier</th>
                    <th className="px-3 py-2 font-black uppercase text-slate-400">Product</th>
                    <th className="px-3 py-2 font-black uppercase text-slate-400">SKU</th>
                    <th className="px-3 py-2 font-black uppercase text-slate-400">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(prices as Record<string, unknown>[]).map((r) => {
                    const sup = r.dentago_suppliers as { name?: string } | undefined;
                    const prod = r.dentago_products as { name?: string } | undefined;
                    return (
                      <tr key={String(r.id)}>
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(String(r.recorded_at)).toLocaleString("en-GB")}</td>
                        <td className="px-3 py-2">{sup?.name ?? String(r.supplier_id ?? "—")}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={prod?.name}>
                          {prod?.name ?? String(r.product_id ?? "—")}
                        </td>
                        <td className="px-3 py-2 font-mono">{String(r.sku ?? "—")}</td>
                        <td className="px-3 py-2 font-mono">{String(r.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "reliability" && (
        <section className="space-y-4">
          <p className="text-sm text-slate-500">
            Periodic scorecard payloads go to <code className="text-xs bg-white px-1 rounded border border-slate-100">supplier_reliability_snapshots</code>{" "}
            (empty until jobs write them).
          </p>
          <button
            type="button"
            onClick={() => void fetchReliability()}
            disabled={reliabilityLoading}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-50"
          >
            Refresh
          </button>
          {reliabilityLoading ? (
            <p className="text-slate-400 font-bold">Loading…</p>
          ) : reliability.length === 0 ? (
            <p className="text-slate-400 font-bold">No snapshots yet.</p>
          ) : (
            <pre className="text-xs bg-white border border-slate-200 rounded-2xl p-4 overflow-x-auto">
              {JSON.stringify(reliability, null, 2)}
            </pre>
          )}
        </section>
      )}
    </>
  );

  if (variant === "admin") {
    return (
      <div className="min-h-screen bg-[#f7f9fb] text-[#151121]" style={{ fontFamily: "Manrope, sans-serif" }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />

        <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50">
          <div className="flex justify-between items-center px-8 h-20 max-w-7xl mx-auto gap-4">
            <div className="flex items-center gap-4 shrink-0">
              <Link href="/admin" className="text-2xl font-extrabold tracking-tighter text-[#111111] hover:opacity-80">
                Dentago
              </Link>
              <span className="bg-violet-600/10 text-violet-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full hidden sm:inline">
                Supplier ops
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
              {tabBar}
              <Link
                href="/admin"
                className="text-xs font-bold text-slate-500 hover:text-[#111111] border border-slate-200 px-3 py-2 rounded-xl shrink-0"
              >
                Admin home
              </Link>
            </div>
          </div>
        </nav>

        <main className="pt-28 pb-20 max-w-7xl mx-auto px-8 space-y-8">{main}</main>
      </div>
    );
  }

  return <div className="text-[#151121] space-y-6">{main}</div>;
}
