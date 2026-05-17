import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create workspace",
  description: "Create your Dentago practice workspace — compare supplier prices and order with confidence.",
  robots: { index: false, follow: true },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
