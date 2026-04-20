export function documentRequestEmail({
  practiceName,
  documentType,
  message,
}: {
  practiceName: string
  documentType: string
  message?: string
}) {
  return {
    subject: 'Action required: document re-upload needed',
    html: `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; background: #ffffff;">
        <div style="font-size: 26px; font-weight: 800; color: #6C3DE8; margin-bottom: 32px; letter-spacing: -0.5px;">Dentago</div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 14px 20px; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 28px;">
          <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #d97706;">⚠ Action Required</span>
        </div>

        <h2 style="font-size: 24px; font-weight: 800; color: #151121; margin: 0 0 12px; letter-spacing: -0.5px;">
          Document re-upload needed
        </h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
          Hi ${practiceName}, we need you to re-upload your <strong style="color: #151121;">${documentType}</strong> before we can complete your verification.
        </p>

        ${message ? `
        <div style="background: #f8fafc; border-radius: 12px; padding: 18px 22px; margin-bottom: 28px; border: 1px solid #e2e8f0;">
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin: 0 0 8px;">Note from our team</p>
          <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.6;">${message}</p>
        </div>
        ` : ''}

        <a href="https://dentago.co.uk/onboarding/step3.html"
           style="display: inline-block; background: #6C3DE8; color: #ffffff; padding: 16px 32px; border-radius: 14px; font-weight: 800; font-size: 15px; text-decoration: none; letter-spacing: -0.2px;">
          Re-upload document →
        </a>

        <p style="color: #64748b; font-size: 14px; line-height: 1.7; margin: 28px 0 0;">
          Any questions? Contact us at <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8; font-weight: 700;">support@dentago.co.uk</a>.
        </p>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 48px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
          Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8;">support@dentago.co.uk</a>
        </p>
      </div>
    `,
  }
}
