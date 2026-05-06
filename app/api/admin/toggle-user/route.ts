import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, getAdminIdentifier } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { userId, deactivate } = await request.json()

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: deactivate ? '876000h' : 'none',
  })

  await supabaseAdmin
    .from('clinic_profiles')
    .update({ is_deactivated: deactivate })
    .eq('id', userId)

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // Audit log for deactivation/reactivation actions
  const adminId = getAdminIdentifier(request);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  await supabaseAdmin.from('verification_audit').insert({
    admin_user_id: adminId,
    clinic_id: userId,
    action: deactivate ? 'deactivated' : 'reactivated',
    ip_address: ip,
  });

  return NextResponse.json({ success: true })
}
