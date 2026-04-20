import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { welcomeEmail } from '@/emails/welcome'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { to, name } = await request.json()
  if (!to || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { subject, html } = welcomeEmail({ name })
  const { error } = await resend.emails.send({
    from: 'Dentago <support@dentago.co.uk>',
    to,
    subject,
    html,
  })

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return NextResponse.json({ success: true })
}
