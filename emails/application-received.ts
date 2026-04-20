export function applicationReceivedEmail({ practiceName }: { practiceName: string }) {
  return {
    subject: 'Application received — we\'re reviewing your documents',
    html: `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; background: #ffffff;">
        <div style="font-size: 26px; font-weight: 800; color: #6C3DE8; margin-bottom: 32px; letter-spacing: -0.5px;">Dentago</div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 14px 20px; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 28px;">
          <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #d97706;">⏳ Under Review</span>
        </div>

        <h2 style="font-size: 24px; font-weight: 800; color: #151121; margin: 0 0 12px; letter-spacing: -0.5px;">
          Application received, ${practiceName}
        </h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.7; margin: 0 0 32px;">
          We've received your full application and our team is now reviewing your documents. This usually takes <strong style="color: #151121;">under 24 hours</strong>. We'll email you the moment your account is activated.
        </p>

        <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin-bottom: 32px; border: 1px solid #e2e8f0;">
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin: 0 0 20px;">What happens next</p>

          <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span style="font-size: 16px;">🔍</span>
            </div>
            <div>
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Document review</p>
              <p style="margin: 3px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">We manually verify every GDC certificate and proof of address.</p>
            </div>
          </div>

          <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #eff6ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span style="font-size: 16px;">✉️</span>
            </div>
            <div>
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Approval email</p>
              <p style="margin: 3px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">You'll receive a confirmation email with your dashboard link.</p>
            </div>
          </div>

          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span style="font-size: 16px;">🛒</span>
            </div>
            <div>
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Marketplace access</p>
              <p style="margin: 3px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">Browse 45+ suppliers and compare live pricing — free, forever.</p>
            </div>
          </div>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.7; margin: 0 0 28px;">
          Have a question while you wait? We're here.
        </p>

        <a href="mailto:support@dentago.co.uk"
           style="display: inline-block; background: #f8fafc; color: #151121; padding: 14px 28px; border-radius: 14px; font-weight: 700; font-size: 14px; text-decoration: none; border: 1px solid #e2e8f0;">
          Contact support →
        </a>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 48px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
          Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8;">support@dentago.co.uk</a>
        </p>
      </div>
    `,
  }
}
