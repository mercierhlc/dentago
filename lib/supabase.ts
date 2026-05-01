import { createClient } from "@supabase/supabase-js";

// Server-side client (service role — never expose to browser).
// This key bypasses Row Level Security; all tenant checks must still happen in route handlers
// when acting on behalf of a user. RLS protects direct PostgREST access with the anon key.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Browser-safe client (anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
