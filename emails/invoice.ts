import type { OrderItem, SupplierOrder } from "./order-confirmation";

export function dentagoInvoiceEmail({
  clinicName,
  clinicEmail,
  orderId,
  orderDate,
  supplierOrders,
  total,
}: {
  clinicName: string;
  clinicEmail: string;
  orderId: string;
  orderDate: Date;
  supplierOrders: SupplierOrder[];
  total: number;
}) {
  const ref = orderId.slice(0, 8).toUpperCase();
  const dateStr = orderDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const allItems: (OrderItem & { supplier: string })[] = supplierOrders.flatMap((so) =>
    so.items.map((item) => ({ ...item, supplier: so.supplier }))
  );

  const itemRows = allItems
    .map(
      (item, i) => `
      <tr style="background: ${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
        <td style="padding: 10px 14px; font-size: 13px; color: #1e293b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
          ${item.name}
          <div style="font-size: 11px; font-weight: 400; color: #94a3b8; margin-top: 2px;">${item.brand}${item.packSize ? ` · ${item.packSize}` : ""}${item.sku ? ` · SKU: ${item.sku}` : ""}</div>
        </td>
        <td style="padding: 10px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #e2e8f0; white-space: nowrap; text-align: center;">${item.supplier}</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0; text-align: right;">£${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #111111; border-bottom: 1px solid #e2e8f0; text-align: right;">£${(item.unitPrice * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const supplierSubtotals = supplierOrders
    .map(
      (so) => `
      <tr>
        <td colspan="3" style="padding: 8px 14px; font-size: 12px; color: #64748b; text-align: right;">${so.supplier} subtotal</td>
        <td style="padding: 8px 14px; font-size: 13px; font-weight: 600; color: #1e293b; text-align: right;">£${so.subtotal.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return {
    subject: `Invoice — Ref: ${ref} · £${total.toFixed(2)} · ${dateStr}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dentago Invoice ${ref}</title>
</head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 680px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background: #0e0f12; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">Dentago</div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Dental Procurement Platform</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b;">Invoice</div>
        <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin-top: 4px; font-family: monospace;">${ref}</div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${dateStr}</div>
      </div>
    </div>

    <!-- Bill To / From -->
    <div style="display: flex; gap: 0; border-bottom: 1px solid #e2e8f0;">
      <div style="flex: 1; padding: 24px 40px; border-right: 1px solid #e2e8f0;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin-bottom: 8px;">Billed To</div>
        <div style="font-size: 15px; font-weight: 700; color: #111111;">${clinicName}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 2px;">${clinicEmail}</div>
      </div>
      <div style="flex: 1; padding: 24px 40px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin-bottom: 8px;">Issued By</div>
        <div style="font-size: 15px; font-weight: 700; color: #111111;">Dentago Ltd</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 2px;">London, United Kingdom</div>
        <div style="font-size: 13px; color: #64748b;">support@dentago.co.uk</div>
      </div>
    </div>

    <!-- Items table -->
    <div style="padding: 32px 40px 0;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin-bottom: 14px;">Order Items</div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 10px 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; text-align: left; border-bottom: 1px solid #e2e8f0;">Product</th>
            <th style="padding: 10px 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; text-align: center; border-bottom: 1px solid #e2e8f0;">Supplier</th>
            <th style="padding: 10px 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; text-align: center; border-bottom: 1px solid #e2e8f0;">Qty</th>
            <th style="padding: 10px 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; text-align: right; border-bottom: 1px solid #e2e8f0;">Unit Price</th>
            <th style="padding: 10px 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; text-align: right; border-bottom: 1px solid #e2e8f0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div style="padding: 20px 40px 32px; display: flex; justify-content: flex-end;">
      <table style="border-collapse: collapse; min-width: 260px;">
        ${supplierSubtotals}
        <tr>
          <td colspan="3" style="padding: 6px 14px; font-size: 12px; color: #64748b; text-align: right; border-top: 1px solid #e2e8f0;">Platform fee</td>
          <td style="padding: 6px 14px; font-size: 13px; color: #16a34a; font-weight: 600; text-align: right; border-top: 1px solid #e2e8f0;">£0.00 (Free)</td>
        </tr>
        <tr style="background: #0e0f12; border-radius: 8px;">
          <td colspan="3" style="padding: 14px 14px; font-size: 14px; font-weight: 800; color: #ffffff; text-align: right; border-radius: 8px 0 0 8px;">Grand Total</td>
          <td style="padding: 14px 14px; font-size: 20px; font-weight: 900; color: #ffffff; text-align: right; letter-spacing: -0.5px; border-radius: 0 8px 8px 0;">£${total.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <!-- Notes -->
    <div style="margin: 0 40px 32px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 20px;">
      <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.6;">
        <strong>Payment terms:</strong> Orders are placed directly with each supplier at their listed prices. Payment is made directly to each supplier per their standard terms. Dentago does not charge clinics.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.7;">
        Dentago Ltd · London, UK ·
        <a href="mailto:support@dentago.co.uk" style="color: #64748b; text-decoration: none;">support@dentago.co.uk</a><br>
        This invoice was automatically generated by the Dentago platform for order reference <strong style="font-family: monospace;">${ref}</strong>.
      </p>
    </div>

  </div>
</body>
</html>`,
  };
}
