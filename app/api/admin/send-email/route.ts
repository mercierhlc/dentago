import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { approvedEmail } from '@/emails/approved'
import { rejectedEmail } from '@/emails/rejected'
import { documentRequestEmail } from '@/emails/document-request'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { to, type, practiceName, rejectionReason, documentType, message } = await request.json()

  let subject = ''
  let html = ''

  if (type === 'approved') {
    ({ subject, html } = approvedEmail({ practiceName }))
  } else if (type === 'rejected') {
    ({ subject, html } = rejectedEmail({ practiceName, reason: rejectionReason }))
  } else if (type === 'document_request') {
    ({ subject, html } = documentRequestEmail({ practiceName, documentType, message }))
  } else {
    return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })
  }

  const { error } = await resend.emails.send({
    from: 'Dentago <support@dentago.co.uk>',
    to,
    subject,
    html,
  })

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return NextResponse.json({ success: true })
}
