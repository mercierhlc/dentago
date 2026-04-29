import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Privacy Policy — Dentago",
  description: "Dentago Privacy Policy. How we collect, use, and protect your personal data in compliance with UK GDPR.",
};

export default function PrivacyPage() {
  redirect("/privacy.html");
}
