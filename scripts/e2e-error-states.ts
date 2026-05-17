/**
 * Browser checks for marketplace error / empty states (runs against a running Next server).
 * Runs in Chromium, Firefox, and WebKit (Safari engine) when browsers are installed via:
 *   npx playwright install
 *
 * Usage (after `npm run build`):
 *   npm run test:e2e
 *
 * Or reuse an already-running server:
 *   SMOKE_USE_RUNNING=1 BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit, type BrowserType } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.resolve(__dirname, "..");

const PORT = process.env.TEST_PORT ?? "3127";
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;
const USE_RUNNING = process.env.SMOKE_USE_RUNNING === "1";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function ping(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<() => void> {
  if (USE_RUNNING) {
    const ok = await ping();
    if (!ok) {
      console.error(`SMOKE_USE_RUNNING=1 but ${BASE}/ not reachable`);
      process.exit(1);
    }
    return () => {};
  }

  const child = spawn("npx", ["next", "start", "-p", PORT], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  for (let i = 0; i < 240; i++) {
    if (await ping()) return () => child.kill("SIGTERM");
    if (child.exitCode !== null) {
      console.error("next start exited:", child.exitCode);
      process.exit(1);
    }
    await sleep(250);
  }

  child.kill("SIGTERM");
  throw new Error("Server did not become ready within 60s");
}

async function findAllOosProductId(): Promise<number | null> {
  const r = await fetch(`${BASE}/api/search?q=dental&limit=80`);
  if (!r.ok) return null;
  const j = (await r.json()) as { products?: { id: number }[] };
  for (const p of j.products ?? []) {
    const pr = await fetch(`${BASE}/api/products/${p.id}`);
    if (!pr.ok) continue;
    const d = (await pr.json()) as { suppliers?: { stock: boolean }[] };
    const sup = d.suppliers ?? [];
    if (sup.length > 0 && sup.every((s) => !s.stock)) return p.id;
  }
  return null;
}

async function main() {
  let stop = () => {};
  const browsers: { name: string; type: BrowserType }[] = [
    { name: "Chromium", type: chromium },
    { name: "Firefox", type: firefox },
    { name: "WebKit (Safari engine)", type: webkit },
  ];

  try {
    stop = await ensureServer();
    await sleep(400);

    for (const { name, type } of browsers) {
      console.log(`━━ ${name} ━━`);
      const browser = await type.launch({ headless: true });
      try {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();

        await page.goto(`${BASE}/search?q=__dentago_improbable_query_browser__`, {
          waitUntil: "networkidle",
          timeout: 60_000,
        });
        await page.getByTestId("marketplace-no-results").waitFor({ state: "visible", timeout: 30_000 });

        const oosId = await findAllOosProductId();
        if (oosId != null) {
          await page.goto(`${BASE}/product/${oosId}`, { waitUntil: "networkidle", timeout: 60_000 });
          await page.getByTestId("product-all-oos-banner").waitFor({ state: "visible", timeout: 15_000 });
        } else {
          console.warn(`  (skip ${name}) No all–out-of-stock product in sample`);
        }

        await page.goto(`${BASE}/cart`, { waitUntil: "networkidle", timeout: 60_000 });
        await page.getByRole("heading", { name: /sign in to view your cart/i }).waitFor({
          state: "visible",
          timeout: 15_000,
        });
      } finally {
        await browser.close();
      }
    }

    console.log("━━ e2e error-state checks passed (Chromium + Firefox + WebKit) ━━");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    stop();
    await sleep(200);
  }
}

main();
