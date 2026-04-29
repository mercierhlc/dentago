import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

function getAnswer(qna: { question: string; answer: string }[], keyword: string): string | undefined {
  const match = qna.find(q => q.question.toLowerCase().includes(keyword.toLowerCase()))
  return match?.answer?.trim() || undefined
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

function wrapEmail(content: string): string {
  return `<div style="font-family:'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;padding:48px 24px;background:#ffffff;">
    <div style="font-size:26px;font-weight:800;color:#6C3DE8;margin-bottom:32px;letter-spacing:-0.5px;">Dentago</div>
    ${content}
    <p style="color:#94a3b8;font-size:12px;margin-top:48px;border-top:1px solid #f1f5f9;padding-top:24px;">
      Dentago Ltd · London, UK · <a href="mailto:support@dentago.co.uk" style="color:#6C3DE8;">support@dentago.co.uk</a>
    </p>
  </div>`
}

function bookingBox(formattedTime: string): string {
  return `<div style="background:#f8fafc;border-radius:16px;padding:24px;margin-bottom:32px;border:1px solid #e2e8f0;">
    <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin:0 0 16px;">Your booking</p>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
      <div style="width:36px;height:36px;border-radius:10px;background:#6C3DE8;flex-shrink:0;text-align:center;line-height:36px;font-size:16px;font-weight:800;color:#ffffff;">✦</div>
      <div>
        <p style="margin:0;font-weight:700;color:#151121;font-size:14px;">Date &amp; time</p>
        <p style="margin:3px 0 0;color:#64748b;font-size:13px;">${formattedTime}</p>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:16px;">
      <div style="width:36px;height:36px;border-radius:10px;background:#6C3DE8;flex-shrink:0;text-align:center;line-height:36px;font-size:16px;font-weight:800;color:#ffffff;">▶</div>
      <div>
        <p style="margin:0;font-weight:700;color:#151121;font-size:14px;">Google Meet</p>
        <p style="margin:3px 0 0;color:#94a3b8;font-size:13px;">Link below — no downloads needed.</p>
      </div>
    </div>
  </div>`
}

function joinButton(meetLink: string, label = 'Join the call →'): string {
  return `<a href="${meetLink}" style="display:inline-block;background:#6C3DE8;color:#ffffff;padding:16px 32px;border-radius:14px;font-weight:800;font-size:15px;text-decoration:none;letter-spacing:-0.2px;margin-bottom:32px;">${label}</a>`
}

async function generateEmailBody(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: prompt,
    }],
  })

  const text = response.content.find(b => b.type === 'text')
  return text?.text?.trim() ?? ''
}

export async function POST(request: Request) {
  const body = await request.json()

  if (body.event !== 'invitee.created') {
    return NextResponse.json({ received: true })
  }

  const payload = body.payload
  const scheduledEvent = payload?.scheduled_event

  if (!payload || !scheduledEvent) {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 })
  }

  const name = payload.name?.trim() ?? 'there'
  const firstName = name.split(' ')[0]
  const email = payload.email?.trim()
  const startTime = scheduledEvent.start_time
  const meetLink = scheduledEvent.location?.join_url ?? 'https://www.dentago.co.uk/demo'
  const formattedTime = formatDateTime(startTime)

  if (!email) {
    return NextResponse.json({ error: 'No invitee email' }, { status: 400 })
  }

  const qna: { question: string; answer: string }[] = payload.questions_and_answers ?? []
  const practiceName = getAnswer(qna, 'practice name')
  const role = getAnswer(qna, 'role')
  const suppliers = getAnswer(qna, 'suppliers do you currently use')
  const compareMethod = getAnswer(qna, 'compare prices')
  const painPoint = getAnswer(qna, 'hoping Dentago')
  const monthlySpend = getAnswer(qna, 'monthly spend')
  const chairs = getAnswer(qna, 'dental chairs')
  const source = getAnswer(qna, 'hear about')

  const context = `
Person: ${name}
Practice: ${practiceName ?? 'unknown'}
Role: ${role ?? 'unknown'}
Suppliers they use: ${suppliers ?? 'unknown'}
How they currently compare prices: ${compareMethod ?? 'unknown'}
What they hope Dentago helps with: ${painPoint ?? 'unknown'}
Monthly spend on supplies: ${monthlySpend ?? 'unknown'}
Number of dental chairs: ${chairs ?? 'unknown'}
Demo time: ${formattedTime}
`.trim()

  const brandVoice = `
You are Mo, founder of Dentago — a free procurement platform for UK dental practices.
Tone: Direct, warm, founder energy. You genuinely believe in the product. Short sentences. No filler.
Never say "I hope this email finds you well", "excited to", "delighted to", or any corporate filler.
Write in first person. Make every word earn its place.
`.trim()

  // Generate all 3 AI email bodies in parallel
  const [body1, body2, body3] = await Promise.all([

    // Email 1 — Immediate confirmation (value-driven)
    generateEmailBody(`
${brandVoice}

Write the body of a booking confirmation email sent immediately after someone books a Dentago demo.

About this person:
${context}

The goal of this email: make them feel like booking was the right call. Deliver immediate value — show them you understand their exact situation. Make them excited for the demo.

Structure:
1. A punchy heading (1 line) that reflects their specific situation — NOT generic. E.g. reference their suppliers, their role, or their pain point. No "See you soon."
2. 1-2 short paragraphs. Reference their suppliers by name (comma-separated, written naturally). Acknowledge the pain of manual price comparison. Tell them what Dentago will do for them specifically.
3. If they gave a monthly spend, calculate a saving: multiply by 12 for annual spend, then say "practices like yours typically save 10-15% — that's £X–£Y a year" (calculate the range). If no spend given, skip this.
4. One final line: "Any questions before the call — just reply here."

Output ONLY the text. No subject line. No greeting. No sign-off. No HTML. No markdown. Plain text, line breaks between paragraphs.
`),

    // Email 2 — 24 hours before (anticipation + value preview)
    generateEmailBody(`
${brandVoice}

Write the body of an email sent exactly 24 hours before a Dentago demo.

About this person:
${context}

The goal: make them genuinely look forward to the demo. Remind them why they booked. Show them what they're about to see has real value for their specific practice.

Structure:
1. A heading that creates anticipation — reference that it's tomorrow, and tie it to something specific about them (their suppliers, their pain, their practice size).
2. One short paragraph: what they'll actually see tomorrow — name their suppliers, describe the moment they see price gaps side by side. Make it vivid and specific.
3. Three bullet points starting with ✦ showing concrete value they'll walk away with. Make these specific to their situation (e.g. if they have 11+ chairs, mention group-wide impact; if they mentioned cost savings, quantify).
4. One line: "See you tomorrow."

Output ONLY the text. No subject line. No greeting. No sign-off. No HTML. No markdown. Plain text.
`),

    // Email 3 — 2 hours before (short, punchy, practical)
    generateEmailBody(`
${brandVoice}

Write the body of a very short email sent 2 hours before a Dentago demo.

About this person:
${context}

The goal: cut through their day. Remind them it's happening soon. Give them one reason to be glad they're doing this.

Structure:
1. A short heading — something like "2 hours away" but more specific to them.
2. ONE sentence only. Reference their suppliers or their pain point. Make it feel like the demo is going to be worth their 30 minutes.
3. That's it. The email template will handle the booking details and join button.

Output ONLY the heading and one sentence. No subject line. No greeting. No sign-off. No HTML. No markdown.
`),
  ])

  // Parse the AI output into heading + body
  function splitHeadingBody(text: string): { heading: string; body: string } {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length === 0) return { heading: `See you soon, ${firstName}.`, body: '' }
    return { heading: lines[0], body: lines.slice(1).join('\n').trim() }
  }

  function renderParagraphs(text: string): string {
    return text
      .split('\n')
      .filter(l => l.trim())
      .map(line => {
        if (line.startsWith('✦')) {
          return `<p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 10px;">${line}</p>`
        }
        return `<p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 16px;">${line}</p>`
      })
      .join('')
  }

  const e1 = splitHeadingBody(body1)
  const e2 = splitHeadingBody(body2)
  const e3 = splitHeadingBody(body3)

  // Build HTML for each email
  const html1 = wrapEmail(`
    <h2 style="font-size:24px;font-weight:800;color:#151121;margin:0 0 20px;letter-spacing:-0.5px;">${e1.heading}</h2>
    ${renderParagraphs(e1.body)}
    ${bookingBox(formattedTime)}
    ${joinButton(meetLink)}
  `)

  const html2 = wrapEmail(`
    <h2 style="font-size:24px;font-weight:800;color:#151121;margin:0 0 20px;letter-spacing:-0.5px;">${e2.heading}</h2>
    ${renderParagraphs(e2.body)}
    ${bookingBox(formattedTime)}
    ${joinButton(meetLink, 'Join tomorrow →')}
  `)

  const html3 = wrapEmail(`
    <h2 style="font-size:24px;font-weight:800;color:#151121;margin:0 0 20px;letter-spacing:-0.5px;">${e3.heading}</h2>
    ${renderParagraphs(e3.body)}
    ${bookingBox(formattedTime)}
    ${joinButton(meetLink)}
  `)

  // Email 4 — at start (no AI needed, keep it simple)
  const suppliersFormatted = suppliers
    ? suppliers.split(/,|\n/).map(s => s.trim()).filter(Boolean).join(', ')
    : null

  const html4 = wrapEmail(`
    <h2 style="font-size:24px;font-weight:800;color:#151121;margin:0 0 20px;letter-spacing:-0.5px;">We're live, ${firstName}.</h2>
    <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 32px;">
      ${suppliersFormatted ? `We've got ${suppliersFormatted} ready to go.` : `We're ready when you are.`} Click below to join — takes 10 seconds.
    </p>
    ${joinButton(meetLink, 'Join the call now →')}
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">Running a couple minutes late? No problem — we'll be here.</p>
  `)

  // Schedule send times
  const startDate = new Date(startTime)
  const minus24h = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
  const minus2h = new Date(startDate.getTime() - 2 * 60 * 60 * 1000)

  const from = 'Mo at Dentago <support@dentago.co.uk>'

  const sends = [
    resend.emails.send({ from, to: email, subject: `You're booked — Dentago Introduction`, html: html1 }),
    resend.emails.send({ from, to: email, subject: `Your Dentago demo is tomorrow`, html: html2, scheduledAt: minus24h.toISOString() }),
    resend.emails.send({ from, to: email, subject: `2 hours away — your Dentago demo link`, html: html3, scheduledAt: minus2h.toISOString() }),
    resend.emails.send({ from, to: email, subject: `We're live — join your Dentago demo now`, html: html4, scheduledAt: startDate.toISOString() }),
  ]

  const results = await Promise.all(sends)
  const errors = results.filter(r => r.error).map(r => r.error)

  if (errors.length > 0) {
    console.error('Email send errors:', errors)
    return NextResponse.json({ error: errors }, { status: 500 })
  }

  return NextResponse.json({ success: true, emailsSent: 4 })
}
