/**
 * Hits the production-built app over HTTP — run after `npm run build`.
 *
 * Starts `next start` on TEST_PORT unless SMOKE_USE_RUNNING=1 (then reuse server at BASE_URL).
 *
 * Usage:
 *   cd dentago && npm run build && npm run test:smoke
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
      console.error(`SMOKE_USE_RUNNING=1 but ${BASE}/ (home) not reachable`);
      process.exit(1);
    }
    return () => {};
  }

  const child = spawn("npx", ["next", "start", "-p", PORT], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  let errTail = "";
  child.stderr?.on("data", (b: Buffer) => {
    errTail = (errTail + b.toString()).slice(-4000);
  });
  child.stdout?.on("data", (b: Buffer) => {
    errTail += b.toString();
  });

  for (let i = 0; i < 240; i++) {
    if (await ping()) return () => child.kill("SIGTERM");
    if (child.exitCode !== null) {
      console.error("next start exited:", child.exitCode);
      console.error(errTail.slice(-2500));
      process.exit(1);
    }
    await sleep(250);
  }

  console.error(errTail.slice(-2500));
  child.kill("SIGTERM");
  throw new Error("Server did not become ready within 60s");
}

type Case = {
  name: string;
  method?: string;
  path: string;
  body?: string;
  expectStatus: number;
  assert?: (r: Response, body: unknown) => void | Promise<void>;
};

async function json(res: Response): Promise<unknown> {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

const cases: Case[] = [
  {
    name: "GET /api/suppliers",
    path: "/api/suppliers",
    expectStatus: 200,
    assert: (_, body) => {
      const j = body as { suppliers?: unknown };
      if (!Array.isArray(j.suppliers)) throw new Error("expected suppliers array");
    },
  },
  {
    name: "GET /api/products/1",
    path: "/api/products/1",
    expectStatus: 200,
    assert: (_, body) => {
      const j = body as { id?: number; variations?: unknown; suppliers?: unknown };
      if (j.id !== 1) throw new Error("wrong id");
      if (!Array.isArray(j.variations)) throw new Error("expected variations[]");
      if (!Array.isArray(j.suppliers)) throw new Error("expected suppliers[]");
    },
  },
  {
    name: "GET /api/products/999999991 (missing)",
    path: "/api/products/999999991",
    expectStatus: 404,
  },
  {
    name: "GET /api/products/abc (invalid)",
    path: "/api/products/abc",
    expectStatus: 400,
  },
  {
    name: "GET /api/search?q=nitrile&limit=5",
    path: "/api/search?q=nitrile&limit=5",
    expectStatus: 200,
    assert: (_, body) => {
      const j = body as { products?: unknown; total?: unknown };
      if (!Array.isArray(j.products)) throw new Error("expected products array");
      if (typeof j.total !== "number") throw new Error("expected total number");
    },
  },
  {
    name: "GET /api/search improbable query → zero results",
    path: "/api/search?q=__dentago_improbable_query_empty_zz__&limit=30",
    expectStatus: 200,
    assert: (_, body) => {
      const j = body as { products?: unknown[]; total?: number };
      if (j.total !== 0) throw new Error(`expected total 0, got ${j.total}`);
      if (!Array.isArray(j.products) || j.products.length !== 0) {
        throw new Error("expected empty products[]");
      }
    },
  },
  {
    name: "POST /api/orders without auth → 401",
    method: "POST",
    path: "/api/orders",
    body: JSON.stringify({
      clinicName: "Smoke Test Clinic",
      clinicEmail: "smoke@example.com",
      items: [
        {
          productId: 1,
          supplierId: 1,
          supplierName: "Test",
          name: "Test",
          brand: "X",
          sku: "SKU1",
          quantity: 1,
          unitPrice: 1,
          packSize: "1",
        },
      ],
    }),
    expectStatus: 401,
  },
  {
    name: "GET /api/auth/me without token",
    path: "/api/auth/me",
    expectStatus: 401,
  },
  {
    name: "GET /api/cart without token",
    path: "/api/cart",
    expectStatus: 401,
  },
  {
    name: "GET /api/clinic/suppliers without token",
    path: "/api/clinic/suppliers",
    expectStatus: 401,
  },
  {
    name: "GET /api/clinic/live-pricing without token",
    path: "/api/clinic/live-pricing?id=nitrile-gloves-large",
    expectStatus: 401,
  },
  {
    name: "GET /api/live-pricing demo id",
    path: "/api/live-pricing?id=nitrile-gloves-large",
    expectStatus: 200,
    assert: (_, body) => {
      const j = body as { productId?: string; prices?: unknown };
      if (j.productId !== "nitrile-gloves-large") throw new Error("wrong productId");
      if (!Array.isArray(j.prices)) throw new Error("expected prices array");
    },
  },
  {
    name: "GET /api/live-pricing bad id → 400",
    path: "/api/live-pricing?id=nonexistent-slug",
    expectStatus: 400,
  },
  {
    name: "GET /api/cron/refresh-dd-prices without secret",
    path: "/api/cron/refresh-dd-prices",
    expectStatus: 401,
  },
  {
    name: "POST /api/leads missing fields",
    method: "POST",
    path: "/api/leads",
    body: "{}",
    expectStatus: 400,
  },
  {
    name: "POST /api/supplier/auth/login missing fields",
    method: "POST",
    path: "/api/supplier/auth/login",
    body: "{}",
    expectStatus: 400,
  },
  {
    name: "GET / — home HTML",
    path: "/",
    expectStatus: 200,
    assert: (res) => {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) throw new Error("expected HTML");
    },
  },
  {
    name: "GET /search — marketplace",
    path: "/search",
    expectStatus: 200,
    assert: (res) => {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) throw new Error("expected HTML");
    },
  },
  {
    name: "GET /product/1",
    path: "/product/1",
    expectStatus: 200,
    assert: (res) => {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) throw new Error("expected HTML");
    },
  },
  {
    name: "GET /cart",
    path: "/cart",
    expectStatus: 200,
    assert: (res) => {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) throw new Error("expected HTML");
    },
  },
  {
    name: "GET /robots.txt",
    path: "/robots.txt",
    expectStatus: 200,
  },
  {
    name: "GET /sitemap.xml",
    path: "/sitemap.xml",
    expectStatus: 200,
  },
  {
    name: "GET blog SSG page",
    path: "/blog/how-uk-dental-practices-can-cut-supply-costs",
    expectStatus: 200,
    assert: (res) => {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) throw new Error("expected HTML");
    },
  },
];

async function main() {
  let stop = () => {};
  try {
    stop = await ensureServer();
    await sleep(300);

    let failed = 0;
    for (const c of cases) {
      const url = `${BASE}${c.path.startsWith("/") ? c.path : `/${c.path}`}`;
      const res = await fetch(url, {
        method: c.method ?? "GET",
        headers: c.body ? { "Content-Type": "application/json" } : undefined,
        body: c.body,
        signal: AbortSignal.timeout(45_000),
      });
      const body = res.headers.get("content-type")?.includes("application/json")
        ? await json(res)
        : await res.text();

      try {
        if (res.status !== c.expectStatus) {
          console.log("✗", c.name, `expected ${c.expectStatus} got ${res.status}`);
          if (typeof body === "string") console.log("  ", body.slice(0, 200));
          failed++;
          continue;
        }
        if (c.assert) await Promise.resolve(c.assert(res, body));
        console.log("✓", c.name);
      } catch (e) {
        console.log("✗", c.name, (e as Error).message);
        failed++;
      }
    }

    if (failed) {
      console.log(`\n━━ ${failed} failure(s) ━━`);
      process.exit(1);
    }
    console.log("\n━━ All smoke tests passed ━━");
    process.exit(0);
  } finally {
    stop();
    await sleep(200);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
