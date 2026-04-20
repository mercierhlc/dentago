function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

export function welcomeEmail({ name }: { name: string }) {
  const displayName = toTitleCase(name)
  return {
    subject: "Welcome to Dentago — let's get you verified",
    html: `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; background: #ffffff;">
        <div style="font-size: 26px; font-weight: 800; color: #6C3DE8; margin-bottom: 32px; letter-spacing: -0.5px;">Dentago</div>

        <h2 style="font-size: 24px; font-weight: 800; color: #151121; margin: 0 0 12px; letter-spacing: -0.5px;">
          Welcome, ${displayName}!
        </h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.7; margin: 0 0 32px;">
          Your Dentago account has been created. You're one step closer to comparing real-time prices across 45+ UK dental suppliers — completely free.
        </p>

        <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin-bottom: 32px; border: 1px solid #e2e8f0;">
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin: 0 0 16px;">Complete your application</p>
          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;">
            <div style="width: 24px; height: 24px; border-radius: 8px; background: #6C3DE8; flex-shrink: 0; margin-top: 1px; text-align: center; line-height: 24px; color: white; font-size: 14px; font-weight: 800;">✓</div>
            <div>
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Account created</p>
              <p style="margin: 2px 0 0; color: #94a3b8; font-size: 13px;">Done — you're in.</p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;">
            <div style="width: 24px; height: 24px; border-radius: 8px; background: #e2e8f0; flex-shrink: 0; margin-top: 1px;"></div>
            <div>
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Practice details</p>
              <p style="margin: 2px 0 0; color: #94a3b8; font-size: 13px;">Add your practice name, address, and GDC number.</p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;">
            <div style="width: 24px; height: 24px; border-radius: 8px; background: #e2e8f0; flex-shrink: 0; margin-top: 1px;"></div>
            <div>
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Verify your practice</p>
              <p style="margin: 2px 0 0; color: #94a3b8; font-size: 13px;">Upload your GDC certificate and proof of address.</p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 24px; height: 24px; border-radius: 8px; background: #e2e8f0; flex-shrink: 0; margin-top: 1px;"></div>
            <div>
              <p style="margin: 0; font-weight: 700; color: #151121; font-size: 14px;">Connect suppliers</p>
              <p style="margin: 2px 0 0; color: #94a3b8; font-size: 13px;">Link your existing supplier accounts for live pricing.</p>
            </div>
          </div>
        </div>

        <a href="https://dentago.co.uk/onboarding/step2.html"
           style="display: inline-block; background: #6C3DE8; color: #ffffff; padding: 16px 32px; border-radius: 14px; font-weight: 800; font-size: 15px; text-decoration: none; letter-spacing: -0.2px;">
          Continue your application →
        </a>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 48px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
          Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8;">support@dentago.co.uk</a>
        </p>
      </div>
    `,
  }
}
