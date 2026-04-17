"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  return (
    <div className="bg-[#f7f9fb] text-[#151121]">
      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full rounded-b-2xl bg-white/80 backdrop-blur-xl shadow-[0px_12px_32px_rgba(25,28,30,0.04)] z-50">
        <div className="flex justify-between items-center px-8 h-20 max-w-7xl mx-auto">
          <div className="text-2xl font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</div>
          <div className="flex gap-4 items-center">
            <Link href="/onboarding/login.html" className="text-slate-600 font-bold text-sm px-4 py-2 hover:opacity-70 transition-all">Log In</Link>
            <Link href="/onboarding/step1.html" className="bg-[#6C3DE8] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all">Get Started Free</Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20">
        {/* ── HERO ── */}
        <section className="max-w-7xl mx-auto px-8 mb-24 text-center">
          <div className="inline-flex items-center space-x-2 bg-[#6C3DE8]/5 px-4 py-1.5 rounded-full text-xs font-bold text-[#6C3DE8] mb-8 uppercase tracking-[0.1em]">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>Procurement Reimagined</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-[#151121] leading-[1.05] mb-8">
            The Fastest Way to <br />Order <span className="text-[#6C3DE8] italic">Dental Supplies.</span>
          </h1>
          <p className="text-xl text-[#494455] max-w-2xl mx-auto mb-12 font-medium leading-relaxed opacity-80">
            Compare 45+ UK suppliers in one interface. Stop manual spreadsheets and start saving 15% on every order.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
            <Link href="/onboarding/step1.html" className="w-full sm:w-auto bg-[#6C3DE8] text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-2xl shadow-[#6C3DE8]/20 transition-all hover:scale-105 active:scale-95 text-center">
              Start Saving Now
            </Link>
            <Link href="/demo" className="w-full sm:w-auto bg-white text-[#151121] px-10 py-5 rounded-2xl font-bold text-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50 active:scale-95 text-center">
              Book a Demo
            </Link>
          </div>
        </section>

        {/* ── STOP OVERPAYING / SEARCH COMPARE ── */}
        <section className="max-w-7xl mx-auto px-8 mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-center">
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#151121] leading-[1.1]">
                Stop Overpaying. <br /><span className="text-[#6C3DE8]">Start Comparing.</span>
              </h2>
              <p className="text-lg text-[#494455] leading-relaxed opacity-90">
                Access 100k+ Dental SKU&apos;s from dozens of suppliers all from one marketplace. No more jumping between tabs to find out who has the best price for composite.
              </p>
              <div className="space-y-4 pt-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6C3DE8]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#6C3DE8] text-[20px]">insights</span>
                  </div>
                  <span className="font-bold text-slate-700">Real-time price auditing</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6C3DE8]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#6C3DE8] text-[20px]">verified</span>
                  </div>
                  <span className="font-bold text-slate-700">Verified UK-only suppliers</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="floating-card overflow-hidden">
                <div className="p-8 border-b border-slate-50">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-5 flex items-center text-slate-400">
                      <span className="material-symbols-outlined">search</span>
                    </span>
                    <input
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-slate-900 font-bold placeholder:text-slate-400"
                      readOnly
                      type="text"
                      value="Nitrile Exam Gloves"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-slate-400 uppercase text-[10px] font-bold tracking-[0.2em]">
                        <th className="px-8 py-6">Product</th>
                        <th className="px-4 py-6 text-right">Henry Schein</th>
                        <th className="px-4 py-6 text-right">Dental Sky</th>
                        <th className="px-8 py-6 text-right text-[#6C3DE8]">Best Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                              <Image
                                src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=80&h=80&fit=crop"
                                alt="Gloves"
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">Nitrile Exam Gloves</div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold">100 Pack • Blue</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-right font-semibold text-slate-500">£12.50</td>
                        <td className="px-4 py-6 text-right font-semibold text-slate-500">£11.20</td>
                        <td className="px-8 py-6 text-right font-extrabold text-[#6C3DE8]">£9.95</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors bg-[#6C3DE8]/[0.02]">
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                              <span className="material-symbols-outlined text-slate-400">medication</span>
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">3M Filtek Supreme</div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold">A2 Shade • 4g</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-right font-semibold text-slate-500">£45.00</td>
                        <td className="px-4 py-6 text-right font-semibold text-slate-500">£42.50</td>
                        <td className="px-8 py-6 text-right font-extrabold text-[#6C3DE8]">£38.90</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="p-6 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Showing real-time stock from 45+ suppliers
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── UNIFIED CHECKOUT ── */}
        <section className="max-w-7xl mx-auto px-8 mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="floating-card p-10 space-y-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-extrabold text-2xl text-slate-900">Unified Checkout</h3>
                  <div className="bg-[#6C3DE8]/10 text-[#6C3DE8] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">3 Suppliers</div>
                </div>
                <div className="space-y-4">
                  {[
                    { abbr: "HS", name: "Henry Schein", amount: "£142.50", color: "bg-blue-100 text-blue-600" },
                    { abbr: "DS", name: "Dental Sky", amount: "£89.00", color: "bg-purple-100 text-purple-600" },
                    { abbr: "KE", name: "Kent Express", amount: "£215.40", color: "bg-orange-100 text-orange-600" },
                  ].map(({ abbr, name, amount, color }) => (
                    <div key={name} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center font-bold text-xs`}>{abbr}</div>
                        <span className="font-bold text-slate-700">{name}</span>
                      </div>
                      <span className="font-extrabold text-slate-900">{amount}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <button className="w-full bg-[#6C3DE8] text-white py-5 rounded-2xl font-bold flex items-center justify-center space-x-3 hover:brightness-110 transition-all hover:scale-[1.02]">
                    <span>Place Combined Order</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                  <p className="text-[11px] text-center mt-6 text-slate-400 font-medium italic">
                    We automatically route orders to each individual distributor for you.
                  </p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-8">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#151121] leading-[1.1]">
                One Cart. <br /><span className="text-[#6C3DE8] italic">All Suppliers.</span>
              </h2>
              <p className="text-lg text-[#494455] leading-relaxed opacity-90 max-w-lg">
                Why login to five different websites? Add items from across the market to a single unified cart. One checkout, multiple fulfillment sources.
              </p>
              <div className="p-8 rounded-[2rem] border border-[#6C3DE8]/10 relative">
                <p className="text-[#6C3DE8] font-bold text-lg leading-relaxed italic">
                  &ldquo;Dentago saved our practice manager 4 hours of ordering time in the first week. It&apos;s a total game changer.&rdquo;
                </p>
                <div className="mt-6 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden ring-4 ring-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400">person</span>
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900">Dr. Sarah Jenkins</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Principal Dentist, London</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="max-w-7xl mx-auto px-8 mb-40">
          <div className="text-center mb-20 space-y-4">
            <div className="inline-flex items-center space-x-2 bg-[#006c49]/5 px-4 py-1.5 rounded-full text-[10px] font-black text-[#006c49] mb-4 uppercase tracking-[0.2em]">
              <span>The Process</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">How Dentago Works</h2>
            <p className="text-[#494455] max-w-2xl mx-auto font-medium text-lg">
              Four simple steps to transform your clinic&apos;s procurement from a headache into a superpower.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { num: "1", icon: "person_add", title: "Create your free account", desc: "Sign up with your email. No credit card, no contract, no commitment.", color: "bg-[#6C3DE8]/10 text-[#6C3DE8]" },
              { num: "2", icon: "verified_user", title: "Verify your practice", desc: "Submit your GDC registration and practice documents. Approved within 24 hours.", color: "bg-[#006c49]/10 text-[#006c49]" },
              { num: "3", icon: "link", title: "Connect your suppliers", desc: "Link existing accounts with Henry Schein, Kent Express & others. Pricing applies automatically.", color: "bg-[#6C3DE8]/10 text-[#6C3DE8]" },
              { num: "4", icon: "shopping_cart_checkout", title: "Search, compare, order", desc: "Find any product, see every supplier's price, add to one cart, place all orders at once.", color: "bg-[#006c49]/10 text-[#006c49]" },
            ].map(({ num, icon, title, desc, color }) => (
              <div key={num} className="floating-card p-10 relative overflow-hidden group">
                <div className="absolute -top-6 -right-4 text-9xl font-black text-slate-50/80 group-hover:text-[#6C3DE8]/5 transition-colors select-none z-0">{num}</div>
                <div className="relative z-10">
                  <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-8`}>
                    <span className="material-symbols-outlined text-3xl">{icon}</span>
                  </div>
                  <h3 className="text-xl font-extrabold mb-4 text-slate-900">{title}</h3>
                  <p className="text-[#494455] leading-relaxed font-medium text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SPEND AUDIT ── */}
        <section className="max-w-7xl mx-auto px-8 mb-32">
          <div className="floating-card bg-[#6C3DE8] p-10 md:p-16 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-48 -mt-48" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-3xl -ml-48 -mb-48" />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                  Where are you overpaying?
                </h2>
                <p className="text-lg text-white/80 leading-relaxed font-medium">
                  Upload your last 3 supplier invoices. Our audit team will cross-reference them with 100,000+ live prices to find exactly where you can save.
                </p>
                <div className="space-y-4">
                  {[
                    "Average audit finds £4,200 in annual savings",
                    "100% data privacy & GDPR compliance",
                  ].map((item) => (
                    <div key={item} className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-[#10b981] flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-white text-[16px]">check</span>
                      </div>
                      <span className="font-bold text-white/90">{item}</span>
                    </div>
                  ))}
                </div>
                <button className="bg-white text-[#6C3DE8] px-10 py-5 rounded-2xl font-extrabold text-lg shadow-xl transition-all hover:scale-105 active:scale-95">
                  Get Your Free Spend Audit
                </button>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl text-slate-900">
                  <div className="mb-10">
                    <h4 className="font-extrabold text-xl text-slate-900">Audit Result: Marylebone Dental</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">JULY 2024</p>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-3">
                        <span className="text-slate-500 uppercase tracking-widest">Current Spend</span>
                        <span className="text-slate-900 text-sm">£28,450</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="w-full h-full bg-[#6C3DE8]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-3">
                        <span className="text-[#006c49] uppercase tracking-widest">Dentago Optimized</span>
                        <span className="text-[#006c49] text-sm">£23,120</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="w-[82%] h-full bg-[#006c49]" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-12 pt-10 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Potential Saving</p>
                      <p className="text-5xl font-extrabold text-[#006c49] tracking-tighter">£5,330</p>
                    </div>
                    <div className="w-20 h-20 rounded-full border-4 border-[#006c49]/10 flex items-center justify-center relative">
                      <span className="text-[#006c49] font-extrabold text-xl">18%</span>
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle className="text-[#006c49]" cx="40" cy="40" fill="none" r="36" stroke="currentColor" strokeDasharray="226" strokeDashoffset="40" strokeWidth="4" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── VALUE PROPS ── */}
        <section className="max-w-7xl mx-auto px-8 mb-32">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight">Supply Management, Simplified.</h2>
            <p className="text-[#494455] max-w-2xl mx-auto font-medium">
              We don&apos;t charge clinics a penny. Our mission is to make the dental supply chain transparent and efficient.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "payments", color: "bg-[#006c49]/10 text-[#006c49]", fill: true, title: "Always Free for Clinics", desc: "No subscriptions, no hidden fees, and no markups. We get paid by suppliers, ensuring you always get the best market rate." },
              { icon: "shopping_cart", color: "bg-[#6C3DE8]/10 text-[#6C3DE8]", fill: true, title: "Unified Checkout", desc: "Add items from 5 different suppliers into one single cart. One checkout, one invoice, zero procurement headaches." },
              { icon: "auto_awesome", color: "bg-purple-100 text-[#6C3DE8]", fill: true, title: "Smart Substitutions", desc: "Our algorithm suggests clinically equivalent products that cost less. Dentago users save an average of 18% by switching to high quality alternatives." },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} className="floating-card p-10">
                <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center mb-8`}>
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <h3 className="text-2xl font-extrabold mb-4">{title}</h3>
                <p className="text-[#494455] leading-relaxed font-medium">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── AI ASSISTANT ── */}
        <section className="max-w-7xl mx-auto px-8 mb-32">
          <div className="floating-card p-10 md:p-16 bg-white overflow-hidden relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
              <div className="space-y-8">
                <div className="inline-flex items-center space-x-2 bg-[#6C3DE8]/5 px-4 py-1.5 rounded-full text-xs font-bold text-[#6C3DE8] uppercase tracking-[0.1em]">
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  <span>Intelligence</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#151121] leading-[1.1]">
                  Meet your <span className="text-[#6C3DE8] italic">AI Procurement Assistant.</span>
                </h2>
                <p className="text-lg text-[#494455] leading-relaxed opacity-90 max-w-lg">
                  Our intelligent AI monitors price fluctuations, suggests clinical equivalents that cost less, and predicts when you&apos;re running low on stock — so you never overpay or run out.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button className="bg-[#6C3DE8] text-white px-8 py-4 rounded-xl font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all">Activate AI Assistant</button>
                  <button className="bg-slate-50 text-slate-600 px-8 py-4 rounded-xl font-bold text-sm border border-slate-200 hover:bg-slate-100 transition-all">See Examples</button>
                </div>
              </div>
              <div className="relative">
                <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 shadow-inner space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Insights Live</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 text-[20px]">more_horiz</span>
                  </div>
                  {[
                    { border: "border-[#10b981]", bg: "bg-[#10b981]/10 text-[#10b981]", icon: "swap_horiz", text: "Switch to Eco-Preferred Nitrile Gloves to save £145 this month.", sub: "CLINICAL EQUIVALENT IDENTIFIED" },
                    { border: "border-[#6C3DE8]", bg: "bg-[#6C3DE8]/10 text-[#6C3DE8]", icon: "inventory_2", text: "Low stock alert: Composite Resin A2", sub: "Only 3 units remaining based on your usage patterns." },
                    { border: "border-[#10b981]", bg: "bg-[#10b981]/10 text-[#10b981]", icon: "trending_down", text: "Identified 3 equivalent products at 12% lower cost.", sub: null },
                  ].map(({ border, bg, icon, text, sub }) => (
                    <div key={icon} className={`bg-white p-5 rounded-2xl shadow-sm border-l-4 ${border} flex items-start space-x-4`}>
                      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                        <span className="material-symbols-outlined text-[20px]">{icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{text}</p>
                        {sub && <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{sub}</p>}
                      </div>
                    </div>
                  ))}
                  <div className="pt-4">
                    <div className="relative">
                      <input
                        className="w-full bg-white border border-slate-200 rounded-full py-3 px-5 text-xs text-slate-900 pr-12"
                        placeholder="Ask AI: 'Where can I save on infection control?'"
                        readOnly
                        type="text"
                      />
                      <button className="absolute right-2 top-1.5 w-8 h-8 rounded-full bg-[#6C3DE8] flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-[16px]">send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-4xl mx-auto px-8 mb-32">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight">Got Questions?</h2>
            <p className="text-[#494455] font-medium">Everything you need to know about switching your procurement to Dentago.</p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "Is it really free?",
                a: "Yes, Dentago is 100% free for dental clinics. We don't charge subscription fees, transaction fees, or add any markups to the prices you see. The price you pay on Dentago is the same (or lower) than what you'd pay direct.",
              },
              {
                q: "What happens to my existing supplier relationships?",
                a: "Nothing changes! You can still use your existing accounts. In fact, you can link your current supplier accounts to Dentago to see your specific negotiated contract pricing alongside market rates.",
              },
              {
                q: "How is my data protected?",
                a: "We take security seriously. We are fully GDPR compliant and use bank-level encryption (AES-256) to protect your clinic's information. We never sell your data to third parties.",
              },
            ].map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-slate-100 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-sm text-[#494455] mb-20">
            <div className="col-span-2 md:col-span-1">
              <div className="text-2xl font-extrabold text-slate-900 mb-6">Dentago</div>
              <p className="leading-relaxed opacity-70 font-medium">
                Empowering clinics with data-driven procurement tools for a more efficient healthcare future.
              </p>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 mb-6 uppercase tracking-wider text-xs">Product</h4>
              <ul className="space-y-4 font-bold">
                {["Price Compare", "Unified Cart", "Supplier Portal"].map((item) => (
                  <li key={item}><a className="hover:text-[#6C3DE8] transition-colors" href="#">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 mb-6 uppercase tracking-wider text-xs">Company</h4>
              <ul className="space-y-4 font-bold">
                {["About Us", "Careers", "Contact"].map((item) => (
                  <li key={item}><a className="hover:text-[#6C3DE8] transition-colors" href="#">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 mb-6 uppercase tracking-wider text-xs">Legal</h4>
              <ul className="space-y-4 font-bold">
                {["Privacy Policy", "Terms of Service"].map((item) => (
                  <li key={item}><a className="hover:text-[#6C3DE8] transition-colors" href="#">{item}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <div>© 2024 Dentago Ltd. Proudly based in London.</div>
            <div className="flex space-x-8 mt-6 md:mt-0">
              <a className="hover:text-[#6C3DE8] transition-colors" href="#">LinkedIn</a>
              <a className="hover:text-[#6C3DE8] transition-colors" href="#">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-white border rounded-[2rem] overflow-hidden transition-colors duration-300 ${open ? "border-[#6C3DE8]/30" : "border-slate-200 hover:border-[#6C3DE8]/30"}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-8 cursor-pointer text-left"
      >
        <span className="text-lg font-bold text-[#151121]">{q}</span>
        <span
          className={`material-symbols-outlined text-slate-400 transition-transform duration-300 flex-shrink-0 ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-8" : "max-h-0"}`}>
        <p className="px-8 text-[#494455] leading-relaxed font-medium">{a}</p>
      </div>
    </div>
  );
}
