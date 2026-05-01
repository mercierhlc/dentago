"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getClinic, getToken, clearAuth, freshAuthHeaders } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";

type Supplier = { id: number; name: string; website?: string };

type SavedCred = {
  id: string;
  supplier_id: number;
  username: string;
  last_synced?: string;
  dentago_suppliers: { id: number; name: string };
};

/** Shown first so practices connect the portals they use most (reduces overwhelm). */
const SUPPLIER_CONNECT_ORDER: string[] = [
  "Henry Schein",
  "Kent Express",
  "Dental Sky",
  "Dental Directory",
  "DD Group",
  "Clark Dental",
  "Trycare",
  "DHB",
  "Wrights",
  "Optident",
  "Amalgadent",
  "DMI",
];

function sortSuppliersForConnect(list: Supplier[]): Supplier[] {
  const rank = (name: string) => {
    const i = SUPPLIER_CONNECT_ORDER.indexOf(name);
    return i === -1 ? 1000 + name.charCodeAt(0) : i;
  };
  return [...list].sort((a, b) => {
    const d = rank(a.name) - rank(b.name);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

const SUPPLIER_META: Record<string, { domain: string; loginUrl: string; logo: string; color: string }> = {
  "Henry Schein": {
    domain: "henryschein.co.uk",
    loginUrl: "https://www.henryschein.co.uk/gb-en/dental/Account/Login",
    logo: "https://logo.clearbit.com/henryschein.co.uk",
    color: "#E63329",
  },
  "Dental Sky": {
    domain: "dentalsky.com",
    loginUrl: "https://www.dentalsky.com/customer/account/login",
    logo: "https://logo.clearbit.com/dentalsky.com",
    color: "#0077C8",
  },
  "Kent Express": {
    domain: "kentexpress.co.uk",
    loginUrl: "https://www.kentexpress.co.uk/login",
    logo: "https://logo.clearbit.com/kentexpress.co.uk",
    color: "#E87722",
  },
  "Dental Directory": {
    domain: "dental-directory.co.uk",
    loginUrl: "https://www.dental-directory.co.uk/login",
    logo: "https://logo.clearbit.com/dental-directory.co.uk",
    color: "#005EB8",
  },
  "Clark Dental": {
    domain: "clarkdental.co.uk",
    loginUrl: "https://www.clarkdental.co.uk/login",
    logo: "https://logo.clearbit.com/clarkdental.co.uk",
    color: "#2D6A4F",
  },
  "Trycare": {
    domain: "trycare.co.uk",
    loginUrl: "https://www.trycare.co.uk/login",
    logo: "https://logo.clearbit.com/trycare.co.uk",
    color: "#6C3DE8",
  },
  "Optident": {
    domain: "optident.co.uk",
    loginUrl: "https://optident.co.uk/login",
    logo: "https://logo.clearbit.com/optident.co.uk",
    color: "#1A73E8",
  },
  "DHB": {
    domain: "dhb-dental.com",
    loginUrl: "https://www.dhb-dental.com/account/login",
    logo: "https://logo.clearbit.com/dhb-dental.com",
    color: "#333333",
  },
  "Amalgadent": {
    domain: "amalgadent.com",
    loginUrl: "https://www.amalgadent.com/login",
    logo: "https://logo.clearbit.com/amalgadent.com",
    color: "#C0392B",
  },
  "Wrights": {
    domain: "wrightsdentals.com",
    loginUrl: "https://www.wrightsdentals.com/login",
    logo: "https://logo.clearbit.com/wrightsdentals.com",
    color: "#117A65",
  },
  "DMI": {
    domain: "dmiuk.com",
    loginUrl: "https://www.dmiuk.com/login",
    logo: "https://logo.clearbit.com/dmiuk.com",
    color: "#6C3DE8",
  },
  "DD Group": {
    domain: "ddgroup.com",
    loginUrl: "https://www.ddgroup.com/login",
    logo: "https://logo.clearbit.com/ddgroup.com",
    color: "#E8A020",
  },
};

function SupplierLogo({ name, domain }: { name: string; domain: string }) {
  const [err, setErr] = useState(false);
  const meta = SUPPLIER_META[name];
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const color = meta?.color ?? "#6C3DE8";

  if (err || !meta?.logo) {
    return (
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-lg"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden p-2 shadow-sm">
      <Image
        src={meta.logo}
        alt={name}
        width={44}
        height={44}
        unoptimized
        className="w-full h-full object-contain"
        onError={() => setErr(true)}
      />
    </div>
  );
}

export default function ClinicSuppliersPage() {
  const router = useRouter();
  const clinic = getClinic();
  const token = getToken();

  const supplierSectionRef = useRef<HTMLElement>(null);

  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [credentials, setCredentials] = useState<Record<number, SavedCred>>({});
  const [loading, setLoading] = useState(true);
  /** Shown briefly after connecting so users know pricing isn’t magically instant everywhere */
  const [justConnectedId, setJustConnectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm] = useState<Record<number, { username: string; password: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ id: number; ok: boolean; msg: string } | null>(null);

  const hydrateCredentialsFromResponse = useCallback((credsData: { credentials?: SavedCred[] }) => {
    const map: Record<number, SavedCred> = {};
    (credsData.credentials ?? []).forEach((c: SavedCred) => {
      if (c.supplier_id != null) map[c.supplier_id] = c;
    });
    setCredentials(map);
  }, []);

  useEffect(() => {
    if (!token) {
      router.push("/onboarding/login.html");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const headers = await freshAuthHeaders();
        const [suppliersRes, credsRes] = await Promise.all([
          fetch("/api/suppliers"),
          fetch("/api/clinic/credentials", { headers }),
        ]);
        const suppliersData = await suppliersRes.json().catch(() => ({}));
        const credsData = await credsRes.json().catch(() => ({}));
        if (cancelled) return;
        setAllSuppliers(sortSuppliersForConnect(suppliersData.suppliers ?? []));
        hydrateCredentialsFromResponse(credsData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router, hydrateCredentialsFromResponse]);

  function toggleExpand(id: number) {
    setExpanded(prev => prev === id ? null : id);
    if (credentials[id] && !form[id]) {
      setForm(prev => ({ ...prev, [id]: { username: credentials[id].username, password: "" } }));
    }
  }

  async function saveCredentials(supplierId: number) {
    const f = form[supplierId];
    if (!f?.username?.trim() || !f?.password) {
      setFeedback({ id: supplierId, ok: false, msg: "Supplier username and password are required" });
      return;
    }
    setSaving(supplierId);
    setFeedback(null);
    try {
      const headers = await freshAuthHeaders();
      const res = await fetch("/api/clinic/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ supplierId, username: f.username.trim(), password: f.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ id: supplierId, ok: false, msg: data.error ?? "Failed to save" });
      } else {
        const name = allSuppliers.find(s => s.id === supplierId)?.name ?? "";
        setCredentials(prev => ({
          ...prev,
          [supplierId]: {
            id: "",
            supplier_id: supplierId,
            username: f.username,
            dentago_suppliers: { id: supplierId, name },
          },
        }));
        setForm(prev => ({ ...prev, [supplierId]: { ...prev[supplierId], password: "" } }));
        setFeedback({
          id: supplierId,
          ok: true,
          msg: "Saved. Your negotiated prices appear on Best Sellers (home) and when you search logged in.",
        });
        setJustConnectedId(supplierId);
        window.setTimeout(() => setJustConnectedId(null), 9000);

        try {
          const h = await freshAuthHeaders();
          const credsRes = await fetch("/api/clinic/credentials", { headers: h });
          const credsData = await credsRes.json();
          hydrateCredentialsFromResponse(credsData);
        } catch {
          /* keep optimistic row */
        }
        setExpanded(null);
      }
    } finally {
      setSaving(null);
    }
  }

  async function disconnect(supplierId: number) {
    setDeleting(supplierId);
    try {
      const headers = await freshAuthHeaders();
      await fetch("/api/clinic/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ supplierId }),
      });
      setCredentials(prev => {
        const n = { ...prev };
        delete n[supplierId];
        return n;
      });
      setExpanded(null);
    } finally {
      setDeleting(null);
    }
  }

  const connectedCount = Object.keys(credentials).length;
  const totalCount = allSuppliers.length;

  const firstSupplierToConnectId = useMemo(() => {
    const unconnected = allSuppliers.find(s => !credentials[s.id]);
    return unconnected?.id ?? allSuppliers[0]?.id ?? null;
  }, [allSuppliers, credentials]);

  const openConnectFlow = useCallback(() => {
    if (supplierSectionRef.current) {
      supplierSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (loading) return;

    window.setTimeout(() => {
      if (firstSupplierToConnectId == null) return;
      const targetId = firstSupplierToConnectId;
      setExpanded(targetId);
      setForm(prev => {
        const c = credentials[targetId];
        if (c && !prev[targetId]) {
          return { ...prev, [targetId]: { username: c.username, password: "" } };
        }
        return prev;
      });
    }, 280);
  }, [loading, firstSupplierToConnectId, credentials]);

  if (!clinic) return null;

  return (
    <div className="min-h-screen text-[#151121] bg-[linear-gradient(180deg,#faf8ff_0%,#f3f5ff_40%,#f8fafc_100%)]">

      {/* Nav — unchanged (matches Shop / ProfileMenu everywhere) */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-100">
        <div className="flex items-center px-6 h-[60px] max-w-6xl mx-auto gap-3">
          <Link href="/" className="text-lg font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</Link>
          <span className="text-slate-200 text-sm">/</span>
          <span className="text-sm font-semibold text-slate-500">My Suppliers</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/search"
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 hover:border-[#6C3DE8]/30 px-3 py-1.5 rounded-xl transition-all">
              <span className="material-symbols-outlined text-[14px]">search</span>
              Shop
            </Link>
            <ProfileMenu clinic={clinic} />
          </div>
        </div>
      </nav>

      <div className="pt-[60px] pb-16">

        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14">

          {/* Hero — lighter Framer-style card */}
          <div className="relative rounded-[2rem] bg-white/80 backdrop-blur-sm border border-white shadow-[0_24px_80px_-20px_rgba(108,61,232,0.12),0_8px_32px_-12px_rgba(15,23,42,0.06)] px-6 sm:px-10 py-9 sm:py-11 mb-10">
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(108,61,232,0.08),transparent_55%)]" />
            <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
              <div className="max-w-xl">
                <span className="inline-flex items-center rounded-full bg-[#6C3DE8]/10 text-[#6C3DE8] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]">
                  Supplier connections
                </span>
                <h1 className="mt-4 text-3xl sm:text-[2rem] font-extrabold tracking-tight text-[#151121] leading-[1.1]">
                  Connect your suppliers
                </h1>
                <p className="mt-3 text-[15px] text-slate-500 leading-relaxed">
                  Use the same email (or username) and password as the supplier&apos;s trade website — not your Dentago login. We encrypt them and only use them to fetch your account pricing.
                </p>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Live scraped pricing is wired for homepage Best Sellers today; catalogue search continues to improve as we widen coverage per supplier.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={openConnectFlow}
                    aria-describedby="connect-flow-hint"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6C3DE8] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_32px_-8px_rgba(108,61,232,0.55)] hover:brightness-[1.05] active:scale-[0.98] transition-all disabled:opacity-50"
                    disabled={loading}
                  >
                    <span className="material-symbols-outlined text-[18px]">link</span>
                    Connect suppliers
                  </button>
                  <span id="connect-flow-hint" className="sr-only">
                    Opens the next supplier row that isn&apos;t connected yet
                  </span>
                  <Link
                    href="/search"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-600 hover:border-[#6C3DE8]/35 hover:text-[#6C3DE8] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">search</span>
                    Browse catalogue
                  </Link>
                </div>

                <div className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-slate-100 bg-slate-50/90 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6C3DE8]/15">
                    <span className="material-symbols-outlined text-[16px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>business</span>
                  </div>
                  <div className="text-left leading-tight">
                    <span className="block text-[13px] font-bold text-[#151121]">{clinic.clinic_name}</span>
                    <span className="text-xs text-slate-400">{clinic.email}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 lg:flex-col lg:gap-4 flex-shrink-0">
                <div className="flex-1 sm:flex-none rounded-2xl bg-[#6C3DE8]/[0.06] ring-1 ring-[#6C3DE8]/15 px-6 py-5 text-center min-w-[118px]">
                  <p className="text-3xl font-extrabold tabular-nums text-[#6C3DE8]">{connectedCount}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Connected</p>
                </div>
                <div className="flex-1 sm:flex-none rounded-2xl bg-white/90 ring-1 ring-slate-200/70 px-6 py-5 text-center min-w-[118px] shadow-sm">
                  <p className="text-3xl font-extrabold tabular-nums text-slate-700">{totalCount}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Available</p>
                </div>
              </div>
            </div>
          </div>

          {/* Banner */}
          {!loading && justConnectedId != null && (
            <div className="mb-6 rounded-3xl bg-emerald-50/90 border border-emerald-100 px-6 py-4 flex flex-wrap items-start gap-3 shadow-sm">
              <span className="material-symbols-outlined text-emerald-600 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-emerald-900 text-sm">Next: see your pricing</p>
                <p className="text-sm text-emerald-800/90 mt-0.5">
                  Open the{" "}
                  <Link href="/" className="font-bold underline decoration-emerald-300 hover:decoration-emerald-600">
                    homepage
                  </Link>{" "}
                  while logged in — Best Sellers cards load your negotiated prices for connected suppliers. You can keep adding suppliers below anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJustConnectedId(null)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {!loading && connectedCount === 0 && (
            <div className="mb-8 flex flex-wrap items-start gap-4 rounded-3xl bg-amber-50/80 backdrop-blur-sm border border-amber-100/80 px-6 py-5 shadow-[0_8px_30px_-12px_rgba(251,191,36,0.2)]">
              <span className="material-symbols-outlined text-[22px] text-amber-500 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#92400e]">Unlock your negotiated pricing</p>
                <p className="mt-1 text-sm text-amber-800/80 leading-relaxed">
                  Connect at least one supplier using the button below. Until then, search shows market prices only.
                </p>
              </div>
              <button
                type="button"
                onClick={openConnectFlow}
                className="w-full sm:w-auto flex-shrink-0 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600 transition-colors shadow-sm"
              >
                Connect suppliers
              </button>
            </div>
          )}

        <section ref={supplierSectionRef} id="supplier-list" aria-label="Supplier list" className="scroll-mt-28">

        {/* Supplier grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-white/70 bg-white/40 h-[5.25rem] animate-pulse backdrop-blur-sm" />
            ))}
          </div>
        ) : allSuppliers.length === 0 ? (
          <div className="rounded-3xl border border-white bg-white/90 backdrop-blur-sm shadow-[0_20px_60px_-24px_rgba(15,23,42,0.12)] px-8 py-16 sm:py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#6C3DE8]/10 ring-8 ring-[#6C3DE8]/[0.04]">
              <span className="material-symbols-outlined text-[40px] text-[#6C3DE8]">storefront</span>
            </div>
            <p className="text-xl font-bold text-[#151121]">No suppliers yet</p>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-slate-500 leading-relaxed">
              Suppliers will appear here once they&apos;re on the Dentago network. Ask your admin to activate suppliers — then refresh this page and use <strong>Connect suppliers</strong>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {allSuppliers.map(supplier => {
              const isConnected = !!credentials[supplier.id];
              const isExpanded = expanded === supplier.id;
              const isSaving = saving === supplier.id;
              const isDeleting = deleting === supplier.id;
              const meta = SUPPLIER_META[supplier.name];
              const domain = meta?.domain ?? supplier.website?.replace(/https?:\/\//, "") ?? supplier.name.toLowerCase().replace(/\s+/g, "") + ".co.uk";
              const f = form[supplier.id] ?? { username: "", password: "" };
              const fb = feedback?.id === supplier.id ? feedback : null;

              return (
                <div
                  key={supplier.id}
                  className={`rounded-3xl border bg-white/90 backdrop-blur-sm transition-all duration-200 overflow-hidden shadow-[0_12px_40px_-24px_rgba(15,23,42,0.12)] ${
                    isConnected
                      ? "border-[#6C3DE8]/25 ring-1 ring-[#6C3DE8]/15"
                      : "border-white/90 ring-1 ring-slate-100/90"
                  }`}
                >
                  {/* Card row */}
                  <div className="flex items-center gap-4 px-5 sm:px-6 py-5">
                    <SupplierLogo name={supplier.name} domain={domain} />

                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[#151121]">{supplier.name}</p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{domain}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isConnected && (
                        <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                          <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          Connected
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(supplier.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          isExpanded
                            ? "bg-slate-100 text-slate-600"
                            : isConnected
                              ? "bg-[#6C3DE8]/8 text-[#6C3DE8] hover:bg-[#6C3DE8]/15"
                              : "bg-[#6C3DE8] text-white hover:brightness-110 shadow-sm shadow-[#6C3DE8]/25"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {isExpanded ? "expand_less" : isConnected ? "edit" : "add_link"}
                        </span>
                        {isExpanded ? "Cancel" : isConnected ? "Update" : "Connect"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded login form */}
                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-slate-50">
                      <p className="text-xs text-slate-400 font-medium mt-4 mb-4">
                        Use the same login you use on{" "}
                        {meta?.loginUrl ? (
                          <a href={meta.loginUrl} target="_blank" rel="noopener noreferrer" className="text-[#6C3DE8] font-bold hover:underline">
                            {supplier.name}&apos;s website ↗
                          </a>
                        ) : (
                          <span className="font-bold text-slate-600">{supplier.name}&apos;s website</span>
                        )}
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                            Email or username from supplier site
                          </label>
                          <input
                            type="text"
                            autoComplete="username"
                            enterKeyHint="next"
                            value={f.username}
                            onChange={e =>
                              setForm(prev => ({
                                ...prev,
                                [supplier.id]: { ...f, username: e.target.value },
                              }))
                            }
                            placeholder={
                              supplier.name === "Henry Schein"
                                ? "Customer number or portal email"
                                : "Usually your trade portal email"
                            }
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#151121] placeholder:text-slate-300 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Password</label>
                          <input
                            type="password"
                            autoComplete="current-password"
                            enterKeyHint="done"
                            value={f.password}
                            onChange={e =>
                              setForm(prev => ({
                                ...prev,
                                [supplier.id]: { ...f, password: e.target.value },
                              }))
                            }
                            placeholder="Portal password — not Dentago password"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#151121] placeholder:text-slate-300 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
                          />
                        </div>
                      </div>

                      {fb && (
                        <p className={`text-xs font-bold mt-3 flex items-center gap-1.5 ${fb.ok ? "text-emerald-600" : "text-rose-500"}`}>
                          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {fb.ok ? "check_circle" : "error"}
                          </span>
                          {fb.msg}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={() => saveCredentials(supplier.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 bg-[#6C3DE8] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 shadow-sm shadow-[#6C3DE8]/25"
                        >
                          {isSaving ? (
                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15" />
                            </svg>
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                          )}
                          {isSaving ? "Saving…" : isConnected ? "Update Credentials" : "Save & Connect"}
                        </button>

                        {isConnected && (
                          <button
                            onClick={() => disconnect(supplier.id)}
                            disabled={isDeleting}
                            className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15" />
                              </svg>
                            ) : (
                              <span className="material-symbols-outlined text-[14px]">link_off</span>
                            )}
                            Disconnect
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-300 mt-4 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">lock</span>
                        AES-256 encrypted · Never stored in plain text · Never shared
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        </section>

        {/* CTA */}
        <div className="mt-10 rounded-3xl border border-white/80 bg-white/70 backdrop-blur-md shadow-[0_20px_50px_-20px_rgba(108,61,232,0.15)] p-7 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#6C3DE8]/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
            </div>
            <div>
              <p className="font-extrabold text-[#151121]">
                {connectedCount === 0
                  ? "Ready to compare prices?"
                  : `${connectedCount} supplier${connectedCount !== 1 ? "s" : ""} connected — you're set`}
              </p>
              <p className="text-sm text-slate-400 mt-0.5">
                {connectedCount === 0
                  ? "Connect suppliers you order from — we use them to fetch your account pricing where live scrapers are enabled (Best Sellers on home first)."
                  : "Homepage Best Sellers + other live views use your connected logins; full marketplace search is integrating the same path."}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0 w-full sm:w-auto">
            {connectedCount === 0 && allSuppliers.length > 0 && (
              <button
                type="button"
                onClick={openConnectFlow}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6C3DE8] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(108,61,232,0.45)] hover:brightness-[1.05] transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">link</span>
                Connect suppliers
              </button>
            )}
            <Link
              href="/search"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-white px-6 py-3 text-sm font-bold text-[#151121] hover:border-[#6C3DE8]/30 hover:text-[#6C3DE8] transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">search</span>
              Search Products
            </Link>
          </div>
        </div>

        </div>
      </div>
    </div>
  );
}
