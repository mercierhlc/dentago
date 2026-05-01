import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);
async function main() {
  const { data, error } = await sb.from("dentago_suppliers").select("id,name").order("id");
  if (error) { console.error(error); return; }
  for (const r of data ?? []) {
    console.log(`${r.id}: ${r.name} — ${r.url}`);
  }
}
main().catch(console.error);
