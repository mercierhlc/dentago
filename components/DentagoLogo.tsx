import { useId } from "react";
import { cn } from "@/lib/utils";

export type DentagoLogoVariant = "brand" | "inverse" | "solid";

export type DentagoLogoProps = {
  /** Display height in CSS pixels (`width` follows aspect ratio). */
  size?: number;
  variant?: DentagoLogoVariant;
  /** Used when variant is solid */
  color?: string;
  className?: string;
  /** Accessible name; omit when decorative (e.g. wordmark beside the icon). */
  title?: string;
  /** White mark + wordmark for transparent / dark hero headers (`variant="brand"` only). */
  onDark?: boolean;
  /** When false, show only the stepped-square mark (no “dentago” text). */
  wordmark?: boolean;
};

function SvgMark({
  size,
  variant,
  color,
  className,
  title,
}: Omit<DentagoLogoProps, "variant"> & { variant: "inverse" | "solid" }) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");
  const gradInvId = `dentago-logo-gi-${uid}`;
  const fillPaint = variant === "inverse" ? `url(#${gradInvId})` : color ?? "#111111";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {variant === "inverse" ? (
        <defs>
          <linearGradient id={gradInvId} x1="12%" y1="88%" x2="88%" y2="10%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f5f3ff" />
            <stop offset="45%" stopColor="#e9d5ff" />
            <stop offset="100%" stopColor="#c3b1e1" />
          </linearGradient>
        </defs>
      ) : null}
      <rect x="1" y="9" width="11" height="11" fill={fillPaint} />
      <rect x="5" y="2" width="7" height="7" fill={fillPaint} />
    </svg>
  );
}

/** Nav-style lockup: stepped-square mark + bold lowercase wordmark (reference: clean SaaS headers). */
export function DentagoLogo({
  size = 24,
  variant = "brand",
  color = "#0e0f12",
  className,
  title,
  onDark = false,
  wordmark = true,
}: DentagoLogoProps) {
  if (variant === "brand") {
    const markColor = onDark ? "#ffffff" : color;
    const wordColor = onDark ? "#ffffff" : "#0e0f12";
    const fontPx = Math.max(15, Math.round(size * 0.95));
    if (!wordmark) {
      return (
        <span className={cn("inline-flex shrink-0 items-center", className)} aria-label={title ?? "Dentago"}>
          <SvgMark size={size} variant="solid" color={markColor} title={title} />
        </span>
      );
    }
    return (
      <span
        className={cn("inline-flex items-center gap-2.5 shrink-0", className)}
        style={{ height: `${size}px` }}
        aria-label={title ?? "Dentago"}
      >
        <SvgMark size={size} variant="solid" color={markColor} title={title ? `${title} mark` : undefined} />
        <span
          className="font-bold tracking-[-0.03em] lowercase leading-none"
          style={{
            fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
            fontSize: fontPx,
            color: wordColor,
            fontWeight: 700,
          }}
          aria-hidden
        >
          dentago
        </span>
      </span>
    );
  }

  return <SvgMark size={size} variant={variant} color={color} className={className} title={title} />;
}
