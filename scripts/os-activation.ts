/**
 * Activation Tracker — measures real activation rates against KPI targets.
 *
 * For every approved clinic, checks:
 *   Step 1: Supplier connected?        (events: supplier_connected)
 *   Step 2: Product searched/viewed?   (events: search_performed, product_viewed)
 *   Step 3: Order placed?              (events: order_placed)
 *
 * Logs a KPI snapshot + writes a full report to Obsidian.
 *
 * Run:
 *   npx tsx scripts/os-activation.ts
 */

import * as path from "path";
import * as fs from "fs";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OBSIDIAN_KEY = process.env.OBSIDIAN_API_KEY;

async function db(table: string, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return res.json();
}

async function dbInsert(table: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  console.log("\n📊 Activation Tracker\n");

  const [clinics, events] = await Promise.all([
    db("clinic_profiles", "?select=id,practice_name,status,created_at&eq.status=approved&eq.is_deactivated=false"),
    db("events", "?select=event_type,entity_id,created_at&order=created_at.desc&limit=1000"),
  ]);

  const approved = Array.isArray(clinics) ? clinics as any[] : [];
  const evList = Array.isArray(events) ? events as any[] : [];

  const connectedIds = new Set(evList.filter((e: any) => e.event_type === "supplier_connected").map((e: any) => e.entity_id));
  const searchedIds = new Set(evList.filter((e: any) => ["search_performed", "product_viewed"].includes(e.event_type)).map((e: any) => e.entity_id));
  const orderedIds = new Set(evList.filter((e: any) => e.event_type === "order_placed").map((e: any) => e.entity_id));

  const report = approved.map((c: any) => {
    const s1 = connectedIds.has(c.id);
    const s2 = searchedIds.has(c.id);
    const s3 = orderedIds.has(c.id);
    const ageD = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
    return { id: c.id, name: c.practice_name, age_days: parseFloat(ageD.toFixed(1)), step1_supplier: s1, step2_search: s2, step3_order: s3, fully_activated: s1 && s2 && s3 };
  });

  const step1Rate = approved.length ? (report.filter(r => r.step1_supplier).length / approved.length * 100) : 0;
  const step2Rate = approved.length ? (report.filter(r => r.step2_search).length / approved.length * 100) : 0;
  const step3Rate = approved.length ? (report.filter(r => r.step3_order).length / approved.length * 100) : 0;
  const fullRate = approved.length ? (report.filter(r => r.fully_activated).length / approved.length * 100) : 0;

  console.log(`Approved clinics: ${approved.length}`);
  console.log(`Step 1 — Supplier connected: ${report.filter(r => r.step1_supplier).length} (${step1Rate.toFixed(0)}%) | Target: 70%`);
  console.log(`Step 2 — First search:       ${report.filter(r => r.step2_search).length} (${step2Rate.toFixed(0)}%) | Target: >60%`);
  console.log(`Step 3 — First order:        ${report.filter(r => r.step3_order).length} (${step3Rate.toFixed(0)}%) | Target: >60%`);
  console.log(`Fully activated:             ${report.filter(r => r.fully_activated).length} (${fullRate.toFixed(0)}%) | Target: 60%`);

  console.log("\nPer-clinic breakdown:");
  for (const r of report) {
    const s1 = r.step1_supplier ? "✅" : "❌";
    const s2 = r.step2_search ? "✅" : "❌";
    const s3 = r.step3_order ? "✅" : "❌";
    console.log(`  ${r.name.padEnd(35)} ${s1} supplier  ${s2} search  ${s3} order  (${r.age_days}d old)`);
  }

  // Save KPI snapshot
  await dbInsert("kpi_snapshots", {
    snapshot_date: new Date().toISOString().slice(0, 10),
    kpis: {
      approved_clinics: approved.length,
      step1_supplier_rate: parseFloat(step1Rate.toFixed(1)),
      step2_search_rate: parseFloat(step2Rate.toFixed(1)),
      step3_order_rate: parseFloat(step3Rate.toFixed(1)),
      full_activation_rate: parseFloat(fullRate.toFixed(1)),
    },
  });

  // Write to Obsidian
  if (OBSIDIAN_KEY) {
    const content = `# Activation Report — ${new Date().toISOString().slice(0, 10)}

## Funnel (${approved.length} approved clinics)

| Step | Count | Rate | Target |
|---|---|---|---|
| Supplier connected | ${report.filter(r => r.step1_supplier).length} | ${step1Rate.toFixed(0)}% | >70% |
| First search/browse | ${report.filter(r => r.step2_search).length} | ${step2Rate.toFixed(0)}% | >60% |
| First order placed | ${report.filter(r => r.step3_order).length} | ${step3Rate.toFixed(0)}% | >60% |
| **Fully activated** | **${report.filter(r => r.fully_activated).length}** | **${fullRate.toFixed(0)}%** | **>60%** |

## Per-Clinic Status

| Clinic | Age (days) | Supplier | Search | Order | Activated |
|---|---|---|---|---|---|
${report.map(r => `| ${r.name} | ${r.age_days} | ${r.step1_supplier ? "✅" : "❌"} | ${r.step2_search ? "✅" : "❌"} | ${r.step3_order ? "✅" : "❌"} | ${r.fully_activated ? "✅" : "❌"} |`).join("\n")}

## Biggest Drop-off
${step1Rate < step2Rate && step1Rate < step3Rate ? "→ Supplier connection is the bottleneck. Focus on the /clinic/suppliers onboarding flow." : ""}
${step2Rate < step1Rate && step2Rate < step3Rate ? "→ Search engagement is the bottleneck. Clinics are connecting but not browsing." : ""}
${step3Rate < step1Rate && step3Rate < step2Rate ? "→ Order conversion is the bottleneck. Clinics search but don't buy." : ""}

_Generated by os-activation.ts_
`;
    await fetch(`http://localhost:27123/vault/${encodeURIComponent(`Dentago/Intelligence/Activation Report — ${new Date().toISOString().slice(0, 10)}.md`)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${OBSIDIAN_KEY}`, "Content-Type": "text/markdown" },
      body: content,
    }).catch(() => {});
    console.log("\n✅ Written to Obsidian");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
