import type { Metadata } from "next";
import { Inter, Manrope, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ChatWidgetLazy from "@/components/ChatWidgetLazy";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
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
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Subset variable font — avoid loading the full 100–700 weight + FILL axis range on every page */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400..500,0..1,0&display=swap"
          rel="stylesheet"
        />
        {/* Google Analytics */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-56PWNL0V42" strategy="afterInteractive" />
        <Script
          id="ga-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-56PWNL0V42');",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Theme init — must run before paint to avoid flicker; plain script in body, not Next.js Script with beforeInteractive which breaks App Router */}
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('dentago_theme');var isDark=t==='dark';var r=document.documentElement;if(isDark)r.classList.add('dark');else r.classList.remove('dark');r.style.colorScheme=isDark?'dark':'light';}catch(e){}})();`,
          }}
        />
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
        <ChatWidgetLazy />
      </body>
    </html>
  );
}
