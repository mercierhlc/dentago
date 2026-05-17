import type { ReactNode } from "react";
import AppSidebarLayout from "@/components/AppSidebarLayout";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <AppSidebarLayout>{children}</AppSidebarLayout>;
}

