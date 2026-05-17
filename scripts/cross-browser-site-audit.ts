/**
 * Cross-browser smoke + console audit against BASE_URL (default production).
 * Browsers: Chromium, Firefox, WebKit; Edge (Chromium channel) when available.
 *
 *   BASE_URL=https://www.dentago.co.uk npx tsx scripts/cross-browser-site-audit.ts
 */

import { chromium, firefox, webkit, type Browser } from "playwright";

const BASE = (process.env.BASE_URL ?? "https://www.dentago.co.uk").replace(/\/$/, "");
const SKIP_EDGE = process.env.SKIP_EDGE_BROWSER === "1";

type Finding = {
  browser: string;
  path: string;
  kind: "navigation" | "console" | "pageerror";
  detail: string;
};

const findings: Finding[] = [];

function ignoreConsole(text: string, url?: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("favicon")) return true;
  if (t.includes("ResizeObserver loop")) return true;
  if (t.includes("net::err_aborted")) return true;
  if (/failed to load resource.*404/i.test(text)) return false;
  if (url?.includes("googletagmanager") || url?.includes("google-analytics")) return true;
  return false;
}

async function pickProductId(): Promise<number | null> {
  try {
    const r = await fetch(`${BASE}/api/search?q=nitrile&limit=10`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { products?: { id: number }[] };
    return j.products?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function runBrowser(label: string, launch: () => Promise<Browser>, paths: string[]) {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        label.includes("Firefox")
          ? undefined
          : undefined,
    });
    const page = await ctx.newPage();

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      const loc = msg.location();
      const url = loc.url;
      if (ignoreConsole(text, url)) return;
      findings.push({ browser: label, path: "(console)", kind: "console", detail: text.slice(0, 500) });
    });

    page.on("pageerror", (err) => {
      const m = String(err.message ?? err);
      if (ignoreConsole(m)) return;
      findings.push({ browser: label, path: "(page)", kind: "pageerror", detail: m.slice(0, 500) });
    });

    for (const path of paths) {
      const url = path.startsWith("http") ? path : `${BASE}${path}`;
      const res = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      const status = res?.status() ?? 0;
      if (status >= 400) {
        findings.push({
          browser: label,
          path,
          kind: "navigation",
          detail: `HTTP ${status}`,
        });
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const productId = await pickProductId();
  const paths: string[] = [
    "/",
    "/search?q=nitrile+gloves",
    "/signup",
    "/cart",
    "/watch",
    "/demo",
    "/terms",
    "/privacy",
    "/blog",
    "/os/login",
    "/admin/login",
    "/supplier",
  ];

  if (productId != null) paths.splice(3, 0, `/product/${productId}`);
  else findings.push({ browser: "prefetch", path: "/api/search", kind: "navigation", detail: "Could not resolve product id for /product route" });

  paths.push("/orders", "/dashboard", "/clinic/suppliers");

  const engines: { label: string; launch: () => Promise<Browser> }[] = [
    { label: "Chromium", launch: () => chromium.launch({ headless: true }) },
    { label: "Firefox", launch: () => firefox.launch({ headless: true }) },
    { label: "WebKit", launch: () => webkit.launch({ headless: true }) },
  ];

  if (!SKIP_EDGE && process.platform === "darwin") {
    try {
      const probe = await chromium.launch({ channel: "msedge", headless: true });
      await probe.close();
      engines.push({
        label: "Edge (Chromium)",
        launch: () => chromium.launch({ channel: "msedge", headless: true }),
      });
    } catch {
      console.error("(Edge skipped — msedge channel not available on this Mac)");
    }
  }

  console.log(JSON.stringify({ base: BASE, paths, browsers: engines.map((e) => e.label) }, null, 2));

  for (const { label, launch } of engines) {
    console.error(`━━ ${label} ━━`);
    try {
      await runBrowser(label, launch, paths);
    } catch (e) {
      findings.push({
        browser: label,
        path: "(runner)",
        kind: "navigation",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const grouped = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = `${f.kind}|${f.path}|${f.detail}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  }

  console.log("\n━━ SUMMARY ━━");
  if (findings.length === 0) {
    console.log("No blocking HTTP errors or surfaced console/page errors recorded.");
  } else {
    for (const [_k, rows] of grouped) {
      const browsers = [...new Set(rows.map((r) => r.browser))].join(", ");
      const sample = rows[0]!;
      console.log(`[${sample.kind}] ${sample.path}: ${sample.detail}`);
      console.log(`  browsers: ${browsers}`);
    }
  }

  console.log("\nRAW_JSON_FINDINGS=");
  console.log(JSON.stringify(findings, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
