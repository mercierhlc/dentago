/**
 * Dentago Software Factory — continuous multi-agent loop.
 *
 * Watches specs/ for new .md files and immediately spawns a Claude agent
 * to implement them. Multiple agents run in parallel. Completed specs are
 * moved to specs/done/. Failed specs move to specs/failed/.
 *
 * This is the "always-on factory floor" — you drop a spec, it gets built.
 *
 * Run:
 *   npx tsx scripts/os-factory.ts              # 2 parallel agents (default)
 *   npx tsx scripts/os-factory.ts --workers 4  # 4 parallel agents
 *   npx tsx scripts/os-factory.ts --once       # process current queue then exit
 *
 * How to feed the factory:
 *   1. Write specs/my-task.md  (title on line 1, details below)
 *   2. Factory picks it up automatically (within 5s)
 *   3. Claude implements it, output logged to .agent-runs/
 *   4. Spec moves to specs/done/ or specs/failed/
 *   5. You review .agent-runs/<id>.log — merge if good
 *
 * GUARDRAILS:
 *   - Agents never push to git
 *   - Agents never touch auth/payments without explicit spec instruction
 *   - All outputs logged for your review before anything ships
 */

import { spawn } from "child_process";
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
const DONE_DIR = path.join(SPECS_DIR, "done");
const FAILED_DIR = path.join(SPECS_DIR, "failed");
const RUNS_DIR = path.join(REPO_ROOT, ".agent-runs");

const args = process.argv.slice(2);
const MAX_WORKERS = parseInt(args.find(a => a.startsWith("--workers="))?.split("=")[1] ?? "2");
const ONCE = args.includes("--once");
const POLL_MS = 5000;

let activeWorkers = 0;
const processing = new Set<string>();

function ensureDirs() {
  [SPECS_DIR, DONE_DIR, FAILED_DIR, RUNS_DIR].forEach(d =>
    fs.mkdirSync(d, { recursive: true })
  );
}

function getPendingSpecs(): string[] {
  return fs
    .readdirSync(SPECS_DIR)
    .filter(f => f.endsWith(".md") && !processing.has(f))
    .map(f => path.join(SPECS_DIR, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs); // oldest first
}

function buildPrompt(specFile: string): string {
  const spec = fs.readFileSync(specFile, "utf-8");
  const claudeMd = fs.existsSync(path.join(REPO_ROOT, "CLAUDE.md"))
    ? fs.readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf-8").slice(0, 4000)
    : "";

  return `You are an autonomous software agent working on the Dentago codebase.

Dentago is a B2B dental procurement marketplace (Next.js 15, Supabase, Tailwind, shadcn/ui).
Primary purple: #6C3DE8. Every meaningful action must use logEvent() from lib/events.ts.

CODEBASE RULES (from CLAUDE.md):
${claudeMd}

YOUR SPEC:
${spec}

HARD RULES:
1. Never commit, push, or run git commands.
2. Never touch app/api/auth/, lib/supabase.ts, or any payment/encryption code unless the spec explicitly says to.
3. Run \`npx tsc --noEmit\` after your changes. If it fails, fix the errors before stopping.
4. Read surrounding files before writing new code — follow existing patterns exactly.
5. Log any meaningful new action via logEvent() from lib/events.ts.
6. When done, write a brief summary to .agent-runs/summary-${Date.now()}.md including: what you changed, what files you touched, any open questions.

Begin.`;
}

async function runAgent(specFile: string): Promise<"completed" | "failed"> {
  const specName = path.basename(specFile);
  const id = `${Date.now()}-${specName.replace(/[^a-z0-9]/gi, "-").slice(0, 20)}`;
  const logFile = path.join(RUNS_DIR, `${id}.log`);

  console.log(`\n🤖 [${new Date().toLocaleTimeString()}] Starting agent for: ${specName}`);
  console.log(`   Log: ${logFile}`);

  const prompt = buildPrompt(specFile);
  const out = fs.createWriteStream(logFile);

  return new Promise((resolve) => {
    const child = spawn("claude", ["--print", prompt], {
      cwd: REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    child.stdout?.pipe(out);
    child.stderr?.pipe(out);

    // Show first few lines of output
    let lineCount = 0;
    child.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(l => l.trim());
      for (const line of lines) {
        lineCount++;
        if (lineCount <= 3) {
          console.log(`   [${id.slice(0, 10)}] ${line.slice(0, 100)}`);
        }
      }
    });

    child.on("close", (code) => {
      out.end();
      if (code === 0) {
        fs.renameSync(specFile, path.join(DONE_DIR, specName));
        console.log(`✅ [${new Date().toLocaleTimeString()}] Done: ${specName}`);
        resolve("completed");
      } else {
        fs.renameSync(specFile, path.join(FAILED_DIR, specName));
        console.log(`❌ [${new Date().toLocaleTimeString()}] Failed (exit ${code}): ${specName}`);
        console.log(`   Review: ${logFile}`);
        resolve("failed");
      }
    });

    child.on("error", (err) => {
      out.end();
      console.error(`❌ Spawn error for ${specName}:`, err.message);
      console.error(`   Is 'claude' CLI installed? Run: npm install -g @anthropic-ai/claude-code`);
      fs.renameSync(specFile, path.join(FAILED_DIR, specName));
      resolve("failed");
    });
  });
}

async function tick() {
  if (activeWorkers >= MAX_WORKERS) return;

  const pending = getPendingSpecs();
  const available = pending.slice(0, MAX_WORKERS - activeWorkers);

  for (const specFile of available) {
    const specName = path.basename(specFile);
    processing.add(specName);
    activeWorkers++;

    runAgent(specFile).then(() => {
      activeWorkers--;
      processing.delete(specName);
    });
  }
}

function printStatus() {
  const pending = getPendingSpecs();
  const done = fs.readdirSync(DONE_DIR).filter(f => f.endsWith(".md")).length;
  const failed = fs.readdirSync(FAILED_DIR).filter(f => f.endsWith(".md")).length;

  console.log(`\n📊 Factory status — ${new Date().toLocaleTimeString()}`);
  console.log(`   Workers: ${activeWorkers}/${MAX_WORKERS} active`);
  console.log(`   Queue: ${pending.length} pending | ${done} done | ${failed} failed`);

  if (pending.length > 0) {
    console.log(`   Next up: ${pending.map(f => path.basename(f)).join(", ")}`);
  }
}

async function main() {
  ensureDirs();

  console.log(`\n🏭 Dentago Software Factory`);
  console.log(`   Workers: ${MAX_WORKERS} parallel agents`);
  console.log(`   Watching: ${SPECS_DIR}`);
  console.log(`   Drop a spec → agent builds it automatically\n`);

  if (ONCE) {
    const pending = getPendingSpecs();
    if (pending.length === 0) {
      console.log("No specs to process.");
      return;
    }
    console.log(`Processing ${pending.length} specs (${MAX_WORKERS} parallel)...`);
    const batches: string[][] = [];
    for (let i = 0; i < pending.length; i += MAX_WORKERS) {
      batches.push(pending.slice(i, i + MAX_WORKERS));
    }
    for (const batch of batches) {
      const specNames = batch.map(f => path.basename(f));
      specNames.forEach(n => processing.add(n));
      await Promise.all(batch.map(f => runAgent(f)));
      specNames.forEach(n => processing.delete(n));
    }
    printStatus();
    return;
  }

  // Continuous mode — poll for new specs every 5s
  printStatus();
  await tick();

  setInterval(async () => {
    await tick();
  }, POLL_MS);

  // Status every 60s
  setInterval(printStatus, 60_000);

  // Keep process alive
  process.stdin.resume();

  process.on("SIGINT", () => {
    console.log(`\n\n🛑 Factory shutting down. ${activeWorkers} agents still running — they'll finish.`);
    setTimeout(() => process.exit(0), 2000);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
