"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/os/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push(searchParams.get("from") ?? "/os");
    } else {
      setError("Wrong password.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoFocus
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 10,
          border: "1px solid #2d1f50", background: "#0f0a1e",
          color: "#fff", fontSize: 15, marginBottom: 16, boxSizing: "border-box",
          outline: "none",
        }}
      />
      {error && (
        <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%", padding: "12px", borderRadius: 10,
          background: loading ? "#4a2fa0" : "#6C3DE8", color: "#fff", fontWeight: 700,
          fontSize: 15, border: "none", cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Entering..." : "Enter OS →"}
      </button>
    </form>
  );
}

export default function OSLogin() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0f0a1e", fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "#1a1030", border: "1px solid #2d1f50", borderRadius: 16,
        padding: "40px 48px", width: 360,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#6C3DE8", marginBottom: 8 }}>
          Dentago OS
        </div>
        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 32 }}>
          Internal operating system
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
