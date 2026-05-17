"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { saveAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
const LOGIN_THEME_KEY = "dentago_login_theme";

function LoginWaveBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_70%_at_50%_-8%,rgba(17,17,17,0.065),transparent_52%)]"
        aria-hidden
      />
      <svg
        className="pointer-events-none absolute left-1/2 top-[42%] h-[min(92vh,880px)] w-[min(92vw,880px)] -translate-x-1/2 -translate-y-1/2 text-neutral-950/[0.045]"
        viewBox="0 0 800 800"
        fill="none"
        aria-hidden
      >
        <circle cx="400" cy="400" r="220" stroke="currentColor" strokeWidth="1" />
        <circle cx="400" cy="400" r="310" stroke="currentColor" strokeWidth="1" />
        <circle cx="400" cy="400" r="400" stroke="currentColor" strokeWidth="1" />
        <ellipse cx="400" cy="560" rx="520" ry="180" stroke="currentColor" strokeWidth="0.75" opacity="0.85" />
        <ellipse cx="400" cy="620" rx="620" ry="220" stroke="currentColor" strokeWidth="0.6" opacity="0.65" />
      </svg>
    </>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-[linear-gradient(180deg,#fafafa_0%,#f0f2f6_100%)]">
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="relative w-full max-w-[400px]">
          <div className="h-[460px] w-full rounded-[22px] bg-white/70 shadow-xl shadow-neutral-900/[0.06] ring-1 ring-neutral-200/80 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthReturning, setOauthReturning] = useState(false);
  const [appearance, setAppearance] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOGIN_THEME_KEY);
      if (saved === "dark" || saved === "light") setAppearance(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearance((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(LOGIN_THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const supabase = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    [],
  );

  const isAuthCallbackUrl = useCallback(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash ?? "";
    const qp = new URLSearchParams(window.location.search);
    return (
      hash.includes("access_token") ||
      hash.includes("refresh_token") ||
      hash.includes("error") ||
      qp.has("code") ||
      qp.get("from_oauth") === "1"
    );
  }, []);

  const stripAuthFragmentsFromUrl = useCallback(() => {
    const qp = new URLSearchParams(window.location.search ?? "");
    qp.delete("from_oauth");
    const qs = qp.toString();
    const path = "/login" + (qs ? `?${qs}` : "");
    window.history.replaceState({}, "", path);
    router.replace(path);
  }, [router]);

  const redirectAfterLogin = useCallback(
    async (_user: User, session: Session) => {
      const rawNext = searchParams.get("next");
      const safeNext =
        rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes(":")
          ? rawNext
          : null;

      const goDashboard = (clinic: { id: string; clinic_name: string; email: string; product_plan?: "free" | "pro" }) => {
        saveAuth(session.access_token, {
          id: clinic.id,
          clinic_name: clinic.clinic_name,
          email: clinic.email,
          product_plan: clinic.product_plan,
        });
        router.replace(safeNext ?? "/dashboard");
      };

      const goOnboarding = () => {
        // Do not honour `next` without a clinic — deep links need tenant context first
        router.replace("/dashboard/onboarding");
      };

      // Prefer server-resolved clinic (service role) — browser RLS/timing can miss clinic_accounts
      // and incorrectly send users to legacy static HTML onboarding.
      const meRes = await fetch("/api/clinic/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (meRes.ok) {
        const body = (await meRes.json()) as {
          clinic?: { id: string; clinic_name: string; email: string; product_plan?: "free" | "pro" };
        };
        if (body.clinic?.id) {
          goDashboard(body.clinic);
          return;
        }
      }

      if (meRes.status === 404) {
        goOnboarding();
        return;
      }

      // Transient /api failure — one client read as fallback (same RLS as before)
      const { data: clinicAccount, error: caErr } = await supabase
        .from("clinic_accounts")
        .select("id, clinic_name, email, product_plan")
        .eq("auth_user_id", _user.id)
        .maybeSingle();

      if (!caErr && clinicAccount?.id) {
        const planRaw = (clinicAccount as { product_plan?: string | null }).product_plan;
        const product_plan = planRaw === "pro" ? "pro" : "free";
        goDashboard({
          id: clinicAccount.id,
          clinic_name: clinicAccount.clinic_name,
          email: clinicAccount.email,
          product_plan,
        });
        return;
      }

      goOnboarding();
    },
    [router, searchParams, supabase],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthCallbackUrl()) return;

    let cancelled = false;
    setOauthReturning(true);

    let unsub: (() => void) | null = null;
    let timeoutId = 0;

    const finish = async (session: Session) => {
      if (cancelled) return;
      stripAuthFragmentsFromUrl();
      setOauthReturning(false);
      await redirectAfterLogin(session.user, session);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        void finish(session);
        return;
      }
      const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!newSession || event !== "SIGNED_IN") return;
        unsub?.();
        unsub = null;
        void finish(newSession);
      });
      unsub = () => data.subscription.unsubscribe();
      timeoutId = window.setTimeout(() => {
        unsub?.();
        unsub = null;
        stripAuthFragmentsFromUrl();
        setOauthReturning(false);
      }, 12000);
    });

    return () => {
      cancelled = true;
      unsub?.();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isAuthCallbackUrl, redirectAfterLogin, stripAuthFragmentsFromUrl, supabase]);

  async function signInGoogle() {
    setError(null);
    setInfo(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/login?from_oauth=1` },
    });
    if (err) setError(err.message);
  }

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session && data.user) await redirectAfterLogin(data.user, data.session);
  }

  async function forgotPassword() {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Add your email above, then click forgot password.");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/complete`,
    });
    if (err) setError(err.message);
    else setInfo("Check your inbox for a reset link.");
  }

  const next = searchParams.get("next");
  const isDark = appearance === "dark";

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden",
        isDark
          ? "dentago-clinic-shell bg-[var(--dc-bg)] text-[var(--dc-text)] selection:bg-[var(--dc-accent)]/30"
          : "bg-[linear-gradient(180deg,#fafafa_0%,#f4f5f8_42%,#ebeef4_100%)] text-neutral-900 selection:bg-[#111111]/15",
      )}
    >
      {appearance === "light" ? (
        <LoginWaveBackdrop />
      ) : (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-[var(--dc-accent)]/[0.07] blur-[100px]" />
          <div className="absolute bottom-[-20%] left-[-15%] h-[520px] w-[520px] rounded-full bg-[#111111]/[0.06] blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:100%_48px] opacity-[0.35]" />
        </div>
      )}

      <header
        className={cn(
          "relative z-10 flex items-center justify-between gap-3 px-6 py-4 md:px-10",
          !isDark && "border-b border-neutral-200/70 bg-white/[0.42] backdrop-blur-md",
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em] transition-colors",
            !isDark ? "text-neutral-900" : "text-[var(--dc-text)]",
          )}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0e0f12] text-white text-[11px] font-black">D</span>
          Dentago
        </Link>
        <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleAppearance}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
            !isDark
              ? "border-neutral-200 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50"
              : "border-[var(--dc-border)] bg-white/[0.05] text-[var(--dc-muted)] hover:bg-white/[0.09]",
          )}
          aria-label={isDark ? "Switch to light appearance" : "Switch to dark appearance"}
        >
          <span className="material-symbols-outlined text-[20px]">{isDark ? "light_mode" : "dark_mode"}</span>
        </button>
        <Link
          href="/"
          className={cn(
            "text-[13px] font-semibold transition-colors",
            !isDark ? "text-neutral-500 hover:text-neutral-900" : "text-[var(--dc-muted)] hover:text-[var(--dc-text)]",
          )}
        >
          Back to site
        </Link>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-10">
        {(oauthReturning || busy) && (
          <p
            className={cn(
              "mb-6 text-center text-[13px] font-medium animate-pulse",
              !isDark ? "text-neutral-500" : "text-[var(--dc-muted)]",
            )}
          >
            {oauthReturning ? "Completing sign-in…" : "Signing in…"}
          </p>
        )}

        <div className="relative mx-auto w-full max-w-[400px]">
          <div
            className={cn(
              "relative rounded-[22px] px-8 pb-10 pt-10 md:px-10",
              !isDark
                ? "border border-neutral-200/90 bg-white shadow-[0_28px_90px_-36px_rgba(15,12,25,0.22)]"
                : "border border-[var(--dc-border)] bg-[var(--dc-surface)]/95 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl",
            )}
          >
            <div className="text-center">
              <h1 className={cn("text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] md:text-[1.85rem]", !isDark ? "text-neutral-950" : "text-[var(--dc-text)]")}>
                Log in to Dentago
              </h1>
              <p className={cn("mx-auto mt-2 max-w-[280px] text-[14px] leading-snug", !isDark ? "text-neutral-500" : "text-[var(--dc-muted)]")}>
                Your procurement workspace for UK dental practices.
              </p>
              {next ? (
                <p className={cn("mt-3 text-xs", !isDark ? "text-neutral-400" : "text-[var(--dc-muted)]")}>
                  You&apos;ll continue where you left off after signing in.
                </p>
              ) : null}
            </div>

            <div className="mt-9 space-y-3">
              <button
                type="button"
                onClick={signInGoogle}
                disabled={busy || oauthReturning}
                className={cn(
                  "grid w-full grid-cols-[28px_1fr_28px] items-center rounded-xl py-3 text-[14px] font-semibold transition-[background,border-color,transform] active:scale-[0.995] disabled:opacity-45",
                  !isDark
                    ? "border border-neutral-200/95 bg-white text-neutral-900 shadow-[0_1px_2px_rgba(15,12,25,0.05)] hover:border-neutral-300 hover:bg-neutral-50/90"
                    : "border border-[var(--dc-border)] bg-white/[0.04] text-[var(--dc-text)] hover:bg-white/[0.07]",
                )}
              >
                <span className="flex justify-center">
                  <svg className="h-[22px] w-[22px] shrink-0" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                </span>
                <span className="text-center">Continue with Google</span>
                <span aria-hidden className="inline-block w-[28px]" />
              </button>

              {error ? (
                <div
                  className={cn(
                    "rounded-xl px-4 py-3 text-center text-[13px] font-medium",
                    !isDark ? "border border-red-200 bg-red-50 text-red-900" : "border border-red-400/25 bg-red-500/10 text-red-200",
                  )}
                >
                  {error}
                </div>
              ) : null}
              {info ? (
                <div
                  className={cn(
                    "rounded-xl px-4 py-3 text-center text-[13px] font-medium",
                    !isDark ? "border border-emerald-200 bg-emerald-50 text-emerald-900" : "border border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
                  )}
                >
                  {info}
                </div>
              ) : null}

              <form onSubmit={signInEmail} className="space-y-3 pt-1">
                <label className="sr-only" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-[border-color,box-shadow]",
                    !isDark
                      ? "border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 shadow-[inset_0_1px_2px_rgba(15,12,25,0.04)] focus:border-[#111111]/45 focus:ring-[3px] focus:ring-[#111111]/12"
                      : "border border-[var(--dc-border)] bg-black/25 text-[var(--dc-text)] placeholder:text-[var(--dc-muted)]/55 focus:border-[rgba(195,177,225,0.35)] focus:ring-2 focus:ring-[var(--dc-accent)]/25",
                  )}
                />
                <div className="relative">
                  <label className="sr-only" htmlFor="login-password">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className={cn(
                      "w-full rounded-xl px-4 py-3 pr-12 text-[14px] outline-none transition-[border-color,box-shadow]",
                      !isDark
                        ? "border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 shadow-[inset_0_1px_2px_rgba(15,12,25,0.04)] focus:border-[#111111]/45 focus:ring-[3px] focus:ring-[#111111]/12"
                        : "border border-[var(--dc-border)] bg-black/25 text-[var(--dc-text)] placeholder:text-[var(--dc-muted)]/55 focus:border-[rgba(195,177,225,0.35)] focus:ring-2 focus:ring-[var(--dc-accent)]/25",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className={cn(
                      "absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors",
                      !isDark ? "text-neutral-400 hover:text-neutral-700" : "text-[var(--dc-muted)] hover:text-[var(--dc-accent)]",
                    )}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <span className="material-symbols-outlined text-[22px]">{showPw ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>

                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={forgotPassword}
                    className={cn(
                      "text-[12px] font-semibold hover:underline",
                      !isDark ? "text-[#111111]" : "text-[var(--dc-accent)]",
                    )}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={busy || oauthReturning}
                  style={{ backgroundColor: '#111111', color: '#fff' }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-semibold transition-[filter,transform,opacity] shadow-[0_14px_44px_-14px_rgba(17,17,17,0.55)] hover:brightness-[1.08] active:scale-[0.99] disabled:opacity-50"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2d2d2d'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#111111'; }}
                >
                  {busy ? "Signing in…" : "Sign in"}
                  {!busy ? <span className="material-symbols-outlined text-[20px]">login</span> : null}
                </button>
              </form>
            </div>

            <p className={cn("mt-9 text-center text-[13px]", !isDark ? "text-neutral-500" : "text-[var(--dc-muted)]")}>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className={cn("font-semibold hover:underline", !isDark ? "text-[#2563eb]" : "text-[var(--dc-accent)]")}>
                Sign up
              </Link>
            </p>

            <p
              className={cn(
                "mx-auto mt-6 max-w-[320px] text-center text-[11px] leading-relaxed",
                !isDark ? "text-neutral-500" : "text-[var(--dc-muted)]/85",
              )}
            >
              By using Dentago, you agree to our{" "}
              <Link href="/privacy" className={cn("font-semibold underline-offset-2 hover:underline", !isDark ? "text-neutral-700" : "text-[var(--dc-text)]")}>
                privacy policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className={cn("font-semibold underline-offset-2 hover:underline", !isDark ? "text-neutral-700" : "text-[var(--dc-text)]")}>
                terms of service
              </Link>
              .
            </p>
          </div>
        </div>

        <p className={cn("mt-10 max-w-md px-2 text-center text-[11px] leading-relaxed", !isDark ? "text-neutral-400" : "text-[var(--dc-muted)]/75")}>
          Need help?{" "}
          <a href="mailto:mercier@dentago.co.uk" className={cn("underline-offset-2 hover:underline", !isDark ? "text-neutral-600" : "text-[var(--dc-accent)]/90")}>
            mercier@dentago.co.uk
          </a>
        </p>

        <Link
          href="/"
          className={cn("mt-6 text-[13px] font-semibold sm:hidden", !isDark ? "text-neutral-500 hover:text-neutral-900" : "text-[var(--dc-muted)]")}
        >
          ← Back to site
        </Link>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginInner />
    </Suspense>
  );
}
