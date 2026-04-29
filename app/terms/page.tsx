import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Terms of Service — Dentago",
  description: "Dentago Terms of Service. Read the full terms governing use of the Dentago dental procurement marketplace.",
};

export default function TermsPage() {
  redirect("/terms.html");
}
