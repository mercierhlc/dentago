import Link from "next/link";
import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import {
  Search, ShoppingCart, BarChart3, Clock, CheckCircle,
  ArrowRight, Star, TrendingDown, Package, Zap,
} from "lucide-react";

const stats = [
  { value: "4,800+", label: "London dental practices" },
  { value: "£2,000–£4,700", label: "avg monthly supply spend" },
  { value: "3–7", label: "suppliers per practice" },
  { value: "2–4 hrs", label: "wasted on procurement weekly" },
];

const howItWorks = [
  { step: "01", title: "Connect your suppliers", desc: "Link your existing Henry Schein, Kent Express, Dental Sky and other accounts in under 5 minutes.", icon: Package },
  { step: "02", title: "Search across all catalogues", desc: "One search shows every supplier's price, stock level, and delivery time side by side.", icon: Search },
  { step: "03", title: "Order from one cart", desc: "Add items from any supplier to a unified cart. We submit separate orders to each supplier automatically.", icon: ShoppingCart },
  { step: "04", title: "Track your savings", desc: "See exactly how much you saved versus list price each month, by supplier and category.", icon: BarChart3 },
];

const painPoints = [
  "Logging into 3–7 separate supplier portals",
  "No price comparison without hours of manual work",
  "No stock visibility — backorders discovered after ordering",
  "Multiple invoices to reconcile each month",
  "Ordering from memory leads to stockouts",
  "No visibility into total spend by category",
];

const suppliers = ["Henry Schein","Kent Express","Dental Sky","Trycare","DHB","Wrights","DMI"];

const testimonials = [
  { quote: "I used to spend 3 hours every fortnight on ordering. Now it's 20 minutes. The price comparison alone has saved us over £400 a month.", name: "Sarah M.", role: "Practice Manager, Islington", initials: "SM" },
  { quote: "Finally I can see what we're spending across both practices in one report. The ROI was clear within the first week.", name: "David K.", role: "Principal Dentist, South London", initials: "DK" },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-4 py-24 text-center sm:py-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.62_0.19_220/0.12),transparent)]" />
        <Badge className="mb-6 bg-secondary text-muted-foreground border border-border hover:bg-secondary">Free for UK dental clinics · Forever</Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Order all your dental supplies{" "}<span className="text-primary">from one place</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Dentago aggregates every UK dental supplier catalogue into a single platform. Compare prices, check stock, and place orders across all your suppliers in one unified cart.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/search" className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Search size={18} />Search Products
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted">
            View Dashboard<ArrowRight size={16} />
          </Link>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" />GDC verified practices only</span>
          <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" />No supplier bias · neutral platform</span>
          <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" />Free forever · supplier-funded</span>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-primary sm:text-3xl">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-primary">The problem</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Procurement is broken for dental practices</h2>
            <p className="mt-4 text-muted-foreground">A typical London practice manager opens 3–7 browser tabs, logs in separately to each supplier, manually compares prices, and places multiple orders. This takes 2–4 hours per week and costs ~£480/month in labour alone.</p>
            <ul className="mt-6 space-y-3">
              {painPoints.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border border-destructive/40 bg-destructive/10" />{p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <TrendingDown size={20} className="text-primary" />
              <span className="font-semibold text-foreground">What Dentago gives you</span>
            </div>
            {[["30%","average cost savings reported"],["40%","reduction in procurement time"],["£480/mo","average labour cost saved"],["1 cart","for orders across all suppliers"]].map(([val, desc]) => (
              <div key={val} className="flex items-center gap-4 rounded-md bg-secondary/50 px-4 py-3">
                <span className="text-xl font-bold text-primary w-20 flex-shrink-0">{val}</span>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Up and running in under 10 minutes</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map(({ step, title, desc, icon: Icon }) => (
              <div key={step}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                  <Icon size={18} className="text-primary" />
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Step {step}</p>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Suppliers */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
        <p className="text-sm text-muted-foreground mb-6">Catalogues from all major UK dental suppliers</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {suppliers.map((s) => (
            <span key={s} className="rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground">{s}</span>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-border bg-card py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">From the practices</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Trusted by London clinics</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map(({ quote, name, role, initials }) => (
              <div key={name} className="rounded-lg border border-border bg-secondary/30 p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} className="fill-primary text-primary" />)}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">{initials}</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 text-center">
        <div className="rounded-lg border border-border bg-card px-6 py-16">
          <Zap size={32} className="mx-auto text-primary mb-6" />
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Start saving time and money today</h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">Free for dental clinics, forever. No credit card required. GDC verification takes less than 24 hours.</p>
          <div className="mt-8">
            <Link href="/search" className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              <Search size={18} />Search Products Now
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Clock size={12} />Takes less than 10 minutes to set up
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                <span className="text-[10px] font-bold text-primary-foreground">D</span>
              </div>
              <span>Dentago Ltd · London, UK</span>
            </div>
            <p>© 2025 Dentago Ltd. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
