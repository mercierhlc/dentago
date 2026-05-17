"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser, saveAuth } from "@/lib/auth";

export default function AuthCompletePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser!;

    async function handleSession(accessToken: string) {
      if (cancelled) return;
      const res = await fetch("/api/clinic/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (cancelled) return;
      if (res.status === 404) {
        router.replace("/signup/welcome");
        return;
      }
      if (!res.ok) {
        setError("Could not load your account. Try signing in again.");
        return;
      }
      const { clinic } = await res.json();
      if (clinic?.id) {
        saveAuth(accessToken, clinic);
        router.replace("/dashboard");
      } else {
        router.replace("/signup/finish");
      }
    }

    // 1. Check if session already exists (e.g. OAuth callback already processed)
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) {
        await handleSession(session.access_token);
        return;
      }

      // 2. Wait for Supabase to process the hash fragment — fires SIGNED_IN
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          if (cancelled) return;
          if (event === "SIGNED_IN" && newSession?.access_token) {
            subscription.unsubscribe();
            await handleSession(newSession.access_token);
          }
        },
      );

      // 3. Timeout fallback after 10s
      const t = setTimeout(() => {
        if (cancelled) return;
        subscription.unsubscribe();
        router.replace("/login");
      }, 10000);

      return () => {
        clearTimeout(t);
        subscription.unsubscribe();
      };
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f5f4] px-6">
      <div className="mb-6 text-[22px] font-bold tracking-[-0.03em] text-[#111111]">dentago</div>
      {!error ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-neutral-300 border-t-[#111111] animate-spin" />
          <p className="text-[13px] text-neutral-500 font-medium">Signing you in…</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-red-500 text-sm font-medium max-w-sm">{error}</p>
          <a href="/login" className="mt-4 inline-block text-[13px] font-semibold text-[#111111] underline">
            Back to sign in
          </a>
        </div>
      )}
    </div>
  );
}
