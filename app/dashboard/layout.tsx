import type { ReactNode } from "react";
import AppSidebarLayout from "@/components/AppSidebarLayout";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppSidebarLayout>{children}</AppSidebarLayout>;
}
