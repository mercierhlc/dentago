export type OrderItem = {
  name: string;
  brand: string;
  packSize: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
};

export type SupplierOrder = {
  supplier: string;
  items: OrderItem[];
  subtotal: number;
};

export function orderConfirmationEmail({
  clinicName,
  orderId,
  supplierOrders,
  total,
}: {
  clinicName: string;
  orderId: string;
  supplierOrders: SupplierOrder[];
  total: number;
}) {
  const itemRows = supplierOrders
    .map(
      (so) => `
        <div style="margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin-bottom: 10px;">
            ${so.supplier}
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            ${so.items
              .map(
                (item) => `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                  <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">${item.name}</p>
                  <p style="margin: 3px 0 0; color: #94a3b8; font-size: 12px;">${item.brand} · ${item.packSize}${item.sku ? ` · SKU: ${item.sku}` : ""}</p>
                </td>
                <td style="padding: 10px 0 10px 16px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; vertical-align: top; text-align: right;">
                  <p style="margin: 0; font-size: 13px; color: #64748b;">× ${item.quantity}</p>
                  <p style="margin: 3px 0 0; font-weight: 700; color: #151121; font-size: 14px;">£${(item.unitPrice * item.quantity).toFixed(2)}</p>
                </td>
              </tr>
            `
              )
              .join("")}
          </table>
          <div style="text-align: right; padding-top: 8px;">
            <span style="font-size: 12px; color: #94a3b8;">Subtotal: </span>
            <span style="font-size: 14px; font-weight: 800; color: #6C3DE8;">£${so.subtotal.toFixed(2)}</span>
          </div>
        </div>
      `
    )
    .join('<div style="height: 1px; background: #e2e8f0; margin: 8px 0 24px;"></div>');

  return {
    subject: `Order confirmed — £${total.toFixed(2)} · Ref: ${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 580px; margin: 0 auto; padding: 48px 24px; background: #ffffff;">
        <div style="font-size: 26px; font-weight: 800; color: #6C3DE8; margin-bottom: 32px; letter-spacing: -0.5px;">Dentago</div>

        <h2 style="font-size: 22px; font-weight: 800; color: #151121; margin: 0 0 8px; letter-spacing: -0.5px;">
          Your order is confirmed
        </h2>
        <p style="color: #64748b; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
          Hi ${clinicName}, we've received your order and are routing it to each supplier. You'll receive delivery updates directly from them.
        </p>

        <div style="background: #f8fafc; border-radius: 14px; padding: 18px 20px; margin-bottom: 28px; border: 1px solid #e2e8f0;">
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin: 0 0 4px;">Order Reference</p>
          <p style="font-family: monospace; font-weight: 700; color: #6C3DE8; font-size: 16px; margin: 0;">${orderId.toUpperCase()}</p>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 28px;">
          ${itemRows}
          <div style="border-top: 2px solid #151121; margin-top: 8px; padding-top: 14px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 15px; font-weight: 800; color: #151121;">Total</span>
            <span style="font-size: 22px; font-weight: 800; color: #151121; letter-spacing: -0.5px;">£${total.toFixed(2)}</span>
          </div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 16px 20px; margin-bottom: 32px;">
          <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.6;">
            <strong>Free to use.</strong> Dentago never charges clinics. Orders are placed directly with each supplier at their listed prices.
          </p>
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
          Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8;">support@dentago.co.uk</a>
        </p>
      </div>
    `,
  };
}

export function supplierOrderEmail({
  supplierName,
  clinicName,
  clinicEmail,
  orderId,
  items,
  subtotal,
}: {
  supplierName: string;
  clinicName: string;
  clinicEmail: string;
  orderId: string;
  items: OrderItem[];
  subtotal: number;
}) {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
          <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">${item.name}</p>
          <p style="margin: 3px 0 0; color: #94a3b8; font-size: 12px;">${item.brand} · ${item.packSize}${item.sku ? ` · SKU: ${item.sku}` : ""}</p>
        </td>
        <td style="padding: 10px 0 10px 16px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; vertical-align: top; text-align: right;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">× ${item.quantity}</p>
          <p style="margin: 3px 0 0; font-weight: 700; color: #151121; font-size: 14px;">£${(item.unitPrice * item.quantity).toFixed(2)}</p>
        </td>
      </tr>
    `
    )
    .join("");

  return {
    subject: `New order from ${clinicName} — £${subtotal.toFixed(2)} · Ref: ${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 580px; margin: 0 auto; padding: 48px 24px; background: #ffffff;">
        <div style="font-size: 26px; font-weight: 800; color: #6C3DE8; margin-bottom: 32px; letter-spacing: -0.5px;">Dentago</div>

        <h2 style="font-size: 22px; font-weight: 800; color: #151121; margin: 0 0 8px; letter-spacing: -0.5px;">
          New order for ${supplierName}
        </h2>
        <p style="color: #64748b; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
          A verified UK dental clinic has placed an order through Dentago. Please fulfil and contact them directly to confirm delivery.
        </p>

        <div style="background: #f8fafc; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; vertical-align: top; width: 40%;">
                <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin: 0;">Clinic</p>
              </td>
              <td style="padding: 4px 0; vertical-align: top;">
                <p style="font-size: 14px; font-weight: 700; color: #151121; margin: 0;">${clinicName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; vertical-align: top;">
                <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin: 0;">Contact</p>
              </td>
              <td style="padding: 4px 0; vertical-align: top;">
                <a href="mailto:${clinicEmail}" style="font-size: 14px; font-weight: 700; color: #6C3DE8; margin: 0;">${clinicEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; vertical-align: top;">
                <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin: 0;">Order Ref</p>
              </td>
              <td style="padding: 4px 0; vertical-align: top;">
                <p style="font-family: monospace; font-size: 14px; font-weight: 700; color: #151121; margin: 0;">${orderId.toUpperCase()}</p>
              </td>
            </tr>
          </table>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 28px;">
          <table style="width: 100%; border-collapse: collapse;">
            ${itemRows}
          </table>
          <div style="border-top: 2px solid #151121; margin-top: 8px; padding-top: 14px; text-align: right;">
            <span style="font-size: 14px; font-weight: 800; color: #151121;">Order Total: </span>
            <span style="font-size: 20px; font-weight: 800; color: #151121; letter-spacing: -0.5px;">£${subtotal.toFixed(2)}</span>
          </div>
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
          Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8;">support@dentago.co.uk</a><br>
          This order was placed via the Dentago marketplace. For queries contact support.
        </p>
      </div>
    `,
  };
}
