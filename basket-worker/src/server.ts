/**
 * Dentago Basket Worker
 *
 * Long-running Node service that handles supplier basket automation via
 * Playwright for suppliers that need a real browser (Henry Schein, Kent
 * Express, DD Group). Runs on Railway where Chromium is available.
 *
 * POST /v1/push-basket
 *   Authorization: Bearer <SUPPLIER_BASKET_WORKER_SECRET>
 *   Body: { supplierName, username, password, items, placeOrder? }
 *   Response: BasketPushResult
 *
 * GET /health  — liveness check (no auth)
 */

import express, { Request, Response, NextFunction } from "express";
import { pushBasket } from "./pusher";
import type { BasketItem, MagentoPlaceOrderOptions } from "./types";

const PORT = parseInt(process.env.PORT ?? "3100", 10);
const SECRET = process.env.SUPPLIER_BASKET_WORKER_SECRET ?? "";

if (!SECRET) {
  console.error("SUPPLIER_BASKET_WORKER_SECRET is not set — rejecting all requests.");
}

const app = express();
app.use(express.json({ limit: "256kb" }));

// ── Auth ─────────────────────────────────────────────────────────────────────

function requireSecret(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!SECRET || token !== SECRET) {
    res.status(401).json({ error: "Unauthorised" });
    return;
  }
  next();
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.post("/v1/push-basket", requireSecret, async (req: Request, res: Response) => {
  const body = req.body as {
    supplierName?: string;
    username?: string;
    password?: string;
    items?: BasketItem[];
    placeOrder?: MagentoPlaceOrderOptions | null;
  };

  const { supplierName, username, password, items } = body;

  if (!supplierName || !username || !password || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "supplierName, username, password, items[] are required" });
    return;
  }

  const supported = ["Henry Schein", "Kent Express", "DD Group"];
  if (!supported.includes(supplierName)) {
    res.status(400).json({
      error: `${supplierName} is not handled by this worker. Supported: ${supported.join(", ")}`,
    });
    return;
  }

  console.log(`[push-basket] ${supplierName} — ${items.length} item(s) for ${username}`);

  try {
    const result = await pushBasket({
      supplier: supplierName as "Henry Schein" | "Kent Express" | "DD Group",
      username,
      password,
      items,
      placeOrder: body.placeOrder ?? null,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[push-basket] unhandled error:`, msg);
    res.status(500).json({ error: `Internal error: ${msg.slice(0, 200)}` });
  }
});

app.listen(PORT, () => {
  console.log(`Dentago basket worker listening on :${PORT}`);
});
