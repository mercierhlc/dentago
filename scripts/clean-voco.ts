import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);
async function main() {
  const { data, error } = await sb.from("dentago_supplier_products")
    .delete()
    .ilike("sku", "VOCO-%")
    .select();
  console.log("Deleted VOCO- rows:", data?.length, error);
}
main().catch(console.error);
