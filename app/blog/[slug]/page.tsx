import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POSTS, getPost } from "@/lib/blog";

export async function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `https://www.dentago.co.uk/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://www.dentago.co.uk/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
      authors: ["Dentago"],
      images: [{ url: post.image, alt: post.imageAlt }],
    },
  };
}

// ── Content renderer ──────────────────────────────────────────────────────────
function renderContent(content: string) {
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;
  let listBuffer: string[] = [];

  function flushList() {
    if (!listBuffer.length) return;
    elements.push(
      <ul key={key++} className="my-6 space-y-3">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex gap-3 text-lg text-slate-700 leading-relaxed">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-[#6C3DE8] flex-shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: inlineBold(item) }} />
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  function inlineBold(text: string) {
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-3xl font-extrabold text-slate-900 mt-14 mb-6 tracking-tight leading-tight">
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      listBuffer.push(trimmed.slice(2));
      continue;
    }

    // CTA button
    if (trimmed.match(/^\[.+\]\(.+\)$/)) {
      flushList();
      const match = trimmed.match(/^\[(.+)\]\((.+)\)$/);
      if (match) {
        elements.push(
          <div key={key++} className="my-12 p-8 bg-gradient-to-br from-[#6C3DE8]/5 to-[#6C3DE8]/10 rounded-2xl border border-[#6C3DE8]/20 text-center">
            <p className="text-lg font-bold text-slate-900 mb-4">Ready to start saving on dental supplies?</p>
            <p className="text-slate-500 mb-6">Join UK dental practices already comparing prices across all their suppliers in one place.</p>
            <Link
              href={match[2]}
              className="inline-flex items-center gap-2 bg-[#6C3DE8] text-white font-bold px-8 py-4 rounded-xl hover:bg-[#5b30d6] transition-colors text-base shadow-lg shadow-[#6C3DE8]/25"
            >
              {match[1]} →
            </Link>
          </div>
        );
      }
      continue;
    }

    // Stat callout — lines that start with a £ sign or contain a percentage stat
    const isStatLine = /^(£[\d,]+|[\d]+%)/.test(trimmed);
    if (isStatLine) {
      flushList();
      elements.push(
        <div key={key++} className="my-8 pl-6 border-l-4 border-[#6C3DE8] bg-[#6C3DE8]/5 rounded-r-xl py-4 pr-4">
          <p
            className="text-xl font-bold text-slate-900 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: inlineBold(trimmed) }}
          />
        </div>
      );
      continue;
    }

    flushList();
    elements.push(
      <p
        key={key++}
        className="text-lg text-slate-700 leading-relaxed my-5"
        dangerouslySetInnerHTML={{ __html: inlineBold(trimmed) }}
      />
    );
  }

  flushList();
  return elements;
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const otherPosts = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    image: post.image,
    author: { "@type": "Organization", name: "Dentago", url: "https://www.dentago.co.uk" },
    publisher: { "@type": "Organization", name: "Dentago", url: "https://www.dentago.co.uk" },
    mainEntityOfPage: `https://www.dentago.co.uk/blog/${post.slug}`,
    keywords: post.keywords.join(", "),
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl text-slate-900 tracking-tight">Dentago</Link>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">Blog</Link>
            <Link
              href="/onboarding/step1.html"
              className="bg-[#6C3DE8] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#5b30d6] transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero image */}
      <div className="relative w-full h-[400px] sm:h-[500px] overflow-hidden">
        <Image
          src={post.image}
          alt={post.imageAlt}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-14 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold bg-[#6C3DE8] text-white px-3 py-1 rounded-full">{post.category}</span>
            <span className="text-xs text-white/70 font-medium">{post.readTime}</span>
            <span className="text-xs text-white/70 font-medium">
              {new Date(post.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {post.title}
          </h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-14">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-10">
          <Link href="/blog" className="hover:text-[#6C3DE8] transition-colors font-medium">← Back to blog</Link>
        </div>

        {/* Description */}
        <p className="text-xl text-slate-500 leading-relaxed border-l-4 border-[#6C3DE8] pl-6 mb-12 font-medium">
          {post.description}
        </p>

        {/* Content */}
        <article>
          {renderContent(post.content)}
        </article>

        {/* Author / share bar */}
        <div className="mt-16 pt-8 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6C3DE8] flex items-center justify-center text-white font-bold text-sm">D</div>
            <div>
              <div className="text-sm font-bold text-slate-900">Dentago Team</div>
              <div className="text-xs text-slate-400">{new Date(post.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">{post.readTime}</div>
        </div>
      </main>

      {/* More articles */}
      {otherPosts.length > 0 && (
        <section className="bg-slate-50 py-16 mt-8">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-extrabold text-slate-900 mb-8">More articles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {otherPosts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-slate-100 hover:border-[#6C3DE8]/30 hover:shadow-lg transition-all duration-200"
                >
                  <div className="relative h-44 overflow-hidden">
                    <Image src={p.image} alt={p.imageAlt} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-6">
                    <span className="text-xs font-bold bg-[#6C3DE8]/10 text-[#6C3DE8] px-3 py-1 rounded-full">{p.category}</span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-3 mb-2 leading-snug group-hover:text-[#6C3DE8] transition-colors">{p.title}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2">{p.description}</p>
                    <div className="mt-4 text-sm font-bold text-[#6C3DE8]">Read article →</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-100 py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-extrabold text-slate-900">Dentago</span>
          <p className="text-sm text-slate-400">Free dental procurement platform for UK practices.</p>
          <Link href="/onboarding/step1.html" className="text-sm font-bold text-[#6C3DE8] hover:underline">Start for free →</Link>
        </div>
      </footer>
    </div>
  );
}
