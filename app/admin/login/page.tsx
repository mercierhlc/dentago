"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { DENTAGO_PRIMARY_ADMIN_EMAIL } from "@/lib/admin-login-defaults";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DENTAGO_PRIMARY_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const access_token = data.session!.access_token;

    const sessionRes = await fetch("/api/admin/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token }),
    });

    const sessionJson = await sessionRes.json().catch(() => ({}));
    if (!sessionRes.ok) {
      await supabase.auth.signOut();
      setError(typeof sessionJson.error === "string" ? sessionJson.error : "Could not open admin session");
      setLoading(false);
      return;
    }

    router.replace("/admin");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800">Admin Login</h1>
          <p className="text-slate-500 text-sm mt-1">Dentago internal dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="you@dentago.co.uk"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#6C3DE8] hover:bg-[#5a31c5] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
