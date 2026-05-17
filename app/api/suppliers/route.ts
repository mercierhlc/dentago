import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { MARKETPLACE_SUPPLIER_SET } from "@/lib/marketplace-suppliers";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("dentago_suppliers")
    .select("id, name")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const suppliers = (data ?? []).filter((s: { name: string }) => MARKETPLACE_SUPPLIER_SET.has(s.name));
  return NextResponse.json({ suppliers });
}
