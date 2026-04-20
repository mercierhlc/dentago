import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  'https://wybqjycfpauwlcrqgtfb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI'
)

export async function POST(request: Request) {
  const { userId, deactivate } = await request.json()

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: deactivate ? '876000h' : 'none',
  })

  await supabase
    .from('clinic_profiles')
    .update({ is_deactivated: deactivate })
    .eq('id', userId)

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
