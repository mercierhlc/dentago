import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Dental Supplies — Compare Prices Across All UK Suppliers",
  description:
    "Search and compare dental supply prices across Henry Schein, Kent Express, Dental Sky and 40+ UK suppliers in real time. Find the best price for every product in one search.",
  alternates: {
    canonical: "https://www.dentago.co.uk/search",
  },
  openGraph: {
    title: "Search Dental Supplies — Compare Prices Across All UK Suppliers",
    description:
      "Real-time price comparison across 40+ UK dental suppliers. One search, every price, one cart.",
    url: "https://www.dentago.co.uk/search",
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
