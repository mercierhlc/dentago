import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up Free — Dentago Dental Procurement Platform",
  description:
    "Create your free Dentago account. UK dental practices sign up, connect existing supplier accounts, and start comparing prices across Henry Schein, Kent Express, Dental Sky and more.",
  alternates: {
    canonical: "https://www.dentago.co.uk/login",
  },
  openGraph: {
    title: "Sign Up Free — Dentago Dental Procurement Platform",
    description:
      "Free account for UK dental practices. Compare supplier prices and order everything in one cart.",
    url: "https://www.dentago.co.uk/login",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
