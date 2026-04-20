import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const BASE_URL = "https://www.dentago.co.uk";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Dentago — Free Dental Procurement Platform for UK Practices",
    template: "%s | Dentago",
  },
  description:
    "Compare prices across Henry Schein, Kent Express, Dental Sky and 40+ UK dental suppliers in one free platform. Search, compare, and order all your dental supplies in one cart. Trusted by UK dental practices.",
  keywords: [
    "dental procurement UK",
    "dental supplies comparison UK",
    "compare dental supplier prices",
    "dental marketplace UK",
    "Henry Schein alternative",
    "Kent Express dental prices",
    "dental practice procurement software",
    "free dental procurement platform",
    "UK dental supplies",
    "dental supply management",
    "compare Henry Schein Kent Express",
    "dental practice supply costs",
    "dental purchasing platform",
    "dental supplies price comparison tool",
    "NHS dental practice supplies",
  ],
  authors: [{ name: "Dentago", url: BASE_URL }],
  creator: "Dentago",
  publisher: "Dentago",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: BASE_URL,
    siteName: "Dentago",
    title: "Dentago — Free Dental Procurement Platform for UK Practices",
    description:
      "Compare prices across Henry Schein, Kent Express, Dental Sky and 40+ UK suppliers in one free platform. One cart. One checkout. Save up to 18% on dental supplies.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Dentago — Compare UK dental supplier prices in one place",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dentago — Free Dental Procurement Platform for UK Practices",
    description:
      "Compare prices across Henry Schein, Kent Express, Dental Sky and 40+ UK suppliers in one free platform.",
    images: ["/og-image.png"],
  },
  verification: {
    google: "google-site-verification-placeholder",
  },
  category: "Healthcare Technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-56PWNL0V42"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-56PWNL0V42');
        `}} />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Dentago",
              url: BASE_URL,
              logo: `${BASE_URL}/logo.png`,
              description:
                "Free dental procurement platform for UK dental practices. Compare prices across Henry Schein, Kent Express, Dental Sky and 40+ suppliers in one place.",
              foundingDate: "2026",
              areaServed: "GB",
              serviceType: "Dental Procurement Software",
              contactPoint: {
                "@type": "ContactPoint",
                email: "mercier@dentago.co.uk",
                contactType: "customer support",
                areaServed: "GB",
                availableLanguage: "English",
              },
              sameAs: [
                "https://www.linkedin.com/company/dentago",
              ],
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
