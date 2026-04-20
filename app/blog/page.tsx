import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Dental Procurement Insights for UK Practices",
  description:
    "Guides, comparisons, and insights on dental procurement for UK practice managers. Learn how to reduce supply costs, compare suppliers, and manage procurement efficiently.",
  alternates: { canonical: "https://www.dentago.co.uk/blog" },
  openGraph: {
    title: "Blog — Dental Procurement Insights for UK Practices",
    description: "Guides and insights on dental procurement for UK practice managers.",
    url: "https://www.dentago.co.uk/blog",
  },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl text-slate-900 tracking-tight">
            Dentago
          </Link>
          <Link
            href="/onboarding/step1.html"
            className="bg-[#6C3DE8] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#5b30d6] transition-colors"
          >
            Get started free
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-14">
          <div className="text-sm font-bold text-[#6C3DE8] uppercase tracking-widest mb-4">Dentago Blog</div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Dental Procurement Insights for UK Practices
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl">
            Practical guides on reducing supply costs, comparing UK dental suppliers, and managing procurement efficiently.
          </p>
        </div>

        <div className="grid gap-8">
          {POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block border border-slate-100 rounded-2xl p-8 hover:border-[#6C3DE8]/30 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold bg-[#6C3DE8]/10 text-[#6C3DE8] px-3 py-1 rounded-full">
                  {post.category}
                </span>
                <span className="text-xs text-slate-400">{post.readTime}</span>
                <span className="text-xs text-slate-400">
                  {new Date(post.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-3 group-hover:text-[#6C3DE8] transition-colors leading-snug">
                {post.title}
              </h2>
              <p className="text-slate-500 leading-relaxed">{post.description}</p>
              <div className="mt-4 text-sm font-bold text-[#6C3DE8] flex items-center gap-1">
                Read article <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-100 mt-20 py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-extrabold text-slate-900">Dentago</span>
          <p className="text-sm text-slate-400">Free dental procurement platform for UK practices.</p>
          <Link
            href="/onboarding/step1.html"
            className="text-sm font-bold text-[#6C3DE8] hover:underline"
          >
            Start for free →
          </Link>
        </div>
      </footer>
    </div>
  );
}
