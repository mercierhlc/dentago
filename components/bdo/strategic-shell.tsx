"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { motion } from "framer-motion";

import { BDO_NAV, normalizeBdoPath } from "@/lib/bdo/nav";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

export function StrategicShell({ children }: { children: React.ReactNode }) {
  const pathname = normalizeBdoPath(usePathname() ?? "/bdo");
  const [open, setOpen] = useState(false);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-0.5 px-2 py-3">
      {BDO_NAV.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors",
              active
                ? "bg-[var(--sidebar-accent)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)]/80 hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="size-4 shrink-0 opacity-80" strokeWidth={1.5} />
            <span className="min-w-0 truncate font-medium tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="bdo-os flex min-h-screen w-full font-[family-name:var(--font-inter)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-[232px] shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] lg:flex lg:flex-col">
        <div className="border-b border-[var(--border)] px-4 py-5">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-1"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              Strategic OS
            </p>
            <h1 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
              Billion Dollar OS
            </h1>
            <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              Dentago · long-horizon command
            </p>
          </motion.div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-[var(--border)] p-3 text-[10px] text-[var(--muted-foreground)]">
          Local persistence only. Supabase sync is optional — wire in Settings.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-[var(--border)] bg-[var(--background)]/90 px-3 backdrop-blur-md lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            nativeButton={false}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "shrink-0")}
          >
            <Menu className="size-4" />
            <span className="sr-only">Open navigation</span>
          </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,280px)] bg-[var(--sidebar)] p-0 lg:hidden">
              <SheetHeader className="border-b border-[var(--border)] px-4 py-4 text-left">
                <SheetTitle className="text-sm font-semibold tracking-tight">Billion Dollar OS</SheetTitle>
              </SheetHeader>
              <SheetClose className="hidden" />
              <NavLinks onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Separator orientation="vertical" className="h-6 bg-[var(--border)]" />
          <span className="truncate text-[12px] font-medium tracking-tight text-[var(--muted-foreground)]">
            {BDO_NAV.find((n) => n.href === pathname)?.label ?? "Command Center"}
          </span>
        </header>

        <main className="min-h-[calc(100dvh-3rem)] flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:min-h-screen lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
