/**
 * Browser-only cart for signed-out users. Merged into the server cart on first
 * authenticated /cart load.
 */
const STORAGE_KEY = "dentago_guest_cart_v1";

export type GuestCartLine = {
  productId: number;
  supplierId: number;
  supplier: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  packSize: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  inStock: boolean;
};

export function guestLineId(productId: number, supplierId: number): string {
  return `guest-${productId}-${supplierId}`;
}

export function loadGuestCartLines(): GuestCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGuestLine);
  } catch {
    return [];
  }
}

function isGuestLine(x: unknown): x is GuestCartLine {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.productId === "number" &&
    typeof o.supplierId === "number" &&
    typeof o.supplier === "string" &&
    typeof o.name === "string" &&
    typeof o.unitPrice === "number" &&
    typeof o.quantity === "number"
  );
}

export function saveGuestCartLines(lines: GuestCartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    if (lines.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* ignore quota */
  }
}

export function clearGuestCart(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function upsertGuestCartLine(line: GuestCartLine): void {
  const lines = loadGuestCartLines();
  const idx = lines.findIndex((l) => l.productId === line.productId && l.supplierId === line.supplierId);
  if (idx >= 0) {
    const cur = lines[idx];
    lines[idx] = {
      ...cur,
      quantity: cur.quantity + line.quantity,
      unitPrice: line.unitPrice,
      inStock: line.inStock,
      sku: line.sku ?? cur.sku,
      packSize: line.packSize || cur.packSize,
    };
  } else {
    const rest = lines.filter((l) => l.productId !== line.productId);
    rest.push({ ...line, quantity: Math.max(1, line.quantity) });
    saveGuestCartLines(rest);
    return;
  }
  saveGuestCartLines(lines);
}

export function setGuestLineQuantity(productId: number, supplierId: number, quantity: number): void {
  const lines = loadGuestCartLines();
  const id = guestLineId(productId, supplierId);
  const idx = lines.findIndex((l) => guestLineId(l.productId, l.supplierId) === id);
  if (idx < 0) return;
  if (quantity <= 0) {
    lines.splice(idx, 1);
  } else {
    lines[idx] = { ...lines[idx], quantity };
  }
  saveGuestCartLines(lines);
}

export function removeGuestLine(lineId: string): void {
  const m = /^guest-(\d+)-(\d+)$/.exec(lineId);
  if (!m) return;
  const productId = Number(m[1]);
  const supplierId = Number(m[2]);
  const lines = loadGuestCartLines().filter(
    (l) => !(l.productId === productId && l.supplierId === supplierId),
  );
  saveGuestCartLines(lines);
}

/** Shape matches GET /api/cart for the cart page UI. */
export function guestLinesToCartData(lines: GuestCartLine[]): {
  cartId: string;
  items: Array<{
    id: string;
    productId: number;
    name: string;
    brand: string;
    category: string;
    image: string;
    packSize: string;
    supplier: string;
    supplierId: number;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    addedAt: string;
    inStock: boolean;
  }>;
  bySupplier: Array<{
    supplier: string;
    items: Array<{
      id: string;
      productId: number;
      name: string;
      brand: string;
      category: string;
      image: string;
      packSize: string;
      supplier: string;
      supplierId: number;
      sku: string | null;
      quantity: number;
      unitPrice: number;
      addedAt: string;
      inStock: boolean;
    }>;
    subtotal: number;
  }>;
  total: number;
  itemCount: number;
} {
  const items = lines.map((l) => ({
    id: guestLineId(l.productId, l.supplierId),
    productId: l.productId,
    name: l.name,
    brand: l.brand,
    category: l.category,
    image: l.image,
    packSize: l.packSize,
    supplier: l.supplier,
    supplierId: l.supplierId,
    sku: l.sku,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    addedAt: new Date().toISOString(),
    inStock: l.inStock,
  }));

  const bySupplierMap: Record<string, { supplier: string; items: typeof items; subtotal: number }> = {};
  for (const item of items) {
    const s = item.supplier ?? "Unknown";
    if (!bySupplierMap[s]) bySupplierMap[s] = { supplier: s, items: [], subtotal: 0 };
    bySupplierMap[s].items.push(item);
    bySupplierMap[s].subtotal += item.unitPrice * item.quantity;
  }

  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return {
    cartId: "guest",
    items,
    bySupplier: Object.values(bySupplierMap),
    total: parseFloat(total.toFixed(2)),
    itemCount: items.length,
  };
}
