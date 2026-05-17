import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function main() {
  const { data } = await s.from('agent_tasks').select('status');
  const counts: Record<string, number> = {};
  data?.forEach((r: { status: string }) => counts[r.status] = (counts[r.status] || 0) + 1);
  console.log(counts);
}

main();
