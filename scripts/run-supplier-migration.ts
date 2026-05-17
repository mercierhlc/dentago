/**
 * Run supplier portal migration.
 * Usage: npx tsx scripts/run-supplier-migration.ts
 *
 * Requires SUPABASE_DB_URL in .env.local (postgres://postgres.xxx:password@...)
 * or manually run supabase/migrations/20260504_supplier_portal.sql in SQL Editor.
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Checking supplier tables...')

  const { error: e1 } = await supabase.from('supplier_users').select('id').limit(1)
  if (!e1) { console.log('✓ supplier_users already exists'); return }

  console.log('supplier_users missing — please run supabase/migrations/20260504_supplier_portal.sql in the Supabase SQL Editor')
  console.log('URL: https://supabase.com/dashboard/project/wybqjycfpauwlcrqgtfb/sql/new')
  process.exit(1)
}

main()
