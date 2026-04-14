"use client";
import { useState } from "react";
import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingDown, ShoppingCart, Package, BarChart3, AlertTriangle, CheckCircle, Clock, RotateCcw, Download } from "lucide-react";

const summaryCards = [
  { label: "Monthly Spend", value: "£3,247", sub: "April 2025", icon: BarChart3, trend: "−8% vs last month" },
  { label: "Orders Placed", value: "12", sub: "This month", icon: ShoppingCart, trend: "+3 vs last month" },
  { label: "Active Suppliers", value: "5", sub: "Connected", icon: Package, trend: "Henry Schein +4 more" },
  { label: "Estimated Savings", value: "£461", sub: "vs list price", icon: TrendingDown, trend: "14.2% saved" },
];

const recentOrders = [
  { id: "ORD-2847", date: "12 Apr 2025", supplier: "Henry Schein", total: 284.60, status: "Delivered", items: 6 },
  { id: "ORD-2831", date: "09 Apr 2025", supplier: "Dental Sky", total: 97.35, status: "Delivered", items: 3 },
  { id: "ORD-2819", date: "05 Apr 2025", supplier: "Kent Express", total: 412.00, status: "In Transit", items: 8 },
  { id: "ORD-2804", date: "02 Apr 2025", supplier: "Wrights", total: 185.40, status: "Delivered", items: 4 },
  { id: "ORD-2791", date: "28 Mar 2025", supplier: "Trycare", total: 310.20, status: "Delivered", items: 5 },
];

const spendBySupplier = [
  { name: "Henry Schein", amount: 1204, pct: 37, color: "bg-blue-500" },
  { name: "Kent Express", amount: 812, pct: 25, color: "bg-sky-400" },
  { name: "Dental Sky", amount: 648, pct: 20, color: "bg-cyan-400" },
  { name: "Wrights", amount: 389, pct: 12, color: "bg-indigo-400" },
  { name: "Trycare", amount: 194, pct: 6, color: "bg-violet-400" },
];

const spendByCategory = [
  { name: "Consumables", amount: 1102, pct: 34, color: "bg-primary" },
  { name: "PPE", amount: 714, pct: 22, color: "bg-sky-400" },
  { name: "Anaesthetics", amount: 583, pct: 18, color: "bg-cyan-400" },
  { name: "Instruments", amount: 454, pct: 14, color: "bg-blue-400" },
  { name: "Infection Control", amount: 259, pct: 8, color: "bg-indigo-400" },
  { name: "Diagnostics", amount: 135, pct: 4, color: "bg-violet-400" },
];

const monthlySpend = [
  { month: "Nov", amount: 2840 },
  { month: "Dec", amount: 2320 },
  { month: "Jan", amount: 3180 },
  { month: "Feb", amount: 2960 },
  { month: "Mar", amount: 3520 },
  { month: "Apr", amount: 3247 },
];

const topProducts = [
  { name: "Nitrile Gloves L (Box 100)", orders: 8, total: 154.00, supplier: "Dental Sky" },
  { name: "Septanest 4% Articaine (50 cart.)", orders: 6, total: 340.80, supplier: "Henry Schein" },
  { name: "3M Filtek Z250 A1 Syringe", orders: 5, total: 375.00, supplier: "Wrights" },
  { name: "Type II Plaster 5kg", orders: 4, total: 100.80, supplier: "Dental Sky" },
  { name: "Dentsply Aquasil Ultra+", orders: 3, total: 250.80, supplier: "Henry Schein" },
];

const reorderAlerts = [
  { name: "Nitrile Gloves L (Box 100)", lastOrdered: "22 days ago", frequency: "Every 3 weeks", urgent: true },
  { name: "Lidocaine 2% (50 cartridges)", lastOrdered: "18 days ago", frequency: "Every 3 weeks", urgent: false },
  { name: "Composite Syringe A2", lastOrdered: "28 days ago", frequency: "Monthly", urgent: true },
];

const maxSpend = Math.max(...monthlySpend.map(m => m.amount));

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar cartCount={3} />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Islington Dental Practice · April 2025</p>
          </div>
          <button className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors">
            <Download size={14} />Export Report
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
          {summaryCards.map(({ label, value, sub, icon: Icon, trend }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                <Icon size={15} className="text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              <p className="text-xs text-primary mt-2">{trend}</p>
            </div>
          ))}
        </div>

        {/* Reorder alerts */}
        <div className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-400" />
            <span className="text-sm font-semibold text-foreground">Reorder Reminders</span>
          </div>
          <div className="space-y-2">
            {reorderAlerts.map(alert => (
              <div key={alert.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {alert.urgent && <div className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                  <span className="text-sm text-foreground">{alert.name}</span>
                  <span className="text-xs text-muted-foreground">· {alert.lastOrdered} · {alert.frequency}</span>
                </div>
                <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <RotateCcw size={11} />Reorder
                </button>
              </div>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary border border-border mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-card data-[state=active]:text-foreground text-muted-foreground">Overview</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-card data-[state=active]:text-foreground text-muted-foreground">Spend Analytics</TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-card data-[state=active]:text-foreground text-muted-foreground">Order History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Bar chart */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-foreground">Monthly Spend</h3>
                  <span className="text-xs text-muted-foreground">Last 6 months</span>
                </div>
                <div className="flex items-end gap-2 h-40">
                  {monthlySpend.map(({ month, amount }) => (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">£{(amount/1000).toFixed(1)}k</span>
                      <div className={`w-full rounded-t-sm ${month === "Apr" ? "bg-primary" : "bg-secondary"}`} style={{ height: `${(amount/maxSpend)*100}%` }} />
                      <span className="text-[10px] text-muted-foreground">{month}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supplier breakdown */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-5">Spend by Supplier</h3>
                <div className="space-y-3">
                  {spendBySupplier.map(({ name, amount, pct, color }) => (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{name}</span>
                        <div className="flex gap-2">
                          <span className="text-xs font-medium text-foreground">£{amount}</span>
                          <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category breakdown */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-5">Spend by Category</h3>
                <div className="space-y-3">
                  {spendByCategory.map(({ name, amount, pct, color }) => (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{name}</span>
                        <div className="flex gap-2">
                          <span className="text-xs font-medium text-foreground">£{amount}</span>
                          <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top products */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-5">Top 5 Products</h3>
                <div className="space-y-3">
                  {topProducts.map(({ name, orders, total, supplier }, i) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground">{supplier} · {orders} orders</p>
                      </div>
                      <span className="text-xs font-semibold text-foreground">£{total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown size={18} className="text-primary" />
                <h3 className="font-semibold text-foreground">Savings Analysis — April 2025</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Compared to estimated market list prices</p>
              <div className="grid gap-4 sm:grid-cols-3 mb-8">
                {[["Total spend", "£3,247", false], ["Est. list price", "£3,708", false], ["Total saved", "£461 (12.4%)", true]].map(([label, value, highlight]) => (
                  <div key={String(label)} className="rounded-md bg-secondary/50 px-4 py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {[["PPE", 68, 14.5], ["Consumables", 142, 12.9], ["Anaesthetics", 89, 15.3], ["Instruments", 52, 11.4], ["Infection Control", 110, 12.1]].map(([cat, saved, pct]) => (
                  <div key={String(cat)} className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-36">{cat}</span>
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Number(pct) * 5}%` }} />
                    </div>
                    <span className="text-sm font-medium text-primary w-10 text-right">£{saved}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Order History</h3>
                <span className="text-xs text-muted-foreground">Last 30 days</span>
              </div>
              <div className="divide-y divide-border">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-foreground">{order.id}</span>
                        <Badge className={`text-[10px] border-0 ${order.status === "Delivered" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-400"}`}>
                          {order.status === "Delivered" ? <CheckCircle size={9} className="mr-1" /> : <Clock size={9} className="mr-1" />}
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{order.supplier} · {order.items} items · {order.date}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">£{order.total.toFixed(2)}</p>
                    <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <RotateCcw size={11} />Reorder
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
