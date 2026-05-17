import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb
    .from('supplier_credentials')
    .select('username, encrypted_password, clinic_id, suppliers(name)');
  if (error) { console.error(error); return; }
  console.log(JSON.stringify(data, null, 2));
}
main().catch(console.error);
