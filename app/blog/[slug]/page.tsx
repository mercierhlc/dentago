import type { Metadata } from "next";
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
    },
  };
}

function renderContent(content: string) {
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { elements.push(<div key={key++} className="h-4" />); continue; }

    if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={key++} className="text-2xl font-extrabold text-slate-900 mt-10 mb-4 tracking-tight">{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      elements.push(<p key={key++} className="font-bold text-slate-900 mt-4">{trimmed.slice(2, -2)}</p>);
    } else if (trimmed.startsWith("- ")) {
      elements.push(<li key={key++} className="text-slate-600 leading-relaxed ml-4 list-disc">{trimmed.slice(2)}</li>);
    } else if (trimmed.match(/^\[.+\]\(.+\)$/)) {
      const match = trimmed.match(/^\[(.+)\]\((.+)\)$/);
      if (match) {
        elements.push(
          <div key={key++} className="mt-10">
            <Link
              href={match[2]}
              className="inline-flex items-center gap-2 bg-[#6C3DE8] text-white font-bold px-8 py-4 rounded-xl hover:bg-[#5b30d6] transition-colors text-base"
            >
              {match[1]}
            </Link>
          </div>
        );
      }
    } else {
      // inline bold handling
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={key++} className="text-slate-600 leading-relaxed">
          {parts.map((part, i) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={i} className="text-slate-900 font-bold">{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      );
    }
  }
  return elements;
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
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
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl text-slate-900 tracking-tight">Dentago</Link>
          <Link
            href="/onboarding/step1.html"
            className="bg-[#6C3DE8] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#5b30d6] transition-colors"
          >
            Get started free
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
          <Link href="/blog" className="hover:text-[#6C3DE8] transition-colors">Blog</Link>
          <span>→</span>
          <span className="text-slate-600">{post.category}</span>
        </div>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold bg-[#6C3DE8]/10 text-[#6C3DE8] px-3 py-1 rounded-full">{post.category}</span>
            <span className="text-xs text-slate-400">{post.readTime}</span>
            <span className="text-xs text-slate-400">
              {new Date(post.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-5">
            {post.title}
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed">{post.description}</p>
        </div>

        <hr className="border-slate-100 mb-10" />

        {/* Content */}
        <article className="space-y-4">
          {renderContent(post.content)}
        </article>

        <hr className="border-slate-100 mt-16 mb-10" />

        {/* Back to blog */}
        <Link href="/blog" className="text-sm font-bold text-[#6C3DE8] hover:underline flex items-center gap-1">
          ← Back to all articles
        </Link>
      </main>

      <footer className="border-t border-slate-100 mt-10 py-10">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-extrabold text-slate-900">Dentago</span>
          <p className="text-sm text-slate-400">Free dental procurement platform for UK practices.</p>
          <Link href="/onboarding/step1.html" className="text-sm font-bold text-[#6C3DE8] hover:underline">
            Start for free →
          </Link>
        </div>
      </footer>
    </div>
  );
}
