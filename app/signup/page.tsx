"use client";

import Link from "next/link";
import { supabaseBrowser } from "@/lib/auth";
import { SignupTopoBackground, signupShellClass, useSignupTheme } from "@/components/signup/SignupChrome";
import { cn } from "@/lib/utils";

function CheckItem({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-[14px]">
      <span className="material-symbols-outlined mt-0.5 shrink-0 text-[26px] text-[#111111]" style={{ fontVariationSettings: "'FILL' 1" }}>
        check_circle
      </span>
      <span className={cn("text-[17px] leading-snug sm:text-[18px]", isDark ? "text-[var(--dc-text)]/95" : "text-neutral-700")}>{children}</span>
    </li>
  );
}

export default function SignupLandingPage() {
  const { isDark } = useSignupTheme();

  async function signInGoogle() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await supabaseBrowser!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/complete` },
    });
  }

  return (
    <div className={signupShellClass(isDark)}>
      <SignupTopoBackground />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1357px] flex-col gap-12 px-6 py-12 sm:gap-14 sm:py-14 md:flex-row md:items-center md:justify-center md:gap-14 md:px-10 md:py-16 lg:gap-[4.75rem] lg:px-12">
        <div className="flex min-w-0 flex-1 flex-col md:max-w-[min(100%,619px)]">
          <h1
            className={cn(
              "text-[2.0825rem] font-semibold leading-[1.14] tracking-[-0.03em] sm:text-[2.305625rem] md:text-[2.52875rem] lg:text-[2.6775rem]",
              isDark ? "text-[var(--dc-text)]" : "text-neutral-900",
            )}
          >
            Join practices who{" "}
            <span className="bg-gradient-to-r from-[#111111] to-[#555555] bg-clip-text text-transparent">activate smarter procurement</span>{" "}
            with Dentago
          </h1>
          <ul className="mt-8 max-w-[40.5rem] space-y-4 md:mt-9 md:space-y-5">
            <CheckItem isDark={isDark}>Free for clinics — supplier commissions fund the platform, not chair time.</CheckItem>
            <CheckItem isDark={isDark}>Live price context across major UK dental catalogues, in one search.</CheckItem>
            <CheckItem isDark={isDark}>Cart, orders, and onboarding checklists built for how practices actually buy.</CheckItem>
          </ul>
          <div className="mt-11 md:mt-[3.25rem]">
            <p className={cn("text-[13px] font-semibold uppercase tracking-[0.14em]", isDark ? "text-[var(--dc-muted)]" : "text-neutral-500")}>
              Built for UK teams
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              {["Private", "NHS / mixed", "Specialist", "DSO"].map((label) => (
                <span
                  key={label}
                  className={cn(
                    "rounded-full border px-[14px] py-[9px] text-[14px] font-semibold",
                    isDark ? "border-[var(--dc-border)] bg-white/[0.04] text-[var(--dc-muted)]" : "border-neutral-200 bg-white/80 text-neutral-600",
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 md:w-[450px]">
          <div
            className={cn(
              "relative rounded-[17px] border px-7 pb-9 pt-10 shadow-[0_25px_86px_-34px_rgba(15,12,25,0.22)] md:rounded-[22px] md:px-9 md:pb-10 md:pt-11",
              !isDark
                ? "border-neutral-200/90 bg-white"
                : "border-[var(--dc-border)] bg-[var(--dc-surface)]/95 backdrop-blur-xl",
            )}
          >
            <div className="text-center">
              <p className={cn("text-[1.205rem] font-semibold tracking-tight", isDark ? "text-[var(--dc-text)]" : "text-neutral-900")}>
                Create your Dentago workspace
              </p>
              <p className={cn("mx-auto mt-2 max-w-[321px] text-[14px] leading-relaxed", isDark ? "text-[var(--dc-muted)]" : "text-neutral-500")}>
                Use Google or email — we&apos;ll send a secure link. Then add your practice in one short step.
              </p>
            </div>

            <div className="mt-7 space-y-3 md:mt-8">
              <button
                type="button"
                onClick={() => void signInGoogle()}
                className={cn(
                  "grid w-full grid-cols-[30px_1fr_30px] items-center rounded-xl py-3 text-[15px] font-semibold transition-[background,border-color,transform] active:scale-[0.995]",
                  !isDark
                    ? "border border-neutral-200/95 bg-white text-neutral-900 shadow-[0_1px_2px_rgba(15,12,25,0.05)] hover:border-neutral-300 hover:bg-neutral-50/90"
                    : "border border-[var(--dc-border)] bg-white/[0.04] text-[var(--dc-text)] hover:bg-white/[0.07]",
                )}
              >
                <span className="flex justify-center">
                  <svg className="h-[23px] w-[23px] shrink-0" viewBox="0 0 24 24" aria-hidden>
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
                <span className="text-center">Sign up with Google</span>
                <span aria-hidden className="inline-block w-[30px]" />
              </button>

              <Link
                href="/signup/email"
                className={cn(
                  "grid w-full grid-cols-[30px_1fr_30px] items-center rounded-xl py-3 text-center text-[15px] font-semibold transition-[background,border-color,transform] active:scale-[0.995]",
                  !isDark
                    ? "border border-neutral-200/95 bg-white text-neutral-900 shadow-[0_1px_2px_rgba(15,12,25,0.05)] hover:border-neutral-300 hover:bg-neutral-50/90"
                    : "border border-[var(--dc-border)] bg-white/[0.04] text-[var(--dc-text)] hover:bg-white/[0.07]",
                )}
              >
                <span className={cn("flex justify-center", !isDark ? "text-neutral-400" : "text-[var(--dc-muted)]")}>
                  <span className="material-symbols-outlined text-[23px]">alternate_email</span>
                </span>
                <span>Sign up with email</span>
                <span aria-hidden className="inline-block w-[30px]" />
              </Link>
            </div>

            <p className={cn("mt-8 text-center text-[14px]", isDark ? "text-[var(--dc-muted)]" : "text-neutral-500")}>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#111111] hover:underline dark:text-[var(--dc-accent)]">
                Sign in
              </Link>
            </p>

            <p
              className={cn(
                "mx-auto mt-6 max-w-[343px] text-center text-[12px] leading-relaxed",
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
        </div>
      </main>
    </div>
  );
}
