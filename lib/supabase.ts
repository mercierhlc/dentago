import { createClient } from "@supabase/supabase-js";

// Browser-safe client (anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side client (service role — never expose to browser).
// Lazy so the module can be bundled without crashing when SUPABASE_SERVICE_ROLE_KEY
// is not present on the client. Calling this on the client will throw at runtime.
let _admin: ReturnType<typeof createClient> | null = null;
export function getSupabaseAdmin() {
  if (!_admin) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — supabaseAdmin is server-only");
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  }
  return _admin;
}

// Backwards-compat alias — prefer getSupabaseAdmin() in new code
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_t, prop) {
    return getSupabaseAdmin()[prop as keyof ReturnType<typeof createClient>];
  },
});
