import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SolutionsAudiencePageView from "@/components/SolutionsAudiencePageView";
import { getSolutionsAudiencePage, SOLUTIONS_AUDIENCE_SLUGS } from "@/lib/solutions-audience-pages";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SOLUTIONS_AUDIENCE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cfg = getSolutionsAudiencePage(slug);
  if (!cfg) return { title: "Solutions" };
  return {
    title: `${cfg.metaTitle} · Solutions`,
    description: cfg.metaDescription,
  };
}

export default async function SolutionsAudiencePage({ params }: Props) {
  const { slug } = await params;
  const config = getSolutionsAudiencePage(slug);
  if (!config) notFound();
  return <SolutionsAudiencePageView config={config} />;
}
