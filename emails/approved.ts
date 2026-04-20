export function approvedEmail({ practiceName }: { practiceName: string }) {
  return {
    subject: 'Your Dentago application is approved!',
    html: `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; background: #ffffff;">
        <div style="font-size: 26px; font-weight: 800; color: #6C3DE8; margin-bottom: 32px; letter-spacing: -0.5px;">Dentago</div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 14px 20px; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 28px;">
          <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #16a34a;">✓ Approved</span>
        </div>

        <h2 style="font-size: 24px; font-weight: 800; color: #151121; margin: 0 0 12px; letter-spacing: -0.5px;">
          Welcome to Dentago, ${practiceName}!
        </h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.7; margin: 0 0 32px;">
          Great news — your practice has been verified and your account is now active. You can start comparing prices across 45+ UK dental suppliers right now.
        </p>

        <a href="https://dentago.co.uk/onboarding/login.html"
           style="display: inline-block; background: #6C3DE8; color: #ffffff; padding: 16px 32px; border-radius: 14px; font-weight: 800; font-size: 15px; text-decoration: none; letter-spacing: -0.2px; margin-bottom: 32px;">
          Access Dentago →
        </a>

        <div style="background: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0;">
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin: 0 0 16px;">What's available to you</p>
          <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; line-height: 1.6;">✦ Real-time pricing from 45+ UK dental suppliers</p>
          <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; line-height: 1.6;">✦ Side-by-side product comparisons</p>
          <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; line-height: 1.6;">✦ Verified supplier network</p>
          <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">✦ 100% free — always</p>
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 48px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
          Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8;">support@dentago.co.uk</a>
        </p>
      </div>
    `,
  }
}
