"use client";
import Link from "next/link";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Nav */}
      <nav className="fixed top-0 w-full rounded-b-2xl bg-white/80 backdrop-blur-xl shadow-[0px_12px_32px_rgba(25,28,30,0.04)] z-50">
        <div className="flex justify-between items-center px-8 h-20 max-w-7xl mx-auto">
          <Link href="/" className="text-2xl font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</Link>
          <div className="flex gap-4 items-center">
            <Link href="/dashboard" className="text-slate-600 font-bold text-sm px-4 py-2 hover:opacity-70 transition-all">Log In</Link>
            <Link href="/search" className="bg-[#6C3DE8] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all">Get Started Free</Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 max-w-5xl mx-auto px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-[#6C3DE8]/5 px-4 py-1.5 rounded-full text-xs font-bold text-[#6C3DE8] mb-6 uppercase tracking-[0.1em]">
            <span>Free 30-Minute Demo</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#151121] leading-tight mb-4">
            See Dentago in Action
          </h1>
          <p className="text-lg text-[#494455] font-medium max-w-xl mx-auto">
            Book a personalised walkthrough with our team. We'll show you how Dentago saves your practice time and money from day one.
          </p>
        </div>

        {/* Two column: benefits + calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
          {/* Benefits */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6">
              <h2 className="font-extrabold text-lg text-slate-900">What you'll get</h2>
              {[
                { icon: "search", title: "Live price comparison", desc: "See exactly how much you're overpaying across your current suppliers." },
                { icon: "shopping_cart_checkout", title: "Unified checkout walkthrough", desc: "Watch how a multi-supplier order gets placed in under 2 minutes." },
                { icon: "psychology", title: "AI assistant demo", desc: "See real-time substitution suggestions and stock alerts." },
                { icon: "payments", title: "Savings estimate for your practice", desc: "We'll run a live estimate based on your spend profile." },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6C3DE8]/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#6C3DE8] text-[20px]">{icon}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{title}</p>
                    <p className="text-slate-500 text-xs font-medium mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#6C3DE8]/5 rounded-3xl border border-[#6C3DE8]/10 p-8">
              <p className="text-[#6C3DE8] font-bold text-sm italic leading-relaxed">
                &ldquo;The 30 minute demo paid for itself — we found £800 of savings in the first week.&rdquo;
              </p>
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mt-4">— Practice Manager, Bristol</p>
            </div>
          </div>

          {/* Calendly embed */}
          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <iframe
              src="https://calendly.com/dentago/demo"
              width="100%"
              height="700"
              frameBorder="0"
              title="Book a Dentago demo"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
