import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, randomBytes } from 'crypto'
import { getEffectiveAdminSecret } from '@/lib/admin-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function requireAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get('admin-auth')?.value
  const secret = getEffectiveAdminSecret()
  return !!secret && !!cookie && cookie === secret
}

const INVITE_SECRET =
  process.env.SUPPLIER_INVITE_SECRET ??
  process.env.CREDENTIAL_SECRET ??
  'dentago-invite-secret-change-in-prod'

const INVITE_TTL_DAYS = 7

function createHMACToken(supplier_id: number, email: string, role: string): string {
  const nonce = randomBytes(16).toString('hex')
  const expires_at = new Date(Date.now() + INVITE_TTL_DAYS * 86400 * 1000).toISOString()
  const payload = { supplier_id, email, role, nonce, expires_at }
  const json = JSON.stringify(payload)
  const b64 = Buffer.from(json).toString('base64url')
  const sig = createHmac('sha256', INVITE_SECRET).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

// POST /api/admin/supplier-invite
// Body: { supplier_id: number, email: string, role?: string }
// Returns: { token, invite_url }
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { supplier_id, email, role = 'manager' } = await request.json()
  if (!supplier_id || !email) {
    return NextResponse.json({ error: 'supplier_id and email are required' }, { status: 400 })
  }

  // Verify supplier exists
  const { data: supplier } = await supabaseAdmin
    .from('dentago_suppliers')
    .select('id, name')
    .eq('id', supplier_id)
    .single()

  if (!supplier) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dentago.co.uk'

  // Try supplier_invites table first
  const { data: invite, error: tableError } = await supabaseAdmin
    .from('supplier_invites')
    .insert({ supplier_id, email, role })
    .select('token')
    .maybeSingle()

  if (!tableError && invite) {
    const invite_url = `${baseUrl}/supplier/invite?token=${invite.token}`
    return NextResponse.json({
      token: invite.token,
      invite_url,
      supplier_name: supplier.name,
      email,
      role,
      method: 'db',
    })
  }

  // Table doesn't exist — use HMAC-signed stateless token
  const token = createHMACToken(supplier_id, email, role)
  const invite_url = `${baseUrl}/supplier/invite?token=${token}`

  // Log the invite creation to events table for auditing
  await supabaseAdmin.from('events').insert({
    event_type: 'supplier_invite_created',
    entity_type: 'supplier',
    entity_id: String(supplier_id),
    payload: { email, role, supplier_name: supplier.name, expires_in_days: INVITE_TTL_DAYS },
    source: 'admin_supplier_invite',
  })

  return NextResponse.json({
    token,
    invite_url,
    supplier_name: supplier.name,
    email,
    role,
    method: 'hmac',
  })
}

// GET /api/admin/supplier-invite — list all pending invites
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Try supplier_invites table first
  const { data: dbInvites, error } = await supabaseAdmin
    .from('supplier_invites')
    .select('id, email, role, accepted_at, expires_at, created_at, supplier_id, dentago_suppliers(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!error) {
    return NextResponse.json({ invites: dbInvites ?? [], method: 'db' })
  }

  // Fall back to events table
  const { data: events } = await supabaseAdmin
    .from('events')
    .select('id, entity_id, payload, created_at')
    .eq('event_type', 'supplier_invite_created')
    .order('created_at', { ascending: false })
    .limit(50)

  const invites = (events ?? []).map(e => ({
    id: e.id,
    supplier_id: e.entity_id,
    email: (e.payload as any)?.email,
    role: (e.payload as any)?.role,
    supplier_name: (e.payload as any)?.supplier_name,
    created_at: e.created_at,
    accepted_at: null,
    expires_at: null,
  }))

  return NextResponse.json({ invites, method: 'hmac_events' })
}
