"use client";

import { useCallback, useEffect, useState } from "react";
import ProSidebar from "@/components/ProSidebar";

const STORAGE_KEY = "dentago_sidebar_collapsed";

function readSidebarCollapsedFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = new URLSearchParams(window.location.search).get("sb");
    return v === "0" || v === "collapsed";
  } catch {
    return false;
  }
}

function stripSidebarQueryParam(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("sb")) return;
    params.delete("sb");
    const q = params.toString();
    const next = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash || ""}`;
    window.history.replaceState(null, "", next);
  } catch {
    /* ignore */
  }
}

export default function AppSidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (readSidebarCollapsedFromUrl()) {
        setCollapsed(true);
        localStorage.setItem(STORAGE_KEY, "1");
        stripSidebarQueryParam();
        return;
      }
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setCollapsed(false);
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const mainMargin = collapsed ? "md:ml-[76px]" : "md:ml-[228px]";

  return (
    <div className="dentago-clinic-shell min-h-screen bg-[var(--dc-bg)] text-[var(--dc-text)] selection:bg-[var(--dc-accent)]/25">
      <ProSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className={`${mainMargin} pt-12 md:pt-0 transition-[margin] duration-200 ease-out min-h-screen`}>{children}</div>
    </div>
  );
}
