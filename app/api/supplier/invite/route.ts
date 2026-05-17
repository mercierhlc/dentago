import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// HMAC-signed stateless invite tokens — no supplier_invites table required.
// Token format: base64url(<json payload>.<hmac-sha256 signature>)
// Payload: { supplier_id, email, role, nonce, expires_at }
// This means invites are self-contained and verifiable without a DB round-trip.
// Accepted invites are tracked via the events table.

const INVITE_SECRET =
  process.env.SUPPLIER_INVITE_SECRET ??
  process.env.CREDENTIAL_SECRET ??
  'dentago-invite-secret-change-in-prod'

const INVITE_TTL_DAYS = 7

function signToken(payload: object): string {
  const json = JSON.stringify(payload)
  const b64 = Buffer.from(json).toString('base64url')
  const sig = createHmac('sha256', INVITE_SECRET).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [b64, sig] = parts
  const expectedSig = createHmac('sha256', INVITE_SECRET).update(b64).digest('base64url')
  try {
    const sigBuf = Buffer.from(sig, 'base64url')
    const expBuf = Buffer.from(expectedSig, 'base64url')
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
  } catch {
    return null
  }
  try {
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

// GET /api/supplier/invite?token=xxx — validate invite token
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  // Try supplier_invites table first (if it exists)
  const { data: dbInvite, error: dbErr } = await supabaseAdmin
    .from('supplier_invites')
    .select('id, email, role, expires_at, accepted_at, supplier_id, dentago_suppliers(name)')
    .eq('token', token)
    .maybeSingle()

  if (!dbErr && dbInvite) {
    if (dbInvite.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })
    if (new Date(dbInvite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
    return NextResponse.json({
      email: dbInvite.email,
      role: dbInvite.role,
      supplierName: (dbInvite as any).dentago_suppliers?.name ?? 'Unknown',
    })
  }

  // Fall back to HMAC-signed token
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })

  const { supplier_id, email, role, expires_at, nonce } = payload as any
  if (!expires_at || new Date(expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
  }

  // Check if this invite was already accepted (check events table by nonce)
  const { data: acceptEvents } = await supabaseAdmin
    .from('events')
    .select('payload')
    .eq('event_type', 'supplier_invite_accepted')
    .eq('entity_type', 'supplier')
    .eq('entity_id', String(supplier_id))

  const alreadyAccepted = (acceptEvents ?? []).some(
    (e: any) => e.payload?.nonce === nonce && e.payload?.email === email
  )
  if (alreadyAccepted) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })

  // Get supplier name
  const { data: supplier } = await supabaseAdmin
    .from('dentago_suppliers')
    .select('name')
    .eq('id', supplier_id)
    .maybeSingle()

  return NextResponse.json({
    email,
    role: role ?? 'manager',
    supplierName: supplier?.name ?? 'Unknown',
  })
}

// POST /api/supplier/invite — accept invite (set password + create supplier account)
export async function POST(request: Request) {
  const { token, password } = await request.json()
  if (!token || !password) return NextResponse.json({ error: 'Token and password required' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  let inviteEmail: string
  let inviteRole: string
  let inviteSupplierId: number
  let inviteNonce: string | undefined
  let dbInviteId: string | undefined

  // Try supplier_invites table first
  const { data: dbInvite, error: dbErr } = await supabaseAdmin
    .from('supplier_invites')
    .select('id, email, role, supplier_id, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (!dbErr && dbInvite) {
    if (dbInvite.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })
    if (new Date(dbInvite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
    inviteEmail = dbInvite.email
    inviteRole = dbInvite.role
    inviteSupplierId = dbInvite.supplier_id
    dbInviteId = dbInvite.id
  } else {
    // Fall back to HMAC-signed token
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })

    const { supplier_id, email, role, expires_at, nonce } = payload as any
    if (!expires_at || new Date(expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
    }

    // Check if already accepted (search by nonce in events)
    const { data: acceptEvents } = await supabaseAdmin
      .from('events')
      .select('payload')
      .eq('event_type', 'supplier_invite_accepted')
      .eq('entity_type', 'supplier')
      .eq('entity_id', String(supplier_id))

    const alreadyAccepted = (acceptEvents ?? []).some(
      (e: any) => e.payload?.nonce === nonce && e.payload?.email === email
    )
    if (alreadyAccepted) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })

    inviteEmail = email
    inviteRole = role ?? 'manager'
    inviteSupplierId = supplier_id
    inviteNonce = nonce
  }

  // Create or look up auth user
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
  const existingUser = existing?.users?.find((u: any) => u.email === inviteEmail)

  let authUserId: string
  if (existingUser) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password })
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    authUserId = existingUser.id
  } else {
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: inviteEmail,
      password,
      email_confirm: true,
    })
    if (createError || !newUser.user) return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 500 })
    authUserId = newUser.user.id
  }

  // Insert into supplier_users (if table exists)
  await supabaseAdmin
    .from('supplier_users')
    .upsert({ auth_user_id: authUserId, supplier_id: inviteSupplierId, role: inviteRole }, { onConflict: 'auth_user_id' })

  // Always also insert into supplier_accounts (the working table)
  const { error: accErr } = await supabaseAdmin
    .from('supplier_accounts')
    .upsert({ auth_user_id: authUserId, supplier_id: inviteSupplierId }, { onConflict: 'auth_user_id' })

  if (accErr) {
    return NextResponse.json({ error: 'Failed to create supplier account: ' + accErr.message }, { status: 500 })
  }

  // Mark invite as accepted
  if (dbInviteId) {
    await supabaseAdmin
      .from('supplier_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', dbInviteId)
  } else {
    // Log acceptance in events table to prevent replay
    await supabaseAdmin.from('events').insert({
      event_type: 'supplier_invite_accepted',
      entity_type: 'supplier',
      entity_id: String(inviteSupplierId),
      payload: { nonce: inviteNonce, email: inviteEmail, role: inviteRole },
      source: 'supplier_invite_api',
    })
  }

  return NextResponse.json({ success: true, email: inviteEmail })
}

// Internal: create a HMAC-signed invite token (called by admin route or directly)
export function createInviteToken(supplier_id: number, email: string, role: string): string {
  const nonce = randomBytes(16).toString('hex')
  const expires_at = new Date(Date.now() + INVITE_TTL_DAYS * 86400 * 1000).toISOString()
  return signToken({ supplier_id, email, role, nonce, expires_at })
}
