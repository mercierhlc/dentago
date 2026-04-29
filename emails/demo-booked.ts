function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
    timeZoneName: 'short',
  })
}

function iconBox(symbol: string) {
  return `<div style="width:36px;height:36px;border-radius:10px;background:#6C3DE8;flex-shrink:0;text-align:center;line-height:36px;font-size:16px;font-weight:800;color:#ffffff;">${symbol}</div>`
}

function footer() {
  return `<p style="color:#94a3b8;font-size:12px;margin-top:48px;border-top:1px solid #f1f5f9;padding-top:24px;">
    Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color:#6C3DE8;">support@dentago.co.uk</a>
  </p>`
}

function header(title: string) {
  return `<div style="font-size:26px;font-weight:800;color:#6C3DE8;margin-bottom:32px;letter-spacing:-0.5px;">Dentago</div>
    <h2 style="font-size:24px;font-weight:800;color:#151121;margin:0 0 12px;letter-spacing:-0.5px;">${title}</h2>`
}

function bookingBox(formattedTime: string) {
  return `<div style="background:#f8fafc;border-radius:16px;padding:24px;margin-bottom:32px;border:1px solid #e2e8f0;">
    <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin:0 0 16px;">Your booking</p>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
      ${iconBox('✦')}
      <div>
        <p style="margin:0;font-weight:700;color:#151121;font-size:14px;">Date &amp; time</p>
        <p style="margin:3px 0 0;color:#64748b;font-size:13px;">${formattedTime}</p>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:16px;">
      ${iconBox('▶')}
      <div>
        <p style="margin:0;font-weight:700;color:#151121;font-size:14px;">Google Meet</p>
        <p style="margin:3px 0 0;color:#94a3b8;font-size:13px;">Link below — no downloads needed.</p>
      </div>
    </div>
  </div>`
}

function joinButton(meetLink: string, label = 'Join the call →') {
  return `<a href="${meetLink}" style="display:inline-block;background:#6C3DE8;color:#ffffff;padding:16px 32px;border-radius:14px;font-weight:800;font-size:15px;text-decoration:none;letter-spacing:-0.2px;margin-bottom:32px;">${label}</a>`
}

function wrap(content: string) {
  return `<div style="font-family:'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;padding:48px 24px;background:#ffffff;">${content}</div>`
}

// ─── Email 1: Immediate confirmation ────────────────────────────────────────

export function demoBookedEmail({
  name,
  startTime,
  meetLink,
  suppliers,
  painPoint,
  role,
  compareMethod,
  monthlySpend,
}: {
  name: string
  startTime: string
  meetLink: string
  suppliers?: string
  painPoint?: string
  role?: string
  compareMethod?: string
  monthlySpend?: string
}) {
  const displayName = toTitleCase(name)
  const formattedTime = formatDateTime(startTime)

  const suppliersLine = suppliers
    ? `<p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 8px;">You mentioned you use <strong style="color:#151121;">${suppliers}</strong> — we'll show you live prices across all of them, side by side, instantly.</p>`
    : ''

  const painLine = painPoint
    ? `<p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 8px;">You said you want help with: <em>"${painPoint}"</em> — that's exactly what we built Dentago for.</p>`
    : ''

  const compareLine = compareMethod
    ? `<p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px;">Right now you're comparing prices ${compareMethod.toLowerCase()}. After the demo, you won't need to do that again.</p>`
    : '<p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px;">In 30 minutes, we\'ll show you how to search every supplier at once and order — all in one place, free.</p>'

  const spendLine = monthlySpend
    ? `<p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">Based on ~${monthlySpend}/month in supplies, most practices in your position save <strong style="color:#151121;">£400–£800/month</strong> with Dentago. We'll calculate yours on the call.</p>`
    : ''

  return {
    subject: "You're booked — Dentago Introduction",
    html: wrap(`
      ${header(`See you soon, ${displayName}.`)}
      ${suppliersLine}
      ${painLine}
      ${compareLine}
      ${bookingBox(formattedTime)}
      ${joinButton(meetLink)}
      ${spendLine ? `<div style="background:#f0ebff;border-radius:16px;padding:20px;margin-bottom:32px;border:1px solid #d4c5f9;">${spendLine}</div>` : ''}
      <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">Questions before the call? Just reply to this email.</p>
      ${footer()}
    `),
  }
}

// ─── Email 2: 24 hours before ────────────────────────────────────────────────

export function demoReminder24hEmail({
  name,
  startTime,
  meetLink,
  suppliers,
  chairs,
  monthlySpend,
}: {
  name: string
  startTime: string
  meetLink: string
  suppliers?: string
  chairs?: string
  monthlySpend?: string
}) {
  const displayName = toTitleCase(name)
  const formattedTime = formatDateTime(startTime)
  const isGroup = chairs?.includes('11+')

  const savingsEstimate = monthlySpend
    ? `Based on your spend of ~${monthlySpend}/month, we'll calculate your exact potential saving live on the call.`
    : isGroup
    ? `For a practice your size, we typically identify £600–£1,200/month in savings. We'll show you yours on the call.`
    : `Most single practices save £300–£600/month. We'll calculate yours live tomorrow.`

  const suppliersLine = suppliers
    ? `Tomorrow we'll pull up live prices from <strong style="color:#151121;">${suppliers}</strong> — the exact suppliers you use — and show you the gaps you're currently missing.`
    : `Tomorrow we'll pull up live prices across your suppliers and show you the gaps you're currently missing.`

  return {
    subject: 'Your Dentago demo is tomorrow — here\'s what to expect',
    html: wrap(`
      ${header(`Tomorrow, ${displayName}.`)}
      <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px;">${suppliersLine}</p>
      ${bookingBox(formattedTime)}

      <div style="background:#f8fafc;border-radius:16px;padding:24px;margin-bottom:32px;border:1px solid #e2e8f0;">
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin:0 0 16px;">What you'll see in 30 minutes</p>
        <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 10px;">✦ &nbsp;Every supplier's price for the same product — instantly</p>
        <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 10px;">✦ &nbsp;One cart, one checkout across all your suppliers</p>
        <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 10px;">✦ &nbsp;Your personal savings estimate — calculated live</p>
        <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">✦ &nbsp;Free forever for dental practices. No catch.</p>
      </div>

      <div style="background:#f0ebff;border-radius:16px;padding:20px;margin-bottom:32px;border:1px solid #d4c5f9;">
        <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">${savingsEstimate}</p>
      </div>

      ${joinButton(meetLink, 'Add to calendar / join tomorrow →')}
      ${footer()}
    `),
  }
}

// ─── Email 3: 2 hours before ─────────────────────────────────────────────────

export function demoReminder2hEmail({
  name,
  startTime,
  meetLink,
  suppliers,
}: {
  name: string
  startTime: string
  meetLink: string
  suppliers?: string
}) {
  const displayName = toTitleCase(name)
  const formattedTime = formatDateTime(startTime)

  const suppliersLine = suppliers
    ? `We've got ${suppliers} queued up — ready to show you live prices the moment we start.`
    : `We're ready to show you live prices across your suppliers the moment we start.`

  return {
    subject: "2 hours away — your Dentago demo link",
    html: wrap(`
      ${header(`2 hours, ${displayName}.`)}
      <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px;">${suppliersLine} No prep needed on your end — just show up.</p>
      ${bookingBox(formattedTime)}
      ${joinButton(meetLink)}
      <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">Need to reschedule? Reply to this email and we'll sort it.</p>
      ${footer()}
    `),
  }
}

// ─── Email 4: At meeting start ───────────────────────────────────────────────

export function demoStartEmail({
  name,
  meetLink,
  suppliers,
}: {
  name: string
  meetLink: string
  suppliers?: string
}) {
  const displayName = toTitleCase(name)

  const suppliersLine = suppliers
    ? `We've got ${suppliers} ready to go.`
    : `We're ready when you are.`

  return {
    subject: "We're live — join your Dentago demo now",
    html: wrap(`
      ${header(`We're live, ${displayName}.`)}
      <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 32px;">${suppliersLine} Click below to join — takes 10 seconds.</p>
      ${joinButton(meetLink, 'Join the call now →')}
      <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">Running a couple minutes late? No problem — we'll be here.</p>
      ${footer()}
    `),
  }
}
