/**
 * Agent Spawner — the core of the Dentago software factory.
 *
 * Takes a spec (task description) and runs Claude Code headlessly to implement
 * it. Multiple agents can run in parallel on separate tasks, each with full
 * access to the codebase. Results are logged to the OS events table.
 *
 * Inspired by Eric's software factory talk (Cursor → Claude edition):
 * "You scope the task, you send them off, and you let them go."
 *
 * Usage:
 *   npx tsx scripts/os-agent-spawner.ts --task "Add order_placed logging to the orders route"
 *   npx tsx scripts/os-agent-spawner.ts --spec specs/add-search-logging.md
 *   npx tsx scripts/os-agent-spawner.ts --list         # show queued specs
 *   npx tsx scripts/os-agent-spawner.ts --run-all      # run all specs in specs/
 *   npx tsx scripts/os-agent-spawner.ts --parallel 3   # run 3 specs in parallel
 *
 * One agent = one isolated task. For parallel: spawn multiple processes.
 *
 * SAFETY GUARDRAILS (baked in):
 *   - Agents run with --dangerously-skip-permissions in CI only (env DENTAGO_CI=1)
 *   - All agent outputs are logged to .agent-runs/ for review
 *   - Never auto-push — agents write code, you review and push
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

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

const REPO_ROOT = path.resolve(__dirname, "..");
const SPECS_DIR = path.join(REPO_ROOT, "specs");
const RUNS_DIR = path.join(REPO_ROOT, ".agent-runs");
const RUNS_LOG = path.join(RUNS_DIR, "runs.jsonl");

interface AgentRun {
  id: string;
  task: string;
  spec_file?: string;
  started_at: string;
  completed_at?: string;
  exit_code?: number;
  output_file: string;
  status: "running" | "completed" | "failed";
}

function ensureDirs() {
  fs.mkdirSync(SPECS_DIR, { recursive: true });
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

function logRun(run: AgentRun) {
  fs.appendFileSync(RUNS_LOG, JSON.stringify(run) + "\n");
}

function updateRun(id: string, updates: Partial<AgentRun>) {
  if (!fs.existsSync(RUNS_LOG)) return;
  const lines = fs.readFileSync(RUNS_LOG, "utf-8").split("\n").filter(Boolean);
  const updated = lines.map((l) => {
    const r = JSON.parse(l) as AgentRun;
    if (r.id === id) return JSON.stringify({ ...r, ...updates });
    return l;
  });
  fs.writeFileSync(RUNS_LOG, updated.join("\n") + "\n");
}

function buildPrompt(task: string, specFile?: string): string {
  const claudeMd = fs.existsSync(path.join(REPO_ROOT, "CLAUDE.md"))
    ? fs.readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf-8").slice(0, 3000)
    : "";

  let specContent = "";
  if (specFile && fs.existsSync(specFile)) {
    specContent = fs.readFileSync(specFile, "utf-8");
  }

  return `You are an autonomous agent working on the Dentago codebase (B2B dental procurement marketplace, Next.js 15 + Supabase).

CONTEXT FROM CLAUDE.md:
${claudeMd}

YOUR TASK:
${specContent || task}

GUARDRAILS:
- Never commit or push. Write code only.
- Never modify authentication, encryption, or payment flows without explicit instruction.
- Every meaningful action should be logged via logEvent() from lib/events.ts.
- Follow existing code patterns — read surrounding files before writing.
- Run tsc --noEmit after changes to check for type errors.
- If you get stuck or something is unclear, write a QUESTIONS.md file with your questions.

When done, write a brief summary of what you changed to .agent-runs/summary-${Date.now()}.md.`;
}

function runAgent(
  task: string,
  specFile?: string
): Promise<{ exitCode: number; outputFile: string }> {
  const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const outputFile = path.join(RUNS_DIR, `${id}.log`);

  const run: AgentRun = {
    id,
    task,
    spec_file: specFile,
    started_at: new Date().toISOString(),
    output_file: outputFile,
    status: "running",
  };
  logRun(run);

  const prompt = buildPrompt(task, specFile);

  console.log(`\n🚀 Spawning agent: ${id}`);
  console.log(`   Task: ${task.slice(0, 80)}${task.length > 80 ? "..." : ""}`);
  console.log(`   Output: ${outputFile}`);

  return new Promise((resolve) => {
    const args = ["--print", prompt];

    // In CI with explicit flag, allow auto-approve. Otherwise interactive.
    if (process.env.DENTAGO_CI === "1") {
      args.unshift("--dangerously-skip-permissions");
    }

    const child: ChildProcess = spawn("claude", args, {
      cwd: REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    const outputStream = fs.createWriteStream(outputFile);
    child.stdout?.pipe(outputStream);
    child.stderr?.pipe(outputStream);

    // Stream to console with agent prefix
    child.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) console.log(`  [${id.slice(0, 12)}] ${line}`);
      }
    });

    child.on("close", (code) => {
      const exitCode = code ?? 1;
      const status = exitCode === 0 ? "completed" : "failed";

      updateRun(id, {
        completed_at: new Date().toISOString(),
        exit_code: exitCode,
        status,
      });

      console.log(
        `\n${status === "completed" ? "✅" : "❌"} Agent ${id.slice(0, 12)} ${status} (exit ${exitCode})`
      );

      resolve({ exitCode, outputFile });
    });
  });
}

function listSpecs() {
  if (!fs.existsSync(SPECS_DIR)) {
    console.log("No specs/ directory yet. Create specs/*.md files to queue tasks.");
    return;
  }
  const specs = fs.readdirSync(SPECS_DIR).filter((f) => f.endsWith(".md"));
  if (specs.length === 0) {
    console.log("No spec files in specs/ yet.");
    return;
  }
  console.log(`\n📋 Queued specs (${specs.length}):\n`);
  for (const s of specs) {
    const content = fs.readFileSync(path.join(SPECS_DIR, s), "utf-8");
    const firstLine = content.split("\n")[0].replace(/^#+ /, "");
    console.log(`  ${s} — ${firstLine}`);
  }
}

function showRecentRuns() {
  if (!fs.existsSync(RUNS_LOG)) {
    console.log("No runs yet.");
    return;
  }
  const runs = fs
    .readFileSync(RUNS_LOG, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as AgentRun)
    .slice(-10);

  console.log(`\n📊 Recent agent runs:\n`);
  for (const r of runs.reverse()) {
    const icon = r.status === "completed" ? "✅" : r.status === "failed" ? "❌" : "🔄";
    const duration = r.completed_at
      ? `${Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
      : "running";
    console.log(`  ${icon} ${r.id.slice(0, 14)} — ${r.task.slice(0, 60)} (${duration})`);
  }
}

async function runAllSpecs(parallel: number = 1) {
  if (!fs.existsSync(SPECS_DIR)) {
    console.log("No specs/ directory.");
    return;
  }
  const specs = fs
    .readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(SPECS_DIR, f));

  if (specs.length === 0) {
    console.log("No specs to run.");
    return;
  }

  console.log(`\n🏭 Running ${specs.length} specs (${parallel} parallel)\n`);

  // Batch into parallel groups
  for (let i = 0; i < specs.length; i += parallel) {
    const batch = specs.slice(i, i + parallel);
    const promises = batch.map((specFile) => {
      const content = fs.readFileSync(specFile, "utf-8");
      const task = content.split("\n")[0].replace(/^#+ /, "");
      return runAgent(task, specFile);
    });
    await Promise.all(promises);
  }

  showRecentRuns();
}

async function main() {
  ensureDirs();

  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    listSpecs();
    showRecentRuns();
    return;
  }

  if (args.includes("--run-all")) {
    const parallelArg = args.find((a) => a.startsWith("--parallel="));
    const parallel = parallelArg ? parseInt(parallelArg.split("=")[1]) : 1;
    await runAllSpecs(parallel);
    return;
  }

  const taskIdx = args.indexOf("--task");
  const specIdx = args.indexOf("--spec");

  if (taskIdx !== -1 && args[taskIdx + 1]) {
    const task = args[taskIdx + 1];
    await runAgent(task);
    return;
  }

  if (specIdx !== -1 && args[specIdx + 1]) {
    const specFile = path.resolve(args[specIdx + 1]);
    const content = fs.readFileSync(specFile, "utf-8");
    const task = content.split("\n")[0].replace(/^#+ /, "");
    await runAgent(task, specFile);
    return;
  }

  console.log(`
Dentago Agent Spawner — Claude-powered software factory

Usage:
  npx tsx scripts/os-agent-spawner.ts --task "Add RLS to the events table"
  npx tsx scripts/os-agent-spawner.ts --spec specs/add-rls.md
  npx tsx scripts/os-agent-spawner.ts --run-all
  npx tsx scripts/os-agent-spawner.ts --run-all --parallel=3
  npx tsx scripts/os-agent-spawner.ts --list

Spec format (specs/*.md):
  # Task title

  Detailed description of what to implement.
  Include context, file paths, and acceptance criteria.

Agent output logs: .agent-runs/
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
