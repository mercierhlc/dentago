function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

export function welcomeEmail({ name, practiceName }: { name: string; practiceName?: string }) {
  const displayName = toTitleCase(name)
  const practice = practiceName ? toTitleCase(practiceName) : null

  return {
    subject: `Welcome to Dentago${practice ? `, ${practice}` : ''} — your workspace is ready`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">

        <!-- Header -->
        <div style="padding: 36px 40px 0;">
          <div style="font-size: 22px; font-weight: 800; color: #111111; letter-spacing: -0.4px;">Dentago</div>
        </div>

        <!-- Hero -->
        <div style="padding: 32px 40px 0;">
          <h1 style="font-size: 26px; font-weight: 800; color: #151121; margin: 0 0 10px; letter-spacing: -0.5px; line-height: 1.2;">
            ${practice ? `${practice} is ready.` : `Your workspace is ready, ${displayName}.`}
          </h1>
          <p style="color: #64748b; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
            Dentago is your procurement control tower — search every UK dental supplier in one place, manage invoices, track spend, and keep inventory under control. All free for your practice.
          </p>
        </div>

        <!-- Steps -->
        <div style="margin: 0 40px; background: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #e8e8e8;">
          <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.16em; color: #aaaaaa; margin: 0 0 20px;">Three things to do first</p>

          <!-- Step 1 -->
          <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #111111 0%, #555555 100%); flex-shrink: 0; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 34px; color: #fff; font-size: 15px; font-weight: 800;">1</div>
            <div style="padding-top: 2px;">
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Connect a supplier</p>
              <p style="margin: 3px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">Link your existing Henry Schein, Kent Express, or Dental Sky account to pull live pricing.</p>
            </div>
          </div>

          <!-- Step 2 -->
          <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: #f0f0f0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 34px; color: #111111; font-size: 15px; font-weight: 800;">2</div>
            <div style="padding-top: 2px;">
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Search and compare</p>
              <p style="margin: 3px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">Search any product by name, SKU, or category and see every supplier's price side by side.</p>
            </div>
          </div>

          <!-- Step 3 -->
          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: #f0f0f0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 34px; color: #111111; font-size: 15px; font-weight: 800;">3</div>
            <div style="padding-top: 2px;">
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Upload an invoice</p>
              <p style="margin: 3px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">Drop any PDF or photo — Dentago extracts line items, flags discrepancies, and updates your records automatically.</p>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div style="padding: 28px 40px 0;">
          <a href="https://www.dentago.co.uk/dashboard/onboarding"
             style="display: inline-block; background: #111111; color: #ffffff; padding: 15px 30px; border-radius: 13px; font-weight: 700; font-size: 14px; text-decoration: none; letter-spacing: -0.2px; box-shadow: 0 10px 30px -8px rgba(17,17,17,0.45);">
            Set up your workspace →
          </a>
        </div>

        <!-- What's included -->
        <div style="margin: 28px 40px 0; padding: 20px 24px; border-radius: 14px; border: 1px solid #e8e4f3;">
          <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.16em; color: #9189a8; margin: 0 0 14px;">Free for your practice, always</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            ${[
              ['🔍', 'Universal supplier search'],
              ['🧾', 'Invoice OCR & processing'],
              ['📦', 'Inventory tracking'],
              ['📊', 'Spend analytics'],
              ['🔔', 'Low-stock alerts'],
              ['🤝', 'Supplier management'],
            ].map(([icon, label]) => `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14px;">${icon}</span>
              <span style="font-size: 12px; color: #494455; font-weight: 600;">${label}</span>
            </div>`).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 32px 40px 40px;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px; border-top: 1px solid #f1f5f9; padding-top: 24px; line-height: 1.6;">
            Questions? Reply to this email or reach us at <a href="mailto:support@dentago.co.uk" style="color: #111111; text-decoration: none;">support@dentago.co.uk</a>
          </p>
          <p style="color: #c4bdd6; font-size: 11px; margin: 0;">
            Dentago Ltd · London, UK · <a href="https://www.dentago.co.uk" style="color: #c4bdd6; text-decoration: none;">dentago.co.uk</a>
          </p>
        </div>

      </div>
    `,
  }
}
