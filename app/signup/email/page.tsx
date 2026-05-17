"use client";

import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/auth";
import { SignupTopoBackground, signupShellClass, useSignupTheme } from "@/components/signup/SignupChrome";
import { cn } from "@/lib/utils";

export default function SignupEmailPage() {
  const { isDark } = useSignupTheme();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }
    setBusy(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: err } = await supabaseBrowser!.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${origin}/auth/complete`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className={signupShellClass(isDark)}>
      <SignupTopoBackground />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pb-16 pt-6">
        <div
          className={cn(
            "w-full max-w-[420px] rounded-2xl border px-7 pb-8 pt-10 shadow-[0_24px_80px_-32px_rgba(15,12,25,0.22)] md:rounded-[20px] md:px-9 md:pb-10 md:pt-11",
            !isDark ? "border-neutral-200/90 bg-white" : "border-[var(--dc-border)] bg-[var(--dc-surface)]/95 backdrop-blur-xl",
          )}
        >
          <div className="text-center">
            <p className={cn("text-lg font-semibold tracking-tight", isDark ? "text-[var(--dc-text)]" : "text-neutral-900")}>Receive a link to sign up</p>
            <p className={cn("mx-auto mt-2 max-w-[320px] text-[13px] leading-relaxed", isDark ? "text-[var(--dc-muted)]" : "text-neutral-500")}>
              Enter your email for a secure magic link to start using Dentago. No password to remember.
            </p>
          </div>

          {error ? (
            <div
              className={cn(
                "mt-5 rounded-xl px-4 py-3 text-center text-[13px] font-medium",
                !isDark ? "border border-red-200 bg-red-50 text-red-900" : "border border-red-400/25 bg-red-500/10 text-red-200",
              )}
            >
              {error}
            </div>
          ) : null}

          {sent ? (
            <div
              className={cn(
                "mt-6 rounded-xl px-4 py-4 text-center text-[13px] font-medium leading-relaxed",
                !isDark ? "border border-emerald-200 bg-emerald-50 text-emerald-900" : "border border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
              )}
            >
              Link sent to <strong>{email}</strong>. Check your inbox — it should arrive within a minute. Click it to open your Dentago workspace.
            </div>
          ) : (
            <form onSubmit={(e) => void sendLink(e)} className="mt-7 space-y-4">
              <label className="sr-only" htmlFor="signup-magic-email">
                Email
              </label>
              <input
                id="signup-magic-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@clinic.co.uk"
                className={cn(
                  "w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-[border-color,box-shadow]",
                  !isDark
                    ? "border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 shadow-[inset_0_1px_2px_rgba(15,12,25,0.04)] focus:border-[#111111]/45 focus:ring-[3px] focus:ring-[#111111]/12"
                    : "border border-[var(--dc-border)] bg-black/25 text-[var(--dc-text)] placeholder:text-[var(--dc-muted)]/55 focus:border-[rgba(195,177,225,0.35)] focus:ring-2 focus:ring-[var(--dc-accent)]/25",
                )}
              />
              <button
                type="submit"
                disabled={busy}
                style={{ backgroundColor: '#111111', color: '#fff' }}
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl py-3.5 text-[14px] font-semibold
                  shadow-[0_8px_28px_-8px_rgba(17,17,17,0.5)]
                  transition-all duration-200 ease-out
                  hover:-translate-y-[2px] hover:shadow-[0_16px_40px_-10px_rgba(17,17,17,0.55)]
                  active:translate-y-0 active:scale-[0.99] active:shadow-[0_4px_16px_-4px_rgba(17,17,17,0.4)]
                  focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#111111]/40 focus-visible:ring-offset-2
                  disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2d2d2d'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#111111'; }}
              >
                {/* shimmer sweep on hover */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full" aria-hidden />
                <span
                  className="material-symbols-outlined relative z-[1] text-[19px] transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  send
                </span>
                <span className="relative z-[1]">{busy ? "Sending…" : "Send link"}</span>
              </button>
            </form>
          )}

          <div className="mt-8 flex justify-center">
            <Link
              href="/signup"
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
                !isDark
                  ? "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  : "border-[var(--dc-border)] bg-white/[0.04] text-[var(--dc-muted)] hover:bg-white/[0.07]",
              )}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Other options
            </Link>
          </div>

          <p
            className={cn(
              "mx-auto mt-8 max-w-[320px] text-center text-[11px] leading-relaxed",
              isDark ? "text-[var(--dc-muted)]/85" : "text-neutral-500",
            )}
          >
            By using Dentago you agree to our{" "}
            <Link href="/privacy" className={cn("font-semibold underline-offset-2 hover:underline", isDark ? "text-[var(--dc-text)]" : "text-neutral-700")}>
              privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className={cn("font-semibold underline-offset-2 hover:underline", isDark ? "text-[var(--dc-text)]" : "text-neutral-700")}>
              terms of service
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
