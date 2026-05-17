"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser, getClinic, getFreshToken } from "@/lib/auth";
import { SupplierIntegrationsPanel } from "@/components/SupplierIntegrationsPanel";

type Clinic = { id: string; clinic_name: string; email: string; product_plan?: "free" | "pro" };

type TabId = "workspace" | "members" | "integrations" | "notifications" | "security" | "appearance";

const TABS: { id: TabId; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "members", label: "Members" },
  { id: "integrations", label: "Integrations" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "appearance", label: "Appearance" },
];

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function SettingsCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-surface)] shadow-[0_20px_70px_-24px_rgba(14,15,18,0.14)]">
      <div className="px-6 py-5 border-b border-[var(--dc-border)]">
        <h3 className="text-[13px] font-semibold text-[var(--dc-text)]">{title}</h3>
      </div>
      <div className="px-6 py-6">{children}</div>
      {footer ? <div className="px-6 py-5 border-t border-[var(--dc-border)]">{footer}</div> : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dc-muted)]">{label}</p>
        {hint ? <p className="text-xs text-[var(--dc-muted)]">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, disabled }: { value: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      className={clsx(
        "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors",
        "bg-[var(--dc-surface)] text-[var(--dc-text)]",
        "border-[var(--dc-border)] focus:border-[var(--dc-accent-strong)]/50 focus:ring-2 focus:ring-[var(--dc-accent-strong)]/15",
        disabled && "opacity-70 cursor-not-allowed",
      )}
    />
  );
}

function PillButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-[rgba(17,17,17,0.12)] text-[var(--dc-text)] shadow-[inset_0_0_0_1px_rgba(17,17,17,0.22)]"
          : "bg-black/[0.04] text-[var(--dc-muted)] hover:bg-black/[0.06] hover:text-[var(--dc-text)]",
      )}
    >
      {children}
    </button>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const t = localStorage.getItem("dentago_theme");
      if (t === "dark") setTheme("dark");
      else setTheme("light");
    } catch {
      /* ignore */
    }
  }, []);

  function apply(next: "light" | "dark") {
    setTheme(next);
    try {
      localStorage.setItem("dentago_theme", next);
    } catch {
      /* ignore */
    }
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = next === "dark" ? "dark" : "light";
  }

  return (
    <div className="flex flex-wrap gap-2">
      <PillButton active={theme === "light"} onClick={() => apply("light")}>
        <span className="material-symbols-outlined text-[18px]">light_mode</span>
        Light
      </PillButton>
      <PillButton active={theme === "dark"} onClick={() => apply("dark")}>
        <span className="material-symbols-outlined text-[18px]">dark_mode</span>
        Dark
      </PillButton>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 md:px-10 py-8 md:py-10">
          <div className="max-w-5xl space-y-4">
            <div className="h-10 w-64 bg-black/[0.04] rounded-2xl animate-pulse" />
            <div className="h-40 rounded-3xl bg-black/[0.04] animate-pulse" />
          </div>
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const activeTab: TabId = useMemo(() => {
    const t = (sp.get("tab") ?? "workspace") as TabId;
    return TABS.some((x) => x.id === t) ? t : "workspace";
  }, [sp]);

  const fromOnboarding = sp.get("from") === "onboarding";

  useEffect(() => {
    if (!fromOnboarding || activeTab !== "integrations") return;
    const id = window.setTimeout(() => {
      router.replace("/settings?tab=integrations", { scroll: false });
    }, 900);
    return () => window.clearTimeout(id);
  }, [fromOnboarding, activeTab, router]);

  const [clinic, setClinicState] = useState<Clinic | null>(() => getClinic());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const [clinicName, setClinicName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const tok = await getFreshToken();
      if (!tok) {
        router.replace("/login?next=/settings");
        return;
      }
      const res = await fetch("/api/clinic/me", { headers: { Authorization: `Bearer ${tok}` } });
      const body = (await res.json().catch(() => ({}))) as { clinic?: Clinic };
      if (cancelled) return;
      if (!res.ok || !body.clinic) {
        router.replace("/login?next=/settings");
        return;
      }
      setClinicState(body.clinic);
      setClinicName(body.clinic.clinic_name ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function saveWorkspace() {
    setStatus(null);
    setSaving(true);
    try {
      const tok = await getFreshToken();
      if (!tok) {
        router.replace("/login?next=/settings");
        return;
      }
      const res = await fetch("/api/clinic/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ clinic_name: clinicName }),
      });
      const body = (await res.json().catch(() => ({}))) as { clinic?: Clinic; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to save.");
      if (body.clinic) setClinicState(body.clinic);
      setStatus({ ok: true, msg: "Saved." });
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? "Failed to save." });
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    setStatus(null);
    if (!clinic?.email) {
      setStatus({ ok: false, msg: "No email on file for this account." });
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabaseBrowser!.auth.resetPasswordForEmail(clinic.email.trim(), {
      redirectTo: `${origin}/auth/complete`,
    });
    if (error) setStatus({ ok: false, msg: error.message });
    else setStatus({ ok: true, msg: "Password reset email sent." });
  }

  return (
    <div className="px-6 md:px-10 py-8 md:py-10">
      <div className="max-w-5xl">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dc-muted)]">
              Settings
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--dc-text)] mt-2">
              Workspace settings
            </h1>
            <p className="text-sm text-[var(--dc-muted)] mt-2 max-w-xl leading-relaxed">
              Manage your practice workspace, integrations and preferences.
            </p>
            <div className="mt-4 md:hidden">
              <Link
                href="/settings?tab=integrations"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 transition-colors hover:bg-[#020617] dark:bg-white dark:text-[#0f172a] dark:ring-white/25 dark:hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px] text-white dark:text-[#0f172a]">link</span>
                Manage supplier logins
              </Link>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Link
              href="/settings?tab=integrations"
              className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 transition-colors hover:bg-[#020617] dark:bg-white dark:text-[#0f172a] dark:ring-white/25 dark:hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-[18px] text-white dark:text-[#0f172a]">link</span>
              Manage supplier logins
            </Link>
          </div>
        </div>

        <div className="border-b border-[var(--dc-border)] mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {TABS.map((t) => {
              const on = t.id === activeTab;
              return (
                <Link
                  key={t.id}
                  href={`/settings?tab=${t.id}`}
                  className={clsx(
                    "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
                    on
                      ? "bg-[var(--dc-surface)] text-[var(--dc-text)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.10)]"
                      : "text-[var(--dc-muted)] hover:bg-black/[0.04] hover:text-[var(--dc-text)]",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>

        {status ? (
          <div
            className={clsx(
              "mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold",
              status.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900",
            )}
          >
            {status.msg}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            <div className="h-36 rounded-3xl bg-black/[0.04] animate-pulse" />
            <div className="h-56 rounded-3xl bg-black/[0.04] animate-pulse" />
          </div>
        ) : activeTab === "workspace" ? (
          <div className="space-y-6">
            <SettingsCard
              title="Workspace configuration"
              footer={
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--dc-muted)]">
                    Changes apply to this workspace immediately.
                  </p>
                  <button
                    type="button"
                    onClick={saveWorkspace}
                    disabled={saving}
                    className={clsx(
                      "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-all",
                      saving
                        ? "bg-black/20 text-white cursor-not-allowed"
                        : "bg-[var(--dc-text)] text-white hover:brightness-110 active:scale-[0.98]",
                    )}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              }
            >
              <div className="space-y-5">
                <Field label="Workspace name">
                  <Input value={clinicName} onChange={setClinicName} />
                </Field>
                <Field label="Workspace email" hint="Used for receipts and account recovery">
                  <Input value={clinic?.email ?? ""} disabled />
                </Field>
                <Field label="Plan">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-4 py-2 text-sm font-semibold text-[var(--dc-text)]">
                      <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                      {clinic?.product_plan === "pro" ? "Dentago Pro" : "Free"}
                    </span>
                    {clinic?.product_plan !== "pro" ? (
                      <Link
                        href="/upgrade?from=settings"
                        className="text-sm font-semibold text-[var(--dc-accent-strong)] hover:underline"
                      >
                        Upgrade
                      </Link>
                    ) : null}
                  </div>
                </Field>
              </div>
            </SettingsCard>
          </div>
        ) : activeTab === "integrations" ? (
          <div className={clsx("space-y-6", fromOnboarding && "dentago-integrations-enter")}>
            <SupplierIntegrationsPanel embedded />
          </div>
        ) : activeTab === "security" ? (
          <div className="space-y-6">
            <SettingsCard
              title="Security"
              footer={
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={sendPasswordReset}
                    className="inline-flex items-center gap-2 rounded-full bg-black/[0.05] hover:bg-black/[0.07] text-[var(--dc-text)] px-5 py-2.5 text-sm font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                    Send password reset email
                  </button>
                </div>
              }
            >
              <p className="text-sm text-[var(--dc-muted)] leading-relaxed">
                Password resets are sent to your workspace email. The link will open Dentago and complete on{" "}
                <span className="font-semibold text-[var(--dc-text)]">/auth/complete</span>.
              </p>
            </SettingsCard>
          </div>
        ) : activeTab === "appearance" ? (
          <div className="space-y-6">
            <SettingsCard title="Theme">
              <p className="text-sm text-[var(--dc-muted)] leading-relaxed mb-5">
                Choose how Dentago looks on this device.
              </p>
              <ThemeToggle />
            </SettingsCard>
          </div>
        ) : (
          <div className="space-y-6">
            <SettingsCard title="Coming soon">
              <p className="text-sm text-[var(--dc-muted)] leading-relaxed">
                This settings section is being built. If you need this urgently, message{" "}
                <a className="font-semibold text-[var(--dc-accent-strong)] hover:underline" href="mailto:mercier@dentago.co.uk">
                  mercier@dentago.co.uk
                </a>
                .
              </p>
            </SettingsCard>
          </div>
        )}
      </div>
    </div>
  );
}

