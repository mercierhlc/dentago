"use client";

import "@/styles/design-export/landing.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";
import DentagoMarketingLanding from "@/components/DentagoMarketingLanding";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    // If the user has an existing session, drop them into their workspace.
    // (Token presence check is intentionally fast/sync; deeper validation happens on /dashboard.)
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  return (
    <>
      <Navbar />

      <DentagoMarketingLanding />

      <Footer />
    </>
  );
}
