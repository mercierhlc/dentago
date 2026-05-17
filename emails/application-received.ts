export function applicationReceivedEmail({ practiceName }: { practiceName: string }) {
  return {
    subject: `You're in, ${practiceName} — your Dentago workspace is live`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">

        <!-- Header -->
        <div style="padding: 36px 40px 0;">
          <div style="font-size: 22px; font-weight: 800; color: #111111; letter-spacing: -0.4px;">Dentago</div>
        </div>

        <!-- Badge -->
        <div style="padding: 24px 40px 0;">
          <div style="display: inline-flex; align-items: center; gap: 7px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 7px 13px;">
            <div style="width: 7px; height: 7px; border-radius: 50%; background: #22c55e;"></div>
            <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #15803d;">Workspace active</span>
          </div>
        </div>

        <!-- Hero -->
        <div style="padding: 20px 40px 0;">
          <h1 style="font-size: 26px; font-weight: 800; color: #151121; margin: 0 0 10px; letter-spacing: -0.5px; line-height: 1.2;">
            ${practiceName} is set up and ready.
          </h1>
          <p style="color: #64748b; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
            Your Dentago workspace is live. Start by connecting a supplier account and running your first search — it takes less than two minutes.
          </p>
        </div>

        <!-- What you can do now -->
        <div style="margin: 0 40px; background: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #e8e4f3;">
          <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.16em; color: #9189a8; margin: 0 0 20px;">Start here</p>

          <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #111111 0%, #555555 100%); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 17px;">🔌</div>
            <div style="padding-top: 2px;">
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Connect a supplier</p>
              <p style="margin: 3px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">Henry Schein, Kent Express, Dental Sky and more — link your existing account for live pricing.</p>
            </div>
          </div>

          <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #f0ebff; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 17px;">🔍</div>
            <div style="padding-top: 2px;">
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Compare prices instantly</p>
              <p style="margin: 3px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">Search any product and see all UK suppliers side by side — then add to their basket directly.</p>
            </div>
          </div>

          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #f0ebff; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 17px;">🧾</div>
            <div style="padding-top: 2px;">
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Upload your last invoice</p>
              <p style="margin: 3px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">Drop any PDF — Dentago extracts every line item, flags discrepancies, and keeps a searchable record.</p>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div style="padding: 28px 40px 0;">
          <a href="https://www.dentago.co.uk/dashboard"
             style="display: inline-block; background: #111111; color: #ffffff; padding: 15px 30px; border-radius: 13px; font-weight: 700; font-size: 14px; text-decoration: none; letter-spacing: -0.2px; box-shadow: 0 10px 30px -8px rgba(17,17,17,0.45);">
            Go to your workspace →
          </a>
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
