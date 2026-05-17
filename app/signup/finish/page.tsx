"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser, clearAuth, saveAuth } from "@/lib/auth";
import { SignupTopoBackground, signupShellClass, useSignupTheme } from "@/components/signup/SignupChrome";
import { cn } from "@/lib/utils";


export default function SignupFinishPage() {
  const router = useRouter();
  const { isDark } = useSignupTheme();
  const [ready, setReady] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [practiceType, setPracticeType] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabaseBrowser!.auth.getSession();
      if (cancelled) return;
      if (!session?.access_token) {
        router.replace(`/login?next=${encodeURIComponent("/signup/finish")}`);
        return;
      }
      const me = await fetch("/api/clinic/me", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (cancelled) return;
      if (me.ok) {
        const body = (await me.json()) as { clinic?: { id: string; clinic_name: string; email: string; product_plan?: "free" | "pro" } };
        if (body.clinic?.id) {
          saveAuth(session.access_token, body.clinic);
          // Check if they've placed their first order yet
          const onbRes = await fetch("/api/clinic/onboarding", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (onbRes.ok) {
            const onbData = (await onbRes.json()) as { steps?: { id: string; completed: boolean }[] };
            const orderDone = onbData.steps?.find((s) => s.id === "place_order")?.completed;
            router.replace(orderDone ? "/dashboard" : "/dashboard/onboarding");
          } else {
            router.replace("/dashboard/onboarding");
          }
          return;
        }
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = clinicName.trim();
    if (name.length < 2) {
      setError("Enter your practice name to continue.");
      return;
    }
    const { data: { session } } = await supabaseBrowser!.auth.getSession();
    if (!session?.access_token) {
      router.replace(`/login?next=${encodeURIComponent("/signup/finish")}`);
      return;
    }
    setBusy(true);
    // Set password if provided so team members can log in without magic links
    if (password.length >= 8) {
      await supabaseBrowser!.auth.updateUser({ password });
    }
    const res = await fetch("/api/auth/complete-clinic", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ clinic_name: name }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j?.error === "string" ? j.error : "Could not create workspace. Try again.");
      return;
    }
    const body = (await res.json()) as { clinic?: { id: string; clinic_name: string; email: string; product_plan?: "free" | "pro" } };
    if (body.clinic?.id && session.access_token) {
      saveAuth(session.access_token, body.clinic as { id: string; clinic_name: string; email: string });
    }
    router.replace("/dashboard/onboarding");
  }

  if (!ready) {
    return (
      <div className={signupShellClass(isDark)}>
        <SignupTopoBackground />
        <main className="relative z-10 flex min-h-[50vh] items-center justify-center px-4">
          <p className={cn("text-sm font-medium", isDark ? "text-[var(--dc-muted)]" : "text-neutral-500")}>Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className={signupShellClass(isDark)}>
      <SignupTopoBackground />

      <main className="relative z-10 flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-4 pb-16 pt-6">
        <div className="dentago-signup-finish w-full max-w-[440px]">

          {/* Header */}
          <div className="mb-7 text-center">
            <p className={cn("text-[10px] font-bold uppercase tracking-[0.18em] mb-2", isDark ? "text-[var(--dc-muted)]" : "text-neutral-400")}>
              One last step
            </p>
            <h1 className={cn("text-2xl font-bold tracking-tight", isDark ? "text-[var(--dc-text)]" : "text-neutral-950")}>
              Name your workspace
            </h1>
            <p className={cn("mt-2 text-[14px] leading-relaxed", isDark ? "text-[var(--dc-muted)]" : "text-neutral-500")}>
              This is how your practice appears across Dentago. You can change it later.
            </p>
          </div>

          {/* Card */}
          <div className={cn(
            "rounded-[20px] border px-7 py-8 shadow-[0_28px_90px_-36px_rgba(15,12,25,0.2)]",
            !isDark
              ? "border-neutral-200/90 bg-white"
              : "border-[var(--dc-border)] bg-[var(--dc-surface)]/95 backdrop-blur-xl",
          )}>

            {error && (
              <div className={cn(
                "mb-5 rounded-xl px-4 py-3 text-[13px] font-medium text-center",
                !isDark ? "border border-red-200 bg-red-50 text-red-800" : "border border-red-400/25 bg-red-500/10 text-red-200",
              )}>
                {error}
              </div>
            )}

            <form onSubmit={(e) => void submit(e)} className="space-y-5">

              {/* Practice name — only required field */}
              <div>
                <label htmlFor="clinic-name" className={cn("block text-[11px] font-bold uppercase tracking-[0.14em] mb-2", isDark ? "text-[var(--dc-muted)]" : "text-neutral-400")}>
                  Practice name
                </label>
                <input
                  id="clinic-name"
                  name="organization"
                  required
                  autoFocus
                  autoComplete="organization"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. City Dental Clinic"
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-[15px] font-medium outline-none transition-[border-color,box-shadow]",
                    !isDark
                      ? "!border !border-neutral-200 !bg-white !text-neutral-900 placeholder:text-neutral-300 shadow-[inset_0_1px_2px_rgba(15,12,25,0.04)] focus:!border-[#111111]/50 focus:ring-[3px] focus:ring-[#111111]/10"
                      : "!border !border-[var(--dc-border)] !bg-black/25 !text-[var(--dc-text)] placeholder:text-[var(--dc-muted)]/40 focus:border-[rgba(195,177,225,0.35)] focus:ring-2 focus:ring-[var(--dc-accent)]/25",
                  )}
                />
              </div>

              {/* Practice type — 2×2 grid cards */}
              <div>
                <p className={cn("text-[11px] font-bold uppercase tracking-[0.14em] mb-3", isDark ? "text-[var(--dc-muted)]" : "text-neutral-400")}>
                  Practice type <span className="font-normal normal-case tracking-normal opacity-50">(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: "Private", icon: "groups", desc: "Private patients only" },
                    { type: "NHS / mixed", icon: "local_hospital", desc: "NHS or mixed practice" },
                    { type: "Specialist", icon: "biotech", desc: "Specialist referral practice" },
                    { type: "DSO / group", icon: "corporate_fare", desc: "Multiple sites" },
                  ].map(({ type, icon, desc }) => {
                    const active = practiceType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPracticeType(active ? "" : type)}
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-xl border px-4 py-3.5 text-left transition-all duration-150",
                          active
                            ? "!border-[#111111] !bg-[#111111] !text-white shadow-[0_4px_14px_rgba(17,17,17,0.2)]"
                            : isDark
                              ? "!border-[var(--dc-border)] !bg-white/[0.03] !text-[var(--dc-muted)] hover:!bg-white/[0.06]"
                              : "!border-neutral-200 !bg-neutral-50 !text-neutral-900 hover:!border-neutral-300 hover:!bg-white",
                        )}
                      >
                        <span
                          className={cn(
                            "material-symbols-outlined text-[18px]",
                            active ? "!text-white" : isDark ? "!text-[var(--dc-muted)]" : "!text-neutral-500",
                          )}
                        >
                          {icon}
                        </span>
                        <span
                          className={cn(
                            "text-[13px] font-semibold leading-none",
                            active ? "!text-white" : isDark ? "!text-[var(--dc-text)]" : "!text-neutral-800",
                          )}
                        >
                          {type}
                        </span>
                        <span className={cn("text-[11px] leading-none", active ? "!text-white/70" : "!text-neutral-500")}>
                          {desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="team-password" className={cn("block text-[11px] font-bold uppercase tracking-[0.14em] mb-2", isDark ? "text-[var(--dc-muted)]" : "text-neutral-400")}>
                  Team password <span className="font-normal normal-case tracking-normal opacity-50">(optional — lets your team log in without a link)</span>
                </label>
                <div className="relative">
                  <input
                    id="team-password"
                    name="new-password"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className={cn(
                      "w-full rounded-xl px-4 py-3 pr-12 text-[15px] font-medium outline-none transition-[border-color,box-shadow]",
                      !isDark
                        ? "!border !border-neutral-200 !bg-white !text-neutral-900 placeholder:text-neutral-300 shadow-[inset_0_1px_2px_rgba(15,12,25,0.04)] focus:border-neutral-400 focus:ring-[3px] focus:ring-neutral-900/8"
                        : "!border !border-[var(--dc-border)] !bg-black/25 !text-[var(--dc-text)] placeholder:text-[var(--dc-muted)]/40 focus:border-[rgba(195,177,225,0.35)] focus:ring-2 focus:ring-white/10",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className={cn(
                      "absolute right-3.5 top-1/2 -translate-y-1/2 !bg-transparent transition-colors",
                      !isDark ? "!text-neutral-400 hover:!text-neutral-700" : "!text-[var(--dc-muted)]",
                    )}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <span className="material-symbols-outlined text-[22px]">{showPw ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p className="mt-1.5 text-[11px] text-red-400">At least 8 characters required.</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={busy || clinicName.trim().length < 2 || (password.length > 0 && password.length < 8)}
                className="group relative mt-2 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border-0 py-3.5 text-[15px] font-bold
                  !bg-[#111111] !text-white shadow-[0_8px_28px_-8px_rgba(17,17,17,0.5)]
                  transition-all duration-200 ease-out
                  hover:-translate-y-[2px] hover:!bg-[#2d2d2d] hover:shadow-[0_16px_40px_-10px_rgba(17,17,17,0.55)]
                  active:translate-y-0 active:scale-[0.99]
                  focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#111111]/40 focus-visible:ring-offset-2
                  disabled:pointer-events-none disabled:!opacity-40 disabled:shadow-none"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full" aria-hidden />
                {busy ? (
                  <span className="relative z-[1] !text-white">Creating workspace…</span>
                ) : (
                  <>
                    <span className="relative z-[1] !text-white">Open my workspace</span>
                    <span
                      className="material-symbols-outlined relative z-[1] text-[20px] !text-white transition-transform duration-200 group-hover:translate-x-0.5"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sign out */}
          <p className={cn("mt-5 text-center text-[13px]", isDark ? "text-[var(--dc-muted)]" : "text-neutral-400")}>
            Wrong account?{" "}
            <button
              type="button"
              onClick={() => void clearAuth().then(() => router.push("/login?next=%2Fsignup%2Ffinish"))}
              className="!bg-transparent font-semibold !text-[#111111] hover:underline dark:!text-[var(--dc-text)]"
            >
              Switch account
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
