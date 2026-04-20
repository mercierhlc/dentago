export function rejectedEmail({ practiceName, reason }: { practiceName: string; reason: string }) {
  return {
    subject: 'Update on your Dentago application',
    html: `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; background: #ffffff;">
        <div style="font-size: 26px; font-weight: 800; color: #6C3DE8; margin-bottom: 32px; letter-spacing: -0.5px;">Dentago</div>

        <h2 style="font-size: 24px; font-weight: 800; color: #151121; margin: 0 0 12px; letter-spacing: -0.5px;">
          Update on your application
        </h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
          Hi ${practiceName}, unfortunately we were unable to approve your application at this time.
        </p>

        <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 12px 12px 0; padding: 20px 24px; margin-bottom: 28px;">
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #b91c1c; margin: 0 0 8px;">Reason</p>
          <p style="color: #b91c1c; font-size: 15px; margin: 0; line-height: 1.6;">${reason}</p>
        </div>

        <p style="color: #64748b; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
          You're welcome to resubmit with the correct documents and we'll review it again straight away.
        </p>

        <a href="https://dentago.co.uk/onboarding/step1.html"
           style="display: inline-block; background: #6C3DE8; color: #ffffff; padding: 16px 32px; border-radius: 14px; font-weight: 800; font-size: 15px; text-decoration: none; letter-spacing: -0.2px;">
          Resubmit application →
        </a>

        <p style="color: #64748b; font-size: 14px; line-height: 1.7; margin: 28px 0 0;">
          If you have questions, reply to this email or contact us at <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8; font-weight: 700;">support@dentago.co.uk</a>.
        </p>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 48px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
          Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color: #6C3DE8;">support@dentago.co.uk</a>
        </p>
      </div>
    `,
  }
}
