"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Order = {
  id: string;
  clinic_name: string;
  clinic_email: string;
  total_amount: number;
  status: string;
  created_at: string;
  notes: string | null;
  items: { product_name: string; brand: string; sku: string; quantity: number; unit_price: number; pack_size: string }[];
};

type Product = {
  supplierProductId: number;
  productId: number;
  name: string;
  brand: string;
  category: string;
  sku: string;
  price: number;
  stock: boolean;
  delivery: string;
  packSize: string;
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fef3c7", color: "#d97706" },
  confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
  dispatched: { bg: "#d1fae5", color: "#065f46" },
  delivered:  { bg: "#f0fdf4", color: "#16a34a" },
  cancelled:  { bg: "#fee2e2", color: "#dc2626" },
};

export default function SupplierDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "products">("orders");
  const [supplierName, setSupplierName] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ price: string; stock: boolean; delivery: string }>({ price: "", stock: true, delivery: "" });
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);

  const getToken = useCallback(() => localStorage.getItem("supplier_token"), []);

  useEffect(() => {
    const token = localStorage.getItem("supplier_token");
    const name = localStorage.getItem("supplier_name");
    if (!token) { router.push("/supplier"); return; }
    setSupplierName(name ?? "");
    fetchOrders(token);
    fetchProducts(token);
    fetchStats(token);
  }, [router]);

  async function fetchStats(token: string) {
    const res = await fetch("/api/supplier/stats", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setTotalRevenue(data.totalRevenue ?? 0);
  }

  async function fetchOrders(token: string) {
    const res = await fetch("/api/supplier/orders", { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { router.push("/supplier"); return; }
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  async function fetchProducts(token: string) {
    const res = await fetch("/api/supplier/products", { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) return;
    const data = await res.json();
    setProducts(data.products ?? []);
  }

  function startEdit(p: Product) {
    setEditingProduct(p.supplierProductId);
    setEditValues({ price: String(p.price), stock: p.stock, delivery: p.delivery });
  }

  async function saveProduct(supplierProductId: number) {
    setSaving(true);
    const token = getToken();
    await fetch("/api/supplier/products/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ supplierProductId, price: parseFloat(editValues.price), stock: editValues.stock, delivery: editValues.delivery }),
    });
    setEditingProduct(null);
    setSaving(false);
    fetchProducts(token!);
  }

  async function updateOrderStatus(orderId: string, status: string) {
    setStatusUpdating(orderId);
    const token = getToken();
    await fetch("/api/supplier/orders/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId, status }),
    });
    setStatusUpdating(null);
    fetchOrders(token!);
  }

  function signOut() {
    localStorage.removeItem("supplier_token");
    localStorage.removeItem("supplier_id");
    localStorage.removeItem("supplier_name");
    router.push("/supplier");
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div style={{ fontFamily: "'Helvetica Neue', sans-serif", minHeight: "100vh", background: "#f8fafc" }}>
      <style>{`
        .sp-header { background:#fff; border-bottom:1px solid #e2e8f0; padding:0 32px; display:flex; align-items:center; justify-content:space-between; height:60px; }
        .sp-header-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; }
        .sp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:32px; }
        .sp-tabs { display:flex; gap:4px; margin-bottom:24px; background:#f1f5f9; border-radius:12px; padding:4px; width:fit-content; }
        .sp-tab-btn { padding:8px 20px; border-radius:10px; border:none; cursor:pointer; font-size:13px; font-weight:700; white-space:nowrap; }
        .sp-order-row { padding:16px 20px; display:flex; align-items:center; gap:16px; cursor:pointer; }
        .sp-order-amount { font-weight:800; color:#151121; font-size:16px; }
        .sp-order-expand { color:#94a3b8; font-size:16px; flex-shrink:0; }
        .sp-items-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:20px; }
        .sp-items-table { width:100%; border-collapse:collapse; min-width:480px; }
        .sp-status-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .sp-status-btn { padding:10px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; min-height:44px; }
        .sp-products-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .sp-products-table { width:100%; border-collapse:collapse; min-width:700px; }
        .sp-search { width:100%; max-width:360px; padding:10px 14px; border-radius:10px; border:1.5px solid #e2e8f0; font-size:14px; outline:none; box-sizing:border-box; }
        .sp-signout { font-size:13px; color:#94a3b8; background:none; border:none; cursor:pointer; font-weight:600; min-height:44px; padding:0 8px; }
        @media (max-width: 640px) {
          .sp-header { padding:0 16px; height:56px; }
          .sp-header-label { display:none; }
          .sp-stats { grid-template-columns:1fr 1fr; }
          .sp-stats > div:nth-child(3), .sp-stats > div:nth-child(4) { grid-column:span 1; }
          .sp-tabs { width:100%; }
          .sp-tab-btn { flex:1; text-align:center; font-size:12px; padding:8px 10px; }
          .sp-order-row { padding:14px 16px; gap:10px; }
          .sp-order-amount { font-size:14px; }
          .sp-search { max-width:100%; }
        }
      `}</style>

      {/* Header */}
      <div className="sp-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#111111", letterSpacing: "-0.5px" }}>Dentago</span>
          <span className="sp-header-label">Supplier Portal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{supplierName}</span>
          <button onClick={signOut} className="sp-signout">Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Stats */}
        <div className="sp-stats">
          {[
            { label: "Total orders", value: orders.length },
            { label: "Pending", value: pendingCount, highlight: pendingCount > 0 },
            { label: "Revenue", value: totalRevenue !== null ? `£${totalRevenue.toFixed(2)}` : "—" },
            { label: "Products listed", value: products.length },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", border: `1.5px solid ${s.highlight ? "#111111" : "#e2e8f0"}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.highlight ? "#111111" : "#151121" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="sp-tabs">
          {(["orders", "products"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="sp-tab-btn" style={{ background: tab === t ? "#fff" : "transparent", color: tab === t ? "#151121" : "#64748b", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
              {t === "orders" ? `Orders${pendingCount > 0 ? ` (${pendingCount})` : ""}` : "Products & Pricing"}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {tab === "orders" && (
          <div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Loading orders...</div>
            ) : orders.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 16, padding: 48, textAlign: "center", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                <div style={{ fontWeight: 700, color: "#151121", marginBottom: 4 }}>No orders yet</div>
                <div style={{ color: "#94a3b8", fontSize: 14 }}>Orders from dental practices will appear here.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {orders.map(order => {
                  const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
                  const isExpanded = expandedOrder === order.id;
                  return (
                    <div key={order.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                      <div className="sp-order-row" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: "#151121", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{order.clinic_name}</div>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {order.items?.length ?? 0} items</div>
                        </div>
                        <div className="sp-order-amount">£{order.total_amount.toFixed(2)}</div>
                        <span style={{ ...sc, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>{order.status}</span>
                        <div className="sp-order-expand">{isExpanded ? "▲" : "▼"}</div>
                      </div>

                      {isExpanded && (
                        <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 16px" }}>
                          {order.notes && (
                            <div style={{ background: "#fef9f0", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
                              <strong>Note from practice:</strong> {order.notes}
                            </div>
                          )}

                          <div className="sp-items-scroll">
                            <table className="sp-items-table">
                              <thead>
                                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                  {["Product", "SKU", "Pack size", "Qty", "Unit price", "Line total"].map(h => (
                                    <th key={h} style={{ textAlign: "left", padding: "6px 8px 6px 0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", whiteSpace: "nowrap" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items ?? []).map((item, i) => (
                                  <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                                    <td style={{ padding: "10px 8px 10px 0", fontSize: 14, fontWeight: 600, color: "#151121" }}>{item.product_name}<div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>{item.brand}</div></td>
                                    <td style={{ padding: "10px 8px 10px 0", fontSize: 12, color: "#64748b", fontFamily: "monospace", whiteSpace: "nowrap" }}>{item.sku}</td>
                                    <td style={{ padding: "10px 8px 10px 0", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{item.pack_size}</td>
                                    <td style={{ padding: "10px 8px 10px 0", fontSize: 14, fontWeight: 700, color: "#151121" }}>{item.quantity}</td>
                                    <td style={{ padding: "10px 8px 10px 0", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>£{item.unit_price.toFixed(2)}</td>
                                    <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "#151121", whiteSpace: "nowrap" }}>£{(item.quantity * item.unit_price).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="sp-status-row">
                            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Update status:</span>
                            {["confirmed", "dispatched", "delivered", "cancelled"].map(s => (
                              <button
                                key={s}
                                disabled={order.status === s || statusUpdating === order.id}
                                onClick={() => updateOrderStatus(order.id, s)}
                                className="sp-status-btn"
                                style={{ border: `1.5px solid ${order.status === s ? "#111111" : "#e2e8f0"}`, background: order.status === s ? "#111111" : "#fff", color: order.status === s ? "#fff" : "#374151", opacity: statusUpdating === order.id ? 0.6 : 1, cursor: order.status === s ? "default" : "pointer" }}
                              >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Products Tab */}
        {tab === "products" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Search products, SKUs, categories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="sp-search"
              />
            </div>

            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div className="sp-products-scroll">
                <table className="sp-products-table">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                      {["Product", "Category", "SKU", "Pack size", "Price", "Stock", "Delivery", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => {
                      const isEditing = editingProduct === p.supplierProductId;
                      return (
                        <tr key={p.supplierProductId} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ fontWeight: 700, color: "#151121", fontSize: 14 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{p.brand}</div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{p.category}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b", fontFamily: "monospace", whiteSpace: "nowrap" }}>{p.sku}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{p.packSize}</td>
                          <td style={{ padding: "12px 16px" }}>
                            {isEditing ? (
                              <input type="number" step="0.01" min="0" value={editValues.price} onChange={e => setEditValues(v => ({ ...v, price: e.target.value }))}
                                style={{ width: 80, padding: "6px 8px", borderRadius: 8, border: "1.5px solid #111111", fontSize: 13, outline: "none" }} />
                            ) : (
                              <span style={{ fontWeight: 700, color: "#151121" }}>£{p.price.toFixed(2)}</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {isEditing ? (
                              <select value={editValues.stock ? "true" : "false"} onChange={e => setEditValues(v => ({ ...v, stock: e.target.value === "true" }))}
                                style={{ padding: "8px", borderRadius: 8, border: "1.5px solid #111111", fontSize: 13, outline: "none" }}>
                                <option value="true">In stock</option>
                                <option value="false">Out of stock</option>
                              </select>
                            ) : (
                              <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: p.stock ? "#d1fae5" : "#fee2e2", color: p.stock ? "#065f46" : "#dc2626", whiteSpace: "nowrap" }}>
                                {p.stock ? "In stock" : "Out of stock"}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {isEditing ? (
                              <input type="text" value={editValues.delivery} onChange={e => setEditValues(v => ({ ...v, delivery: e.target.value }))}
                                style={{ width: 110, padding: "6px 8px", borderRadius: 8, border: "1.5px solid #111111", fontSize: 13, outline: "none" }} />
                            ) : (
                              <span style={{ fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{p.delivery}</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {isEditing ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => saveProduct(p.supplierProductId)} disabled={saving}
                                  style={{ padding: "8px 16px", borderRadius: 8, background: "#111111", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, minHeight: 44, whiteSpace: "nowrap" }}>
                                  {saving ? "Saving…" : "Save"}
                                </button>
                                <button onClick={() => setEditingProduct(null)}
                                  style={{ padding: "8px 16px", borderRadius: 8, background: "#f1f5f9", color: "#64748b", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => startEdit(p)}
                                style={{ padding: "8px 16px", borderRadius: 8, background: "#f1f5f9", color: "#374151", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredProducts.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No products found.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
