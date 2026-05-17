import type { Metadata } from "next";

import { StrategicShell } from "@/components/bdo/strategic-shell";

export const metadata: Metadata = {
  title: "Billion Dollar OS",
  description:
    "Founder strategic operating system — long-horizon command center for Dentago and compounding outcomes.",
  robots: { index: false, follow: false },
};

export default function BdoLayout({ children }: { children: React.ReactNode }) {
  return <StrategicShell>{children}</StrategicShell>;
}
