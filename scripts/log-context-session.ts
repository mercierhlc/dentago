/**
 * Write to OS context_log + events using service role (same as POST /api/os/log-context).
 * Use when production /api/os/log-context is unreachable without os-auth cookie.
 *
 * Usage: npx tsx scripts/log-context-session.ts
 */
import * as fs from "fs";
import * as path from "path";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv(path.resolve(__dirname, "..", ".env.local"));

async function main() {
  const { supabaseAdmin } = await import("../lib/supabase");

  const summary =
    "Supplier Ops in internal dashboards: shared SupplierOpsConsole (admin + OS); new /os tab Supplier Ops; requireAdminOrOsAuth on all supplier-ops APIs + force-sync so OS-only sessions work; admin page thin wrapper.";

  const { data, error } = await supabaseAdmin
    .from("context_log")
    .insert({
      summary,
      decisions_made: [
        {
          decision: "Dual auth for supplier-ops and force-sync",
          rationale: "OS cookie or admin secret; founders often only on /os.",
        },
        {
          decision: "Single SupplierOpsConsole component",
          rationale: "One UI for /admin/supplier-ops and /os tab.",
        },
      ],
      work_completed: [
        { task: "components/admin/SupplierOpsConsole.tsx", result: "variant admin | os" },
        { task: "lib/admin-auth", result: "requireAdminOrOsAuth, isOsDashboardSession" },
        { task: "app/os/page.tsx", result: "Supplier Ops tab + NavIcon" },
        { task: "API routes", result: "supplier-ops/* + force-sync use requireAdminOrOsAuth" },
      ],
      open_loops: [
        { task: "Production /os shows new tab", blocker: "deploy", next_action: "npm run ship:os or merge main" },
        { task: "supplier_reliability_snapshots", blocker: "no job", next_action: "schedule when ready" },
      ],
      goals_touched: [],
      outreach_count: 0,
      session_type: "conversation",
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabaseAdmin.from("events").insert({
    event_type: "loop_completed",
    payload: { summary: summary.slice(0, 500), open_loops_count: 2, note: "supplier_ops_os_embed" },
    source: "context_log",
  });

  await supabaseAdmin.from("events").insert({
    event_type: "supplier_ops_dashboard_embedded",
    entity_type: "platform",
    entity_id: "supplier-ops",
    payload: {
      os_tab: true,
      admin_route: "/admin/supplier-ops",
      auth: "requireAdminOrOsAuth",
    },
    source: "cursor_agent_session",
  });

  console.log("Logged context_log id:", data.id, "+ events (loop_completed, supplier_ops_dashboard_embedded)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
