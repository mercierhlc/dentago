"use client";

import { useCallback, useState } from "react";
import { getSupplierBranding } from "@/lib/supplier-branding";

type Props = {
  supplierName: string;
  size?: number;
  className?: string;
  /** Extra classes on the outer wrapper (for flex-shrink, etc.) */
  wrapperClassName?: string;
};

function initialLetter(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

/**
 * Supplier favicon in a rounded square, with letter fallback on load error or unknown supplier.
 */
export function SupplierLogo({ supplierName, size = 20, className = "", wrapperClassName = "" }: Props) {
  const { logo, color } = getSupplierBranding(supplierName);
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(logo) && !failed;

  const onError = useCallback(() => setFailed(true), []);

  const dim = { width: size, height: size };

  if (!showImg) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md text-white text-[10px] font-semibold flex-shrink-0 ${wrapperClassName} ${className}`}
        style={{ ...dim, background: color }}
        aria-hidden
      >
        {initialLetter(supplierName)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md overflow-hidden bg-white border border-neutral-100 flex-shrink-0 ${wrapperClassName} ${className}`}
      style={dim}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo!}
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ ...dim, padding: Math.max(1, size * 0.12) }}
        onError={onError}
      />
    </span>
  );
}
