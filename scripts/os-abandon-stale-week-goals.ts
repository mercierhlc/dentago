/**
 * Abandon active goals whose titles reference [Week 1] or [Week 2] — superseded by May 2026 Week 3+ execution.
 * Does not touch Week 3+ numbered goals.
 *
 * Usage: npx tsx scripts/os-abandon-stale-week-goals.ts
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const WEEK_1_2 = /\[Week\s*([12])\]/i;

async function main() {
  let abandoned = 0;
  let offset = 0;
  const page = 500;

  while (true) {
    const { data, error } = await supabase
      .from("goals")
      .select("id, title")
      .eq("status", "active")
      .range(offset, offset + page - 1);

    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    if (!data?.length) break;

    for (const row of data) {
      const m = row.title.match(WEEK_1_2);
      if (!m) continue;
      const weekNum = parseInt(m[1], 10);
      if (weekNum !== 1 && weekNum !== 2) continue;

      const { error: up } = await supabase
        .from("goals")
        .update({
          status: "abandoned",
          agent_report:
            "Automated hygiene (May 2026): Week 1–2 numbered goal superseded by current OS priorities. Re-activate from Goals tab if still needed.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (!up) abandoned++;
    }

    if (data.length < page) break;
    offset += page;
  }

  console.log(`Abandoned ${abandoned} active goals matching [Week 1] or [Week 2].`);
}

main().catch(console.error);
