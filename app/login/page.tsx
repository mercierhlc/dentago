"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveAuth } from "@/lib/auth";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login"
          ? { email, password }
          : { email, password, clinicName }
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      const token = data.session?.access_token;
      const clinic = data.clinic ?? { id: "", clinic_name: clinicName, email };
      if (token) saveAuth(token, clinic);

      // Redirect to supplier connection on first signup, else search
      router.push(mode === "signup" ? "/clinic/suppliers" : "/search");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <Link href="/" className="text-2xl font-extrabold tracking-tighter text-[#6C3DE8] mb-8">
        Dentago
      </Link>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden">
        {/* Tab toggle */}
        <div className="flex border-b border-slate-100">
          {(["login", "signup"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-4 text-sm font-bold transition-colors ${
                mode === m ? "text-[#6C3DE8] border-b-2 border-[#6C3DE8]" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <div className="px-8 py-7">
          <h1 className="text-xl font-extrabold text-[#151121] mb-1">
            {mode === "login" ? "Welcome back" : "Join Dentago"}
          </h1>
          <p className="text-xs text-slate-400 mb-6">
            {mode === "login"
              ? "Sign in to see prices from your connected suppliers"
              : "Free for UK dental clinics — connect your suppliers and start saving"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Clinic Name</label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={e => setClinicName(e.target.value)}
                  placeholder="Bright Smile Dental Practice"
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-[#151121] placeholder:text-slate-400 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourclinic.co.uk"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-[#151121] placeholder:text-slate-400 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                minLength={6}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-[#151121] placeholder:text-slate-400 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-[15px] text-red-400 mt-0.5 flex-shrink-0">error</span>
                <p className="text-xs text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#6C3DE8] text-white py-3.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-md shadow-[#6C3DE8]/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/></svg>
              ) : (
                <span className="material-symbols-outlined text-[17px]">
                  {mode === "login" ? "login" : "person_add"}
                </span>
              )}
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-[10px] text-slate-400 text-center mt-5 leading-relaxed">
            By signing up you agree to our terms. 100% free — we never charge clinics.
          </p>
        </div>
      </div>

      <Link href="/search" className="mt-6 text-sm text-slate-400 hover:text-[#6C3DE8] transition-colors font-medium">
        Browse without signing in →
      </Link>
    </div>
  );
}
