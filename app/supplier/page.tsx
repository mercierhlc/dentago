"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SupplierLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/supplier/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Login failed");
      setLoading(false);
      return;
    }

    localStorage.setItem("supplier_token", data.session.access_token);
    localStorage.setItem("supplier_id", String(data.supplierId));
    localStorage.setItem("supplier_name", data.supplierName);
    router.push("/supplier/dashboard");
  }

  return (
    <div style={{ fontFamily: "'Helvetica Neue', sans-serif", minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", width: "100%", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#6C3DE8", marginBottom: 8, letterSpacing: "-0.5px" }}>Dentago</div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8", marginBottom: 32 }}>Supplier Portal</div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#151121", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Sign in</h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 32px" }}>Access your orders, products and pricing.</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@supplier.com"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", background: "#6C3DE8", color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>

        <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", marginTop: 24 }}>
          Need access? Email <a href="mailto:support@dentago.co.uk" style={{ color: "#6C3DE8" }}>support@dentago.co.uk</a>
        </p>
      </div>
    </div>
  );
}
