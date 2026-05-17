"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const SOCIAL_PROOF = [
  { initials: "SK", name: "Sarah K.", role: "Practice Manager, London", quote: "We saved over £400 in the first month just by switching one supplier for composites." },
  { initials: "JM", name: "James M.", role: "Principal Dentist, Manchester", quote: "Took 5 minutes to set up and I could immediately see where we were overpaying." },
  { initials: "PT", name: "Priya T.", role: "Practice Owner, Birmingham", quote: "Finally a way to compare Henry Schein and Kent Express side by side. Game changer." },
];

const STATS = [
  { value: "£2k+",   label: "Average monthly saving per practice" },
  { value: "8–15%",  label: "Typical saving vs your current supplier" },
  { value: "32,000+",label: "Products compared across 9 UK suppliers" },
  { value: "Free",   label: "Forever — no subscription, no markup" },
];

export default function WatchPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted,   setMuted]   = useState(false);
  const [booked,  setBooked]  = useState(false);

  // Listen for Calendly booking confirmation
  useEffect(() => {
    function handleCalendly(e: MessageEvent) {
      if (e.data?.event === "calendly.event_scheduled") {
        setBooked(true);
      }
    }
    window.addEventListener("message", handleCalendly);
    return () => window.removeEventListener("message", handleCalendly);
  }, []);

  function handlePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true); }
    else                          { videoRef.current.pause(); setPlaying(false); }
  }

  function handleFullscreen(e: React.MouseEvent) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    try {
      const vAny = v as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      if (typeof vAny.webkitEnterFullscreen === "function") {
        void v.play().catch(() => {});
        vAny.webkitEnterFullscreen();
        return;
      }
      if (typeof v.requestFullscreen === "function") {
        void v.requestFullscreen().catch(() => {});
        return;
      }
      const vEl = v as HTMLElement & { webkitRequestFullscreen?: () => void; msRequestFullscreen?: () => void };
      if (typeof vEl.webkitRequestFullscreen === "function") {
        vEl.webkitRequestFullscreen();
        return;
      }
      vEl.msRequestFullscreen?.();
    } catch {
      /* unsupported */
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121]">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-6 h-[60px] max-w-5xl mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[#111111]">Dentago</Link>
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="text-sm font-semibold text-slate-500 hover:text-[#111111] transition-colors px-4 py-2">
              Log in
            </Link>
            <Link href="/signup"
              className="flex items-center gap-2 bg-[#111111] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:brightness-110 shadow-md shadow-[#111111]/20 transition-all active:scale-95">
              Get started free
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-24">

        {/* Hero — wider subtitle so body copy wraps to ~2 lines */}
        <div className="max-w-5xl mx-auto px-6 text-center pt-12 pb-8">
          <div className="inline-flex items-center gap-2 bg-[#111111]/8 border border-[#111111]/15 text-[#111111] text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#111111] animate-pulse" />
            2-minute demo — no sign-up required
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter leading-[1.07] text-[#151121] mb-5">
            Your practice is paying
            <br />
            <span className="text-[#111111]">too much for supplies.</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium max-w-4xl mx-auto leading-relaxed">
            Watch how Dentago compares prices across every major UK dental supplier in seconds —
            so you always buy at the best price without changing who you use.
          </p>
        </div>

        {/* Video */}
        <div className="max-w-5xl mx-auto px-6 mb-10">
          <div
            onClick={handlePlay}
            className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-[0_20px_60px_rgba(17,17,17,0.15)] border border-slate-200 group cursor-pointer"
          >
            <video
              ref={videoRef}
              src="/demo.mp4"
              className="w-full aspect-video object-cover"
              playsInline
              muted={muted}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />

            {/* Play overlay */}
            {!playing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/15 transition-colors">
                <div className="w-20 h-20 rounded-full bg-white shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-8 h-8 text-[#111111] ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-3 bg-gradient-to-t from-black/50 to-transparent transition-opacity z-[15] ${playing ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}>
              <button type="button" onClick={e => { e.stopPropagation(); handlePlay(); }}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                {playing
                  ? <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
                  : <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                }
              </button>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Enter full screen" onClick={handleFullscreen}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
                <button type="button"
                  onClick={e => { e.stopPropagation(); if (videoRef.current) { videoRef.current.muted = !muted; setMuted(!muted); } }}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  {muted
                    ? <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-14.96-8.5L3.46 5.07 7 8.61V11H4v2h3l4 4V12.41l3.46 3.46c-.52.39-1.1.67-1.73.84v2.06c1.12-.3 2.14-.86 3-1.6L18.95 21l1.41-1.41L3.46 3.54zM7 9.83L5 7.83V11H4v2h1l2 2V9.83zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                    : <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Full screen — above overlay so it stays tappable */}
            <div className="absolute top-3 right-3 z-20 pointer-events-auto">
              <button
                type="button"
                aria-label="Enter full screen"
                onClick={handleFullscreen}
                className="w-10 h-10 rounded-xl bg-black/45 hover:bg-black/60 backdrop-blur-sm border border-white/15 flex items-center justify-center transition-colors shadow-lg"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-center text-slate-400 text-xs mt-3 font-medium">Click to play · Full screen icon (top-right or in player bar)</p>
        </div>

        {/* Stats strip */}
        <div className="max-w-4xl mx-auto px-6 mb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STATS.map(s => (
              <div key={s.label} className="bg-white border border-slate-100 rounded-2xl px-5 py-4 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-[#111111] tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-400 font-medium mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Calendly — horizontal layout (copy + embed), above How it works */}
        <div className="max-w-6xl mx-auto px-6 mb-12" id="book">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_4px_32px_rgba(17,17,17,0.08)] overflow-hidden">
            {booked ? (
              <div className="px-8 py-12 text-center border-slate-100">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[28px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <h2 className="text-xl font-extrabold text-[#151121] mb-1">You&apos;re booked in</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">Check your email for the calendar invite. We&apos;ll show you exactly how much you can save.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
                {/* Left rail — condensed for horizontal page flow */}
                <div className="md:col-span-4 px-6 sm:px-8 py-8 md:py-10 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center md:min-h-[620px]">
                  <div className="max-w-sm mx-auto md:mx-0 text-center md:text-left">
                    <div className="w-12 h-12 rounded-2xl bg-[#111111]/10 flex items-center justify-center mx-auto md:mx-0 mb-4">
                      <span className="material-symbols-outlined text-[22px] text-[#111111]" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                    </div>
                    <h2 className="text-xl font-extrabold text-[#151121] mb-2">See exactly how much you&apos;ll save</h2>
                    <p className="text-sm text-slate-500 leading-relaxed mb-6">
                      Book a 15-minute call. We&apos;ll walk through your current suppliers and show you the savings on your actual products — no obligation.
                    </p>
                    <div className="flex flex-col sm:flex-row md:flex-col gap-3 sm:gap-x-6 text-xs text-slate-500 font-medium justify-center md:justify-start">
                      <div className="flex items-center justify-center md:justify-start gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-[#111111] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                        15 minutes
                      </div>
                      <div className="flex items-center justify-center md:justify-start gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-[#111111] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>videocam</span>
                        Google Meet or phone
                      </div>
                      <div className="flex items-center justify-center md:justify-start gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-[#111111] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
                        Free, no obligation
                      </div>
                    </div>
                  </div>
                </div>

                {/* Embed — wide column so Calendly shows calendar + times side‑by‑side */}
                <div className="md:col-span-8 w-full bg-slate-50/60 min-h-[600px] md:min-h-[620px] overflow-x-auto">
                  <iframe
                    src="https://calendly.com/rnsv/dentago-introduction?hide_landing_page_details=1&hide_gdpr_banner=1&primary_color=6C3DE8"
                    width="100%"
                    height="700"
                    frameBorder="0"
                    title="Book a demo call"
                    className="border-0 w-full block min-h-[600px] md:h-[700px] md:min-h-[700px]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-4xl mx-auto px-6 mb-12">
          <h2 className="text-lg font-extrabold text-center mb-6 text-[#151121]">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { n: "1", icon: "link",          title: "Connect your suppliers",     body: "Link the accounts you already have with Henry Schein, Dental Sky, Kent Express and more. Takes under 2 minutes." },
              { n: "2", icon: "search",         title: "Search & compare prices",    body: "We compare the same product across all your connected suppliers instantly. The best price is highlighted." },
              { n: "3", icon: "savings",        title: "Order and keep the saving",  body: "Place your order through Dentago. Your supplier delivers as normal — nothing changes except the price you pay." },
            ].map(step => (
              <div key={step.n} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="w-10 h-10 rounded-2xl bg-[#111111]/10 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[20px] text-[#111111]" style={{ fontVariationSettings: "'FILL' 1" }}>{step.icon}</span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#111111]/50 mb-1">Step {step.n}</p>
                <h3 className="text-sm font-extrabold text-[#151121] mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="max-w-4xl mx-auto px-6 mb-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SOCIAL_PROOF.map(p => (
              <div key={p.name} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-[#111111] flex items-center justify-center text-white text-xs font-black flex-shrink-0">{p.initials}</div>
                  <div>
                    <p className="text-sm font-bold text-[#151121] leading-tight">{p.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{p.role}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed italic">&ldquo;{p.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA — sign up alternative */}
        <div className="max-w-3xl mx-auto px-6 mt-8 text-center">
          <p className="text-sm text-slate-400 mb-4">Prefer to try it yourself first?</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#111111] text-white font-bold px-7 py-3.5 rounded-2xl hover:brightness-110 shadow-md shadow-[#111111]/20 transition-all active:scale-95 text-sm"
          >
            Create your free account
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
          <p className="text-slate-300 text-[11px] mt-3">GDC-verified practices only · free forever · no hidden fees</p>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 bg-white">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-xs font-medium">
          <Link href="/" className="font-extrabold tracking-tighter text-[#111111] text-base">Dentago</Link>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <a href="mailto:support@dentago.co.uk" className="hover:text-slate-600 transition-colors">Contact</a>
          </div>
          <span>© {new Date().getFullYear()} Dentago Ltd</span>
        </div>
      </footer>

    </div>
  );
}
