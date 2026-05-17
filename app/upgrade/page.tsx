"use client";

import { Suspense } from "react";
import ProUpgradeUpsell from "@/components/ProUpgradeUpsell";

function UpgradeFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="h-12 w-12 animate-pulse rounded-2xl bg-[var(--dc-border)]" aria-hidden />
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<UpgradeFallback />}>
      <ProUpgradeUpsell />
    </Suspense>
  );
}
