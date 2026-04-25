"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const SUPPLIERS = [
  { name: "Henry Schein",       domain: "henryschein.co.uk"      },
  { name: "Kent Express",       domain: "kentexpress.co.uk"       },
  { name: "Dental Sky",         domain: "dentalsky.com"           },
  { name: "Dental Directory",   domain: "thedentaldirectory.com"  },
  { name: "Clark Dental",       domain: "clarkdental.co.uk"       },
  { name: "Trycare",            domain: "trycare.co.uk"           },
  { name: "DHB",                domain: "dhbdental.co.uk"         },
  { name: "Wrights",            domain: "wrightsltd.co.uk"        },
];

const PRICE_COMPARISON = [
  { supplier: "Dental Sky",     price: "£4.85", best: true  },
  { supplier: "DHB",            price: "£4.95", best: false },
  { supplier: "Kent Express",   price: "£5.20", best: false },
  { supplier: "Henry Schein",   price: "£5.65", best: false },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Connect your existing supplier accounts",
    body: "Link Henry Schein, Kent Express, Dental Sky and any other supplier you already use. No new accounts, no new sales reps. Takes under 3 minutes.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Search once, see every supplier's price",
    body: "Type any product — gloves, articaine, composite, masks. Every supplier's live price appears side by side in one search. The cheapest is highlighted automatically.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Order from all suppliers in one cart",
    body: "Add from any supplier to one cart. Place one order. Dentago splits and routes it automatically — each supplier gets their order, you get one confirmation.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
];

const FAQS = [
  {
    q: "Do I have to change my suppliers?",
    a: "No. Dentago works with your existing supplier accounts. You keep your negotiated prices, your sales reps, your delivery arrangements. We just bring everything into one place so you can compare and order faster.",
  },
  {
    q: "How is this free?",
    a: "Dentago is completely free for dental practices — no subscription, no transaction fees, no catch. We are currently in growth phase and our model will eventually be supported by suppliers who benefit from the platform. Clinics will always be free.",
  },
  {
    q: "How long does setup take?",
    a: "Most practices are set up and comparing prices within 5 minutes. You connect your existing supplier accounts (just your login credentials), and Dentago does the rest.",
  },
  {
    q: "Is my login data safe?",
    a: "Yes. All supplier credentials are encrypted end-to-end. We never store passwords in plain text and we never share your data with any third party.",
  },
  {
    q: "Which suppliers are supported?",
    a: "Henry Schein, Kent Express, Dental Sky, Dental Directory, Clark Dental, Trycare, DHB, Wrights, and more. We are adding suppliers continuously — if yours isn't listed, let us know and we will prioritise it.",
  },
  {
    q: "What if my practice already has negotiated prices with a supplier?",
    a: "Even better. When you connect your supplier account, Dentago pulls your actual negotiated prices — not list prices. So every comparison you see reflects your real cost, not the public price.",
  },
];

type FormState = { name: string; practice: string; email: string; phone: string };
type Status = "idle" | "loading" | "success" | "error";

function LeadForm({ id, dark = false }: { id: string; dark?: boolean }) {
  const [form, setForm] = useState<FormState>({ name: "", practice: "", email: "", phone: "" });
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("success");
        setForm({ name: "", practice: "", email: "", phone: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className={`rounded-2xl p-8 text-center ${dark ? "bg-white/10 border border-white/20" : "bg-emerald-50 border border-emerald-200"}`}>
        <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className={`text-xl font-bold mb-2 ${dark ? "text-white" : "text-[#151121]"}`}>You're on the list</h3>
        <p className={`text-sm ${dark ? "text-white/70" : "text-slate-600"}`}>
          Mercier will be in touch within a few hours to get your practice set up. Check your inbox.
        </p>
      </div>
    );
  }

  const inputCls = `w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none transition-all ${
    dark
      ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50 focus:bg-white/15"
      : "bg-white border-slate-200 text-[#151121] placeholder:text-slate-400 focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10"
  }`;

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="Your first name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          className={inputCls}
          placeholder="Practice name"
          value={form.practice}
          onChange={e => setForm(f => ({ ...f, practice: e.target.value }))}
          required
        />
      </div>
      <input
        type="email"
        className={inputCls}
        placeholder="Work email address"
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        required
      />
      <input
        type="tel"
        className={inputCls}
        placeholder="Phone number (optional)"
        value={form.phone}
        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-[#6C3DE8] hover:brightness-110 active:scale-[0.98] text-white font-bold text-base py-4 rounded-xl transition-all shadow-lg shadow-[#6C3DE8]/30 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Sending…" : "Get started free — takes 5 minutes"}
      </button>
      {status === "error" && (
        <p className="text-center text-sm text-red-400">Something went wrong. Email us at hello@dentago.co.uk</p>
      )}
      <p className={`text-center text-xs ${dark ? "text-white/40" : "text-slate-400"}`}>
        Free forever for dental practices · No contract · No credit card
      </p>
    </form>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-[#151121] font-sans antialiased">

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#6C3DE8] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <span className="font-black text-lg tracking-tight text-[#151121]">Dentago</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Free for dental practices
            </span>
            <a href="#get-started" className="bg-[#6C3DE8] text-white text-sm font-bold px-4 py-2 rounded-xl hover:brightness-110 transition-all">
              Get started
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-16 pb-20 md:pt-24 md:pb-28">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#6C3DE8]/5 rounded-full translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full -translate-x-1/3 translate-y-1/3" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#6C3DE8]/8 border border-[#6C3DE8]/15 text-[#6C3DE8] text-xs font-bold px-3.5 py-1.5 rounded-full mb-6 uppercase tracking-widest">
                UK Dental Procurement · Free Forever
              </div>

              <h1 className="text-[2.6rem] sm:text-5xl md:text-[3.2rem] lg:text-[3.6rem] font-black leading-[1.07] tracking-tight text-[#151121] mb-5">
                Compare every<br />
                UK dental supplier<br />
                <span className="text-[#6C3DE8]">in one search.</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-8 max-w-lg">
                Stop logging into 5 supplier portals every time you order. Dentago shows you Henry Schein, Kent Express, Dental Sky and 40+ suppliers side by side — and orders from all of them in one cart. Free for your practice.
              </p>

              {/* Mini stats */}
              <div className="flex flex-wrap gap-6 mb-10">
                {[
                  { value: "15–25%", label: "average saving on supplies" },
                  { value: "3 hrs",  label: "saved on procurement weekly" },
                  { value: "5 min",  label: "to connect your accounts" },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-2xl font-black text-[#6C3DE8]">{s.value}</div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {["No contract", "No credit card", "No new supplier accounts", "Free forever"].map(t => (
                  <span key={t} className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} className="w-4 h-4 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: form card */}
            <div id="get-started" className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/60 p-8">
              <h2 className="text-xl font-black text-[#151121] mb-1">Get your practice set up free</h2>
              <p className="text-sm text-slate-500 mb-6">We'll walk you through it personally. Takes 5 minutes.</p>
              <LeadForm id="hero-form" />
            </div>

          </div>
        </div>
      </section>

      {/* ── Supplier logos bar ──────────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50/60 py-8">
        <div className="max-w-6xl mx-auto px-5">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">
            Comparing prices across all major UK dental suppliers
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
            {SUPPLIERS.map(s => (
              <div key={s.name} className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`}
                  alt={s.name}
                  width={20}
                  height={20}
                  className="rounded-sm"
                />
                <span className="text-sm font-semibold text-slate-600">{s.name}</span>
              </div>
            ))}
            <span className="text-sm font-semibold text-slate-400">+ 32 more</span>
          </div>
        </div>
      </section>

      {/* ── Problem section ─────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-[#151121] mb-5 leading-tight">
              The way UK dental practices order supplies is broken.
            </h2>
            <p className="text-lg text-slate-600">
              The average practice manager spends 3–4 hours every week on procurement — logging into separate portals, comparing prices manually, placing 5 separate orders. It costs £480/month in staff time before you've even looked at whether you're getting a good price.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "🔐",
                title: "5 separate logins",
                body: "Henry Schein. Kent Express. Dental Sky. Dental Directory. Trycare. Five separate sites, five separate carts, five separate checkouts. Every. Single. Order.",
                color: "bg-red-50 border-red-100",
                textColor: "text-red-800",
              },
              {
                icon: "💸",
                title: "No price comparison",
                body: "Most practices default to their primary supplier out of habit. The same box of gloves can be 20% cheaper one supplier over — but without a comparison tool, you'd never know.",
                color: "bg-amber-50 border-amber-100",
                textColor: "text-amber-800",
              },
              {
                icon: "📋",
                title: "Invoice chaos",
                body: "5 suppliers means 5 invoices, 5 delivery tracking numbers, 5 sets of payment terms. Reconciliation done manually. Every month. By hand.",
                color: "bg-orange-50 border-orange-100",
                textColor: "text-orange-800",
              },
            ].map(p => (
              <div key={p.title} className={`rounded-2xl border p-7 ${p.color}`}>
                <span className="text-3xl mb-4 block">{p.icon}</span>
                <h3 className={`text-lg font-black mb-2 ${p.textColor}`}>{p.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Price comparison demo ───────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#f7f9fb]">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">

            <div>
              <div className="inline-flex items-center gap-2 bg-[#6C3DE8]/8 border border-[#6C3DE8]/15 text-[#6C3DE8] text-xs font-bold px-3.5 py-1.5 rounded-full mb-5 uppercase tracking-widest">
                Live Price Comparison
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-[#151121] leading-tight mb-5">
                See exactly what<br />every supplier charges.<br />
                <span className="text-[#6C3DE8]">Instantly.</span>
              </h2>
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                Search any product and Dentago pulls live prices from every supplier you're connected to — your actual negotiated prices, not list prices. The cheapest option is highlighted automatically.
              </p>
              <p className="text-base text-slate-600 leading-relaxed">
                Most practices find they're overpaying on at least 3–5 products they order every week. One search session pays for a year of switching.
              </p>
            </div>

            {/* Mock price comparison card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-medium">
                    dentago.co.uk/search?q=nitrile+gloves+large
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Nitrile Examination Gloves — Large (100)
                </div>
                <div className="space-y-2">
                  {PRICE_COMPARISON.map((row, i) => (
                    <div
                      key={row.supplier}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all ${
                        row.best
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-white border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${SUPPLIERS.find(s => s.name === row.supplier)?.domain}&sz=32`}
                          alt={row.supplier}
                          width={18}
                          height={18}
                          className="rounded-sm opacity-80"
                        />
                        <span className={`text-sm font-semibold ${row.best ? "text-emerald-800" : "text-slate-700"}`}>
                          {row.supplier}
                        </span>
                        {row.best && (
                          <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                            Best price
                          </span>
                        )}
                      </div>
                      <div className={`text-base font-black ${row.best ? "text-emerald-700" : "text-slate-900"}`}>
                        {row.price}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-[#6C3DE8]/5 rounded-xl border border-[#6C3DE8]/10">
                  <p className="text-xs text-[#6C3DE8] font-bold text-center">
                    Save £0.80/box · £9.60/year on this product alone
                  </p>
                </div>
                <button className="w-full mt-4 bg-[#6C3DE8] text-white font-bold py-3 rounded-xl text-sm hover:brightness-110 transition-all">
                  Add to cart · Dental Sky
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-[#151121] mb-4">
              Set up in 5 minutes. Save money from minute 6.
            </h2>
            <p className="text-lg text-slate-600">No migration. No training. No new supplier relationships.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[#6C3DE8]/20 to-transparent -translate-x-8 z-0" />
                )}
                <div className="relative">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-[#6C3DE8]/8 border border-[#6C3DE8]/15 flex items-center justify-center text-[#6C3DE8] flex-shrink-0">
                      {step.icon}
                    </div>
                    <span className="text-4xl font-black text-[#6C3DE8]/15">{step.step}</span>
                  </div>
                  <h3 className="text-lg font-black text-[#151121] mb-3 leading-snug">{step.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key benefits ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#151121] text-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Everything your practice needs.<br />
              <span className="text-[#6C3DE8]">Nothing you don't.</span>
            </h2>
            <p className="text-lg text-white/60">Built specifically for UK dental practices. No bloat, no complexity.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "⚡",
                title: "Live price comparison",
                body: "Your actual negotiated prices from every connected supplier, updated in real time. Not estimated. Not last month's data.",
              },
              {
                icon: "🛒",
                title: "One unified cart",
                body: "Add products from any supplier to one cart. Place one order. Dentago routes it to each supplier automatically.",
              },
              {
                icon: "📊",
                title: "Spend analytics",
                body: "See exactly what you spend, by supplier and by category, every month. Know where your money goes before you place the next order.",
              },
              {
                icon: "🔔",
                title: "Smart reorder reminders",
                body: "\"You usually order gloves every 3 weeks — last ordered 21 days ago.\" Never run out of stock again.",
              },
              {
                icon: "🔄",
                title: "Clinical substitutions",
                body: "Product out of stock? Dentago suggests verified clinical equivalents from other suppliers so your order is never delayed.",
              },
              {
                icon: "🔒",
                title: "Encrypted credentials",
                body: "All supplier login credentials are encrypted end-to-end. We never store passwords in plain text. GDPR compliant.",
              },
            ].map(f => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors">
                <span className="text-2xl mb-4 block">{f.icon}</span>
                <h3 className="text-base font-black mb-2 text-white">{f.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Savings callout ─────────────────────────────────────────────────── */}
      <section className="py-16 bg-[#6C3DE8]">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid md:grid-cols-3 gap-8 text-center text-white">
            {[
              { value: "15–25%", label: "average saving on supply costs", sub: "vs. ordering from a single supplier" },
              { value: "3–4 hrs", label: "saved on procurement every week", sub: "per practice manager" },
              { value: "£0",    label: "cost to your practice", sub: "free forever, no contract, no catch" },
            ].map(s => (
              <div key={s.label}>
                <div className="text-5xl md:text-6xl font-black mb-2">{s.value}</div>
                <div className="text-base font-bold opacity-90 mb-1">{s.label}</div>
                <div className="text-sm opacity-55">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-[#151121] mb-4">Built for every UK dental practice</h2>
            <p className="text-lg text-slate-600">Whether you manage one chair or twenty, Dentago adapts to how you work.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Practice Managers",
                icon: "👩‍💼",
                points: [
                  "Compare prices across all your suppliers in one search",
                  "Order from every supplier in one cart",
                  "Reorder alerts so you never run out of stock",
                  "One clear order history instead of 5 portals",
                ],
              },
              {
                title: "Practice Owners",
                icon: "🏥",
                points: [
                  "Full visibility of monthly supply spend",
                  "See exactly how much you save vs. market price",
                  "Spend analytics by category and supplier",
                  "Identify where the practice is overpaying",
                ],
              },
              {
                title: "DSOs & Group Practices",
                icon: "🏢",
                points: [
                  "Centralised procurement across all locations",
                  "Approval workflows for large orders",
                  "Consolidated billing across all practices",
                  "Per-location spend breakdown",
                ],
              },
            ].map(persona => (
              <div key={persona.title} className="border border-slate-200 rounded-2xl p-7">
                <span className="text-3xl mb-4 block">{persona.icon}</span>
                <h3 className="text-lg font-black text-[#151121] mb-5">{persona.title}</h3>
                <ul className="space-y-3">
                  {persona.points.map(p => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#6C3DE8" strokeWidth={2.5} className="w-4 h-4 flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#f7f9fb]">
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl font-black text-[#151121] text-center mb-12">
            Questions we always get
          </h2>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
                >
                  <span className="font-bold text-[#151121] text-sm md:text-base">{faq.q}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className={`w-5 h-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#151121] text-white">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <div className="inline-flex items-center gap-2 bg-[#6C3DE8]/20 border border-[#6C3DE8]/30 text-[#a78bfa] text-xs font-bold px-3.5 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            Free for UK Dental Practices
          </div>

          <h2 className="text-3xl md:text-5xl font-black mb-5 leading-tight">
            Start saving on supplies<br />this week.
          </h2>

          <p className="text-lg text-white/60 mb-10">
            Fill in the form and Mercier — Dentago's founder — will personally get your practice set up within a few hours. No sales team. No wait.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
            <LeadForm id="bottom-form" dark />
          </div>

          <p className="text-xs text-white/30 mt-6">
            Dentago · dentago.co.uk · hello@dentago.co.uk
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#6C3DE8] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-slate-600">Dentago</span>
            <span>· Free dental procurement platform for UK practices</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <a href="mailto:hello@dentago.co.uk" className="hover:text-slate-600 transition-colors">hello@dentago.co.uk</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
