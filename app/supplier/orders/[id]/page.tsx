"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type OrderDetail = {
  id: string;
  clinic_name: string;
  clinic_email: string;
  status: string;
  total_amount: number;
  supplier_total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: {
    product_name: string;
    brand: string;
    category: string;
    sku: string;
    pack_size: string;
    quantity: number;
    unit_price: number;
  }[];
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fef3c7", color: "#d97706" },
  confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
  processing: { bg: "#e0e7ff", color: "#4338ca" },
  dispatched: { bg: "#d1fae5", color: "#065f46" },
  delivered:  { bg: "#f0fdf4", color: "#16a34a" },
  cancelled:  { bg: "#fee2e2", color: "#dc2626" },
};

const VALID_STATUSES = ["confirmed", "processing", "dispatched", "delivered", "cancelled"];

export default function SupplierOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [supplierName, setSupplierName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("supplier_token");
    const name = localStorage.getItem("supplier_name");
    if (!token) { router.push("/supplier"); return; }
    setSupplierName(name ?? "");

    fetch(`/api/supplier/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        if (r.status === 401) { router.push("/supplier"); return; }
        const data = await r.json();
        if (!r.ok) { setError(data.error ?? "Order not found"); return; }
        setOrder(data.order);
      })
      .finally(() => setLoading(false));
  }, [orderId, router]);

  async function updateStatus(status: string) {
    const token = localStorage.getItem("supplier_token");
    setStatusUpdating(true);
    const res = await fetch("/api/supplier/orders/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId, status }),
    });
    if (res.ok) setOrder(prev => prev ? { ...prev, status } : prev);
    setStatusUpdating(false);
  }

  function signOut() {
    ["supplier_token", "supplier_id", "supplier_name"].forEach(k => localStorage.removeItem(k));
    router.push("/supplier");
  }

  const sc = order ? (STATUS_COLORS[order.status] ?? { bg: "#f1f5f9", color: "#374151" }) : { bg: "#f1f5f9", color: "#374151" };

  return (
    <div style={{ fontFamily: "'Helvetica Neue', sans-serif", minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/supplier/dashboard" style={{ fontSize: 20, fontWeight: 800, color: "#111111", letterSpacing: "-0.5px", textDecoration: "none" }}>Dentago</Link>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8" }}>Supplier Portal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/supplier/orders" style={{ fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 600 }}>← Orders</Link>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{supplierName}</span>
          <button onClick={signOut} style={{ fontSize: 13, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontWeight: 600, minHeight: 44, padding: "0 8px" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {loading && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading order…</div>}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px", color: "#dc2626", fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && order && (
          <div>
            {/* Order header */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "24px 28px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8", marginBottom: 4 }}>Order ID</div>
                  <div style={{ fontFamily: "monospace", fontSize: 14, color: "#374151" }}>{order.id}</div>
                </div>
                <span style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4 }}>Clinic</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#151121" }}>{order.clinic_name}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>{order.clinic_email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4 }}>Placed</div>
                  <div style={{ fontSize: 14, color: "#374151" }}>
                    {new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {new Date(order.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4 }}>Your revenue</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#151121" }}>£{(order.supplier_total ?? 0).toFixed(2)}</div>
                </div>
              </div>

              {order.notes && (
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#374151" }}>
                  <span style={{ fontWeight: 700, color: "#64748b" }}>Notes: </span>{order.notes}
                </div>
              )}
            </div>

            {/* Items table */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 20, overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#151121" }}>Order items</span>
                <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: 8 }}>({order.items.length} items)</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      {["Product", "SKU", "Pack size", "Qty", "Unit price", "Line total"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 700, color: "#151121", fontSize: 14 }}>{item.product_name}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.brand}{item.category ? ` · ${item.category}` : ""}</div>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{item.sku}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{item.pack_size}</td>
                        <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#151121" }}>{item.quantity}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>£{item.unit_price.toFixed(2)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#151121", whiteSpace: "nowrap" }}>£{(item.quantity * item.unit_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #f1f5f9" }}>
                      <td colSpan={5} style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "#374151", textAlign: "right" }}>Your total</td>
                      <td style={{ padding: "14px 16px", fontSize: 16, fontWeight: 800, color: "#151121" }}>£{(order.supplier_total ?? 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Status update */}
            {order.status !== "delivered" && order.status !== "cancelled" && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px 24px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#151121", marginBottom: 14 }}>Update status</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {VALID_STATUSES.map(s => (
                    <button
                      key={s}
                      disabled={order.status === s || statusUpdating}
                      onClick={() => updateStatus(s)}
                      style={{
                        padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: order.status === s ? "default" : "pointer",
                        border: `1.5px solid ${order.status === s ? "#111111" : "#e2e8f0"}`,
                        background: order.status === s ? "#111111" : "#fff",
                        color: order.status === s ? "#fff" : "#374151",
                        opacity: statusUpdating && order.status !== s ? 0.6 : 1,
                        minHeight: 44,
                      }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
