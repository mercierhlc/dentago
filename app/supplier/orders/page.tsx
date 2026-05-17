"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Order = {
  id: string;
  clinic_name: string;
  clinic_email: string;
  status: string;
  supplier_total: number;
  created_at: string;
  items: { product_name: string; quantity: number; unit_price: number }[];
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fef3c7", color: "#d97706" },
  confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
  processing: { bg: "#e0e7ff", color: "#4338ca" },
  dispatched: { bg: "#d1fae5", color: "#065f46" },
  delivered:  { bg: "#f0fdf4", color: "#16a34a" },
  cancelled:  { bg: "#fee2e2", color: "#dc2626" },
};

const STATUSES = ["all", "pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"];

export default function SupplierOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierName, setSupplierName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const getToken = useCallback(() => localStorage.getItem("supplier_token"), []);

  useEffect(() => {
    const token = localStorage.getItem("supplier_token");
    const name = localStorage.getItem("supplier_name");
    if (!token) { router.push("/supplier"); return; }
    setSupplierName(name ?? "");
    fetch("/api/supplier/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { router.push("/supplier"); return r.json(); } return r.json(); })
      .then(data => setOrders(data.orders ?? []))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search && !o.clinic_name.toLowerCase().includes(search.toLowerCase()) && !o.id.includes(search)) return false;
    if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(o.created_at) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const totalRevenue = filtered.reduce((s, o) => s + (o.supplier_total ?? 0), 0);

  function signOut() {
    ["supplier_token", "supplier_id", "supplier_name"].forEach(k => localStorage.removeItem(k));
    router.push("/supplier");
  }

  return (
    <div style={{ fontFamily: "'Helvetica Neue', sans-serif", minHeight: "100vh", background: "#f8fafc" }}>
      <style>{`
        .so-header { background:#fff; border-bottom:1px solid #e2e8f0; padding:0 32px; display:flex; align-items:center; justify-content:space-between; height:60px; }
        .so-filter-row { display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:20px; }
        .so-filter-input { padding:10px 14px; border-radius:10px; border:1.5px solid #e2e8f0; font-size:13px; outline:none; background:#fff; }
        .so-status-pill { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
        @media (max-width:640px) {
          .so-header { padding:0 16px; }
          .so-filter-row { gap:8px; }
          .so-filter-input { font-size:12px; padding:8px 12px; }
        }
      `}</style>

      {/* Header */}
      <div className="so-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/supplier/dashboard" style={{ fontSize: 20, fontWeight: 800, color: "#111111", letterSpacing: "-0.5px", textDecoration: "none" }}>Dentago</Link>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8" }}>Supplier Portal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/supplier/dashboard" style={{ fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 600 }}>← Dashboard</Link>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{supplierName}</span>
          <button onClick={signOut} style={{ fontSize: 13, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontWeight: 600, minHeight: 44, padding: "0 8px" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#151121", margin: 0, letterSpacing: "-0.5px" }}>Orders</h1>
          <div style={{ fontSize: 14, color: "#64748b" }}>
            <strong style={{ color: "#151121" }}>{filtered.length}</strong> orders · <strong style={{ color: "#151121" }}>£{totalRevenue.toFixed(2)}</strong> revenue
          </div>
        </div>

        {/* Filters */}
        <div className="so-filter-row">
          <input
            className="so-filter-input" type="text" placeholder="Search clinic name or order ID…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ flexGrow: 1, minWidth: 200 }}
          />
          <select className="so-filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <input className="so-filter-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
          <input className="so-filter-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
          {(search || statusFilter !== "all" || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}
              style={{ padding: "10px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 13, cursor: "pointer", color: "#64748b", fontWeight: 600 }}>
              Clear
            </button>
          )}
        </div>

        {loading && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading orders…</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>No orders found.</div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    {["Order ID", "Clinic", "Date", "Items", "Revenue", "Status", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => {
                    const sc = STATUS_COLORS[order.status] ?? { bg: "#f1f5f9", color: "#374151" };
                    return (
                      <tr key={order.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                        <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                          {order.id.slice(0, 8)}…
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 700, color: "#151121", fontSize: 14 }}>{order.clinic_name}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{order.clinic_email}</div>
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>
                          {new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 13, color: "#64748b" }}>
                          {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? "s" : ""}
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 700, color: "#151121", whiteSpace: "nowrap" }}>
                          £{(order.supplier_total ?? 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span className="so-status-pill" style={{ background: sc.bg, color: sc.color }}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <Link href={`/supplier/orders/${order.id}`}
                            style={{ padding: "8px 14px", borderRadius: 8, background: "#f1f5f9", color: "#374151", textDecoration: "none", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
