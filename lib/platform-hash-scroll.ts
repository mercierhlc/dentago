/** Dispatched when user chooses a /platform#section while already on /platform */
export const PLATFORM_HASH_NAV_EVENT = "dentago:platform-hash-nav";

/** Session key — Next.js client navigations often drop `#`; stash hash before `router.push("/platform")` */
export const PLATFORM_PENDING_HASH_STORAGE_KEY = "dentago:platform-pending-hash";

/** Stash `#fragment` before SPA navigate to `/platform` so Pro page can scroll correctly */
export function stashPlatformNavHash(href: string): boolean {
  if (!href.startsWith("/platform#")) return false;
  const hashPart = href.slice("/platform".length);
  const normalized = hashPart.startsWith("#") ? hashPart : `#${hashPart}`;
  try {
    sessionStorage.setItem(PLATFORM_PENDING_HASH_STORAGE_KEY, normalized);
  } catch {
    return false;
  }
  return true;
}

/** Read & clear pending hash after `/platform` mounts */
export function consumePlatformPendingHash(): string | null {
  try {
    const raw = sessionStorage.getItem(PLATFORM_PENDING_HASH_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PLATFORM_PENDING_HASH_STORAGE_KEY);
    return raw.startsWith("#") ? raw : `#${raw}`;
  } catch {
    return null;
  }
}

export type PlatformHashNavDetail = { hash: string };

export function dispatchPlatformHashNav(hash: string) {
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  window.dispatchEvent(
    new CustomEvent<PlatformHashNavDetail>(PLATFORM_HASH_NAV_EVENT, {
      detail: { hash: normalized },
    }),
  );
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Waits for DOM (e.g. after route transition / layout paint). */
export function waitForPlatformSection(id: string, opts?: { attempts?: number; intervalMs?: number }): Promise<HTMLElement | null> {
  const attempts = opts?.attempts ?? 28;
  const intervalMs = opts?.intervalMs ?? 40;

  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      const el = document.getElementById(id);
      if (el) {
        resolve(el);
        return;
      }
      if (++n >= attempts) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, intervalMs);
    };
    tick();
  });
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function animateScrollToElement(el: HTMLElement, offsetPx: number, durationMs = 720): Promise<void> {
  if (prefersReducedMotion()) {
    const y = el.getBoundingClientRect().top + window.scrollY - offsetPx;
    window.scrollTo(0, Math.max(0, y));
    return Promise.resolve();
  }

  const rect = el.getBoundingClientRect();
  const startY = window.scrollY;
  const targetY = Math.max(0, rect.top + startY - offsetPx);
  const delta = targetY - startY;
  if (Math.abs(delta) < 2) return Promise.resolve();

  return new Promise((resolve) => {
    const t0 = performance.now();
    function frame(now: number) {
      const t = Math.min(1, (now - t0) / durationMs);
      window.scrollTo(0, startY + delta * easeOutCubic(t));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}
