import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Xero-compatible CSV column headers
const XERO_HEADERS = [
  "ContactName",
  "EmailAddress",
  "POAddressLine1",
  "POCity",
  "POPostalCode",
  "POCountry",
  "InvoiceNumber",
  "Reference",
  "InvoiceDate",
  "DueDate",
  "Description",
  "Quantity",
  "UnitAmount",
  "Discount",
  "AccountCode",
  "TaxType",
];

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatXeroDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function dueDateFromOrder(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function getAuthClinic(
  request: Request
): Promise<{ clinicId: string; clinicName: string; clinicEmail: string } | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id, clinic_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!clinic) return null;
  return {
    clinicId: clinic.id,
    clinicName: clinic.clinic_name ?? "",
    clinicEmail: clinic.email ?? "",
  };
}

// GET /api/clinic/orders/export?format=csv&from=2026-01-01&to=2026-05-01
export async function GET(request: Request) {
  const auth = await getAuthClinic(request);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Fetch orders for this clinic
  let query = supabaseAdmin
    .from("dentago_orders")
    .select("id, created_at, total_amount, status")
    .eq("clinic_id", auth.clinicId)
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59");

  const { data: orders, error: ordersError } = await query;
  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const rows: string[] = [XERO_HEADERS.join(",")];

  if (!orders || orders.length === 0) {
    // Return header + one blank example row so the file is still importable
    rows.push(
      [
        "Example Supplier",
        "",
        "",
        "",
        "",
        "",
        "INV-001",
        "Dentago-Export",
        "01 Jan 2026",
        "01 Feb 2026",
        "Example Product",
        "1",
        "0.00",
        "0",
        "400",
        "20% (VAT on Expenses)",
      ].join(",")
    );
  } else {
    // Fetch all order items with product + supplier info
    const orderIds = orders.map((o) => o.id);

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("dentago_order_items")
      .select(
        "id, order_id, sku, quantity, unit_price, product_id, supplier_id"
      )
      .in("order_id", orderIds);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const allItems = items ?? [];

    // Resolve product and supplier names
    const productIds = [...new Set(allItems.map((i) => i.product_id).filter(Boolean))];
    const supplierIds = [...new Set(allItems.map((i) => i.supplier_id).filter(Boolean))];

    const [{ data: products }, { data: suppliers }] = await Promise.all([
      supabaseAdmin
        .from("dentago_products")
        .select("id, name")
        .in("id", productIds.length ? productIds : [0]),
      supabaseAdmin
        .from("dentago_suppliers")
        .select("id, name, email")
        .in("id", supplierIds.length ? supplierIds : [0]),
    ]);

    const productMap: Record<number, string> = {};
    for (const p of products ?? []) productMap[p.id] = p.name;

    const supplierMap: Record<number, { name: string; email: string }> = {};
    for (const s of suppliers ?? []) supplierMap[s.id] = { name: s.name, email: s.email ?? "" };

    // Build a map from order_id -> order meta
    const orderMeta: Record<string, { created_at: string }> = {};
    for (const o of orders) orderMeta[o.id] = { created_at: o.created_at };

    // One CSV row per order item
    let invoiceCounter = 1;
    const invoiceNums: Record<string, string> = {};
    for (const o of orders) {
      invoiceNums[o.id] = `INV-${String(invoiceCounter++).padStart(3, "0")}`;
    }

    for (const item of allItems) {
      const order = orderMeta[item.order_id];
      if (!order) continue;

      const supplier = supplierMap[item.supplier_id] ?? { name: "Unknown Supplier", email: "" };
      const productName = productMap[item.product_id] ?? item.sku ?? "Product";
      const invoiceDate = formatXeroDate(order.created_at);
      const dueDate = dueDateFromOrder(order.created_at);
      const invoiceNum = invoiceNums[item.order_id] ?? "INV-000";
      const unitAmount = (item.unit_price ?? 0).toFixed(2);

      const csvRow = [
        escapeCSV(supplier.name),
        escapeCSV(supplier.email),
        "",
        "",
        "",
        "",
        escapeCSV(invoiceNum),
        "Dentago-Export",
        escapeCSV(invoiceDate),
        escapeCSV(dueDate),
        escapeCSV(productName),
        escapeCSV(item.quantity ?? 1),
        escapeCSV(unitAmount),
        "0",
        "400",
        "20% (VAT on Expenses)",
      ].join(",");

      rows.push(csvRow);
    }
  }

  const csv = rows.join("\n");
  const filename = `dentago-orders${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
