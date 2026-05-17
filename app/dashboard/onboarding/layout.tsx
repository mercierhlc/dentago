import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get started — Dentago",
  description: "Complete onboarding steps for your clinic — suppliers, search, orders, savings, inventory, and approvals (all on Free).",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
