"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getClinic, getToken, clearAuth, freshAuthHeaders } from "@/lib/auth";

type Supplier = { id: number; name: string; website?: string };

type SavedCred = {
  id: string;
  supplier_id: number;
  username: string;
  last_synced?: string;
  dentago_suppliers: { id: number; name: string };
};

// Map supplier name → their login portal URL + logo
const SUPPLIER_META: Record<string, { domain: string; loginUrl: string; logo: string }> = {
  "Henry Schein": {
    domain: "henryschein.co.uk",
    loginUrl: "https://www.henryschein.co.uk/gb-en/dental/Account/Login",
    logo: "https://www.henryschein.co.uk/images/hs-logo.png",
  },
  "Dental Sky": {
    domain: "dentalsky.com",
    loginUrl: "https://www.dentalsky.com/customer/account/login",
    logo: "https://www.dentalsky.com/skin/frontend/sm_market/default/images/logo.png",
  },
  "Kent Express": {
    domain: "kentexpress.co.uk",
    loginUrl: "https://www.kentexpress.co.uk/login",
    logo: "https://www.kentexpress.co.uk/images/kent-express-logo.png",
  },
  "Dental Directory": {
    domain: "dental-directory.co.uk",
    loginUrl: "https://www.dental-directory.co.uk/login",
    logo: "https://www.dental-directory.co.uk/images/logo.png",
  },
  "Clark Dental": {
    domain: "clarkdental.co.uk",
    loginUrl: "https://www.clarkdental.co.uk/login",
    logo: "https://www.clarkdental.co.uk/images/logo.png",
  },
  "Trycare": {
    domain: "trycare.co.uk",
    loginUrl: "https://www.trycare.co.uk/login",
    logo: "https://www.trycare.co.uk/images/trycare-logo.png",
  },
  "Optident": {
    domain: "optident.co.uk",
    loginUrl: "https://optident.co.uk/login",
    logo: "https://optident.co.uk/wp-content/uploads/2020/01/optident-logo.png",
  },
  "DHB": {
    domain: "dhb-dental.com",
    loginUrl: "https://www.dhb-dental.com/account/login",
    logo: "https://www.dhb-dental.com/images/logo.png",
  },
  "Amalgadent": {
    domain: "amalgadent.com",
    loginUrl: "https://www.amalgadent.com/login",
    logo: "https://www.amalgadent.com/images/logo.png",
  },
  "Wrights": {
    domain: "wrightsdentals.com",
    loginUrl: "https://www.wrightsdentals.com/login",
    logo: "https://www.wrightsdentals.com/images/logo.png",
  },
  "DMI": {
    domain: "dmiuk.com",
    loginUrl: "https://www.dmiuk.com/login",
    logo: "https://www.dmiuk.com/images/logo.png",
  },
};

function SupplierLogo({ name, domain }: { name: string; domain: string }) {
  const [err, setErr] = useState(false);
  const meta = SUPPLIER_META[name];
  const src = (!err && meta?.logo) ? meta.logo : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  return (
    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5">
      <Image
        src={src}
        alt={name}
        width={40}
        height={40}
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

  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  // supplier_id → saved credential (means connected)
  const [credentials, setCredentials] = useState<Record<number, SavedCred>>({});
  const [loading, setLoading] = useState(true);
  // Which supplier card is expanded for login entry
  const [expanded, setExpanded] = useState<number | null>(null);
  // Form state per supplier: username + password
  const [form, setForm] = useState<Record<number, { username: string; password: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ id: number; ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!token) { router.push("/onboarding/login.html"); return; }

    Promise.all([
      fetch("/api/suppliers").then(r => r.json()),
      fetch("/api/clinic/credentials", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ]).then(([suppliersData, credsData]) => {
      setAllSuppliers(suppliersData.suppliers ?? []);
      const map: Record<number, SavedCred> = {};
      (credsData.credentials ?? []).forEach((c: SavedCred) => {
        map[c.supplier_id] = c;
      });
      setCredentials(map);
    }).finally(() => setLoading(false));
  }, [token, router]);

  function toggleExpand(id: number) {
    setExpanded(prev => prev === id ? null : id);
    // Pre-fill username if already connected
    if (credentials[id] && !form[id]) {
      setForm(prev => ({ ...prev, [id]: { username: credentials[id].username, password: "" } }));
    }
  }

  async function saveCredentials(supplierId: number) {
    const f = form[supplierId];
    if (!f?.username || !f?.password) {
      setFeedback({ id: supplierId, ok: false, msg: "Email and password are required" });
      return;
    }
    setSaving(supplierId);
    setFeedback(null);
    try {
      const headers = await freshAuthHeaders();
      const res = await fetch("/api/clinic/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ supplierId, username: f.username, password: f.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ id: supplierId, ok: false, msg: data.error ?? "Failed to save" });
      } else {
        // Mark connected
        setCredentials(prev => ({
          ...prev,
          [supplierId]: { id: "", supplier_id: supplierId, username: f.username, dentago_suppliers: { id: supplierId, name: "" } },
        }));
        setForm(prev => ({ ...prev, [supplierId]: { ...prev[supplierId], password: "" } }));
        setFeedback({ id: supplierId, ok: true, msg: "Credentials saved" });
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

  if (!clinic) return null;

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121]">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 px-4 h-14 max-w-3xl mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</Link>
          <span className="text-slate-300 font-light">/</span>
          <span className="text-sm font-bold text-slate-600">Connect Suppliers</span>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/search" className="flex items-center gap-1.5 text-xs font-bold text-[#6C3DE8] border border-[#6C3DE8]/30 bg-[#6C3DE8]/5 px-3 py-1.5 rounded-xl hover:bg-[#6C3DE8]/10 transition-all">
              <span className="material-symbols-outlined text-[14px]">search</span>
              Search Products
            </Link>
            <button onClick={() => { clearAuth(); router.push("/"); }} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="pt-14 max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-[#151121] mb-1">Connect Your Suppliers</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Enter the login you use on each supplier&apos;s website. Dentago uses these to pull your negotiated pricing in real time — your credentials are encrypted and never shared.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#6C3DE8]/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[16px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>business</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#151121]">{clinic.clinic_name}</p>
              <p className="text-xs text-slate-400">{clinic.email}</p>
            </div>
            <span className="ml-auto text-sm font-bold text-[#6C3DE8]">
              {connectedCount} of {allSuppliers.length} connected
            </span>
          </div>
        </div>

        {!loading && connectedCount === 0 && (
          <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
            <span className="material-symbols-outlined text-[20px] text-amber-500 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            <div>
              <p className="text-sm font-bold text-amber-800">No suppliers connected yet</p>
              <p className="text-xs text-amber-600 mt-0.5">Connect at least one supplier to see your negotiated pricing. Until then, search shows all market prices.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
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
                  className={`bg-white rounded-2xl border transition-all duration-200 ${
                    isConnected ? "border-[#6C3DE8]/25 shadow-sm shadow-[#6C3DE8]/5" : "border-slate-100"
                  }`}
                >
                  {/* Row */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <SupplierLogo name={supplier.name} domain={domain} />

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#151121]">{supplier.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Supplier</p>
                    </div>

                    {isConnected && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full flex-shrink-0">
                        <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        Connected
                      </span>
                    )}

                    <button
                      onClick={() => toggleExpand(supplier.id)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        isExpanded
                          ? "bg-slate-100 text-slate-600"
                          : isConnected
                            ? "bg-[#6C3DE8]/8 text-[#6C3DE8] hover:bg-[#6C3DE8]/14"
                            : "bg-[#6C3DE8] text-white hover:brightness-110 shadow-sm shadow-[#6C3DE8]/30"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isExpanded ? "expand_less" : isConnected ? "edit" : "add_link"}
                      </span>
                      {isExpanded ? "Cancel" : isConnected ? "Update" : "Connect"}
                    </button>
                  </div>

                  {/* Expanded login form */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-50">
                      <p className="text-xs text-slate-400 font-medium mt-4 mb-3">
                        Enter your <span className="font-bold text-slate-600">{supplier.name}</span> login credentials — the same ones you use on their website.
                        {meta?.loginUrl && (
                          <> <a href={meta.loginUrl} target="_blank" rel="noopener noreferrer" className="text-[#6C3DE8] hover:underline">Open {supplier.name} →</a></>
                        )}
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Account Email / Username</label>
                          <input
                            type="email"
                            value={f.username}
                            onChange={e => setForm(prev => ({ ...prev, [supplier.id]: { ...f, username: e.target.value } }))}
                            placeholder="your@email.com"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#151121] placeholder:text-slate-300 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Password</label>
                          <input
                            type="password"
                            value={f.password}
                            onChange={e => setForm(prev => ({ ...prev, [supplier.id]: { ...f, password: e.target.value } }))}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#151121] placeholder:text-slate-300 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
                          />
                        </div>
                      </div>

                      {fb && (
                        <p className={`text-xs font-bold mt-3 ${fb.ok ? "text-emerald-600" : "text-rose-500"}`}>
                          {fb.ok ? "✓ " : "✗ "}{fb.msg}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={() => saveCredentials(supplier.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 bg-[#6C3DE8] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 shadow-sm shadow-[#6C3DE8]/25"
                        >
                          {isSaving ? (
                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/></svg>
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
                              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/></svg>
                            ) : (
                              <span className="material-symbols-outlined text-[14px]">link_off</span>
                            )}
                            Disconnect
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-300 mt-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">lock</span>
                        Encrypted with AES-256. Never stored in plain text. Never shared.
      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-[#6C3DE8] text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-md shadow-[#6C3DE8]/20"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            Search with My Suppliers
          </Link>
          <p className="text-xs text-slate-400 mt-3">
            {connectedCount === 0
              ? "You'll see all market prices until you connect a supplier"
              : `Prices filtered to ${connectedCount} connected supplier${connectedCount !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}
