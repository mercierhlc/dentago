"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SupplierInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<{ email: string; role: string; supplierName: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setError("No invite token provided."); setLoading(false); return; }
    fetch(`/api/supplier/invite?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setInvite(d);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/supplier/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to accept invite"); setSubmitting(false); return; }

    setDone(true);
    setTimeout(() => router.push("/supplier"), 2000);
  }

  const box: React.CSSProperties = {
    background: "#fff", borderRadius: 20, padding: "48px 40px", width: "100%", maxWidth: 420,
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0",
  };

  return (
    <div style={{ fontFamily: "'Helvetica Neue', sans-serif", minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={box}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111111", marginBottom: 4, letterSpacing: "-0.5px" }}>Dentago</div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8", marginBottom: 32 }}>Supplier Portal</div>

        {loading && <p style={{ color: "#64748b", fontSize: 14 }}>Validating invite…</p>}

        {!loading && error && !invite && (
          <div>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>
              Need a new invite? Email <a href="mailto:support@dentago.co.uk" style={{ color: "#111111" }}>support@dentago.co.uk</a>
            </p>
          </div>
        )}

        {!loading && done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#151121", marginBottom: 8 }}>Account activated!</h2>
            <p style={{ color: "#64748b", fontSize: 14 }}>Redirecting you to sign in…</p>
          </div>
        )}

        {!loading && invite && !done && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#151121", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Accept invite</h1>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>
              You've been invited to join <strong>{invite.supplierName}</strong> as <strong>{invite.role}</strong>.
            </p>

            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", marginBottom: 24, fontSize: 13, color: "#374151" }}>
              <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 2 }}>Email</span>
              {invite.email}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Set password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="At least 8 characters"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Confirm password</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  required placeholder="Repeat password"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={submitting}
                style={{ width: "100%", background: "#111111", color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Activating account…" : "Activate account →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupplierInvitePage() {
  return (
    <Suspense fallback={<div style={{ fontFamily: "'Helvetica Neue', sans-serif", minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
      <SupplierInviteContent />
    </Suspense>
  );
}
