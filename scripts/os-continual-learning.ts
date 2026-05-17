/**
 * Continual Learning — extracts rules and memories from Claude conversation
 * transcripts and stores them in CLAUDE.md and Obsidian.
 *
 * Inspired by Eric's talk at Cursor: https://cursor.com/blog/software-factory
 * "Instead of me every time going in and asking the agent to do this, I can
 *  create a rule. But I'm kind of lazy so I don't really remember to create a
 *  rule. So instead we can have this continual learning plugin that looks
 *  through the transcripts and stores this as a rule for you instead."
 *
 * Run:
 *   npx tsx scripts/os-continual-learning.ts
 *   npx tsx scripts/os-continual-learning.ts --dry-run   # preview only
 *   npx tsx scripts/os-continual-learning.ts --limit 5   # last N sessions
 */

import Anthropic from "@anthropic-ai/sdk";
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

const TRANSCRIPTS_DIR = path.join(
  process.env.HOME ?? "",
  ".claude",
  "projects",
  "-Users-mercier"
);
const CLAUDE_MD = path.resolve(__dirname, "..", "CLAUDE.md");
const LEARNINGS_FILE = path.resolve(__dirname, "..", ".learnings.json");
const MAX_CHARS_PER_SESSION = 20000; // cap to avoid huge context

interface Learning {
  type: "rule" | "pattern" | "correction" | "preference";
  content: string;
  source_session: string;
  extracted_at: string;
}

interface LearningsStore {
  last_processed: Record<string, string>; // sessionId → last timestamp seen
  learnings: Learning[];
}

function loadStore(): LearningsStore {
  if (!fs.existsSync(LEARNINGS_FILE)) {
    return { last_processed: {}, learnings: [] };
  }
  return JSON.parse(fs.readFileSync(LEARNINGS_FILE, "utf-8")) as LearningsStore;
}

function saveStore(store: LearningsStore) {
  fs.writeFileSync(LEARNINGS_FILE, JSON.stringify(store, null, 2));
}

interface TranscriptMessage {
  type: string;
  message?: { role: string; content: string | { type: string; text?: string }[] };
  timestamp?: string;
  sessionId?: string;
}

function extractText(content: string | { type: string; text?: string }[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("\n");
}

function readTranscript(filePath: string): { messages: string[]; lastTs: string } {
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  const messages: string[] = [];
  let lastTs = "";

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as TranscriptMessage;
      if (entry.timestamp) lastTs = entry.timestamp;
      if (
        entry.type === "user" ||
        entry.type === "assistant"
      ) {
        const role = entry.message?.role ?? entry.type;
        const content = entry.message?.content ?? "";
        const text = extractText(content as string | { type: string; text?: string }[]).trim();
        if (text && text.length > 10) {
          messages.push(`[${role.toUpperCase()}]: ${text.slice(0, 500)}`);
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return { messages, lastTs };
}

function getRecentSessions(limit: number): string[] {
  const files = fs
    .readdirSync(TRANSCRIPTS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({
      file: path.join(TRANSCRIPTS_DIR, f),
      mtime: fs.statSync(path.join(TRANSCRIPTS_DIR, f)).mtimeMs,
      id: f.replace(".jsonl", ""),
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  return files.map((f) => f.file);
}

async function extractLearnings(
  transcript: string,
  sessionId: string,
  client: Anthropic
): Promise<Learning[]> {
  const systemPrompt = `You are extracting rules and learnings from an AI coding assistant conversation transcript for Dentago — a B2B dental procurement marketplace built in Next.js 15 with Supabase.

Your job: identify anything the human corrected, preferred, or explicitly asked the AI to do differently. Extract ONLY high-signal learnings that should inform future AI sessions.

Return a JSON array of learnings. Each learning has:
- type: "rule" (hard constraint), "pattern" (preferred approach), "correction" (the AI did X, human wanted Y), or "preference" (style/opinion)
- content: The rule/pattern in one clear sentence. Lead with the instruction, e.g. "Always use logEvent() when..." or "Never select the website column from dentago_suppliers..."

Only include learnings that are:
1. Specific and actionable (not generic advice)
2. Relevant to this codebase or working style
3. Would actually change AI behaviour in a future session

Return [] if nothing meaningful was learned. Return only valid JSON, no prose.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract learnings from this conversation transcript:\n\n${transcript}\n\nReturn a JSON array of learnings.`,
      },
    ],
    system: systemPrompt,
  });

  const text =
    response.content.find((b) => b.type === "text")?.text?.trim() ?? "[]";

  try {
    // Extract JSON from response (sometimes Claude wraps it in ```json)
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { type: string; content: string }[];
    return parsed
      .filter((l) => l.type && l.content)
      .map((l) => ({
        type: l.type as Learning["type"],
        content: l.content,
        source_session: sessionId,
        extracted_at: new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function appendToClaudeMd(newLearnings: Learning[]) {
  if (newLearnings.length === 0) return;

  const rules = newLearnings.filter((l) => l.type === "rule" || l.type === "correction");
  const patterns = newLearnings.filter((l) => l.type === "pattern" || l.type === "preference");

  let section = "\n\n## Continual Learning — Auto-Extracted Rules\n";
  section += `_Last updated: ${new Date().toISOString().slice(0, 10)}_\n\n`;

  if (rules.length > 0) {
    section += "### Hard Rules\n";
    for (const r of rules) section += `- ${r.content}\n`;
  }
  if (patterns.length > 0) {
    section += "\n### Patterns & Preferences\n";
    for (const p of patterns) section += `- ${p.content}\n`;
  }

  const existing = fs.readFileSync(CLAUDE_MD, "utf-8");

  // Replace existing continual learning section or append
  if (existing.includes("## Continual Learning — Auto-Extracted Rules")) {
    const updated = existing.replace(
      /\n\n## Continual Learning — Auto-Extracted Rules[\s\S]*$/,
      section
    );
    fs.writeFileSync(CLAUDE_MD, updated);
  } else {
    fs.appendFileSync(CLAUDE_MD, section);
  }
}

async function writeToObsidian(learnings: Learning[]) {
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiKey || learnings.length === 0) return;

  const content = `# Continual Learning — ${new Date().toISOString().slice(0, 10)}

Extracted from ${new Set(learnings.map((l) => l.source_session)).size} Claude sessions.

## Rules (${learnings.filter((l) => l.type === "rule" || l.type === "correction").length})
${learnings
    .filter((l) => l.type === "rule" || l.type === "correction")
    .map((l) => `- **[${l.type}]** ${l.content}`)
    .join("\n")}

## Patterns & Preferences (${learnings.filter((l) => l.type === "pattern" || l.type === "preference").length})
${learnings
    .filter((l) => l.type === "pattern" || l.type === "preference")
    .map((l) => `- ${l.content}`)
    .join("\n")}
`;

  const url = `http://localhost:27123/vault/Dentago%2FIntelligence%2FContinual%20Learning%20--%20${new Date().toISOString().slice(0, 10)}.md`;

  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "text/markdown",
    },
    body: content,
  }).catch(() => {
    // Obsidian not running — skip
  });
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : 10;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY missing");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const store = loadStore();
  const sessions = getRecentSessions(limit);

  console.log(`\n🧠 Continual Learning — scanning ${sessions.length} recent sessions\n`);

  const allNewLearnings: Learning[] = [];

  for (const sessionFile of sessions) {
    const sessionId = path.basename(sessionFile, ".jsonl");
    const { messages, lastTs } = readTranscript(sessionFile);

    if (messages.length < 3) continue; // too short to learn from

    const alreadyProcessed = store.last_processed[sessionId];
    if (alreadyProcessed && alreadyProcessed >= lastTs) {
      console.log(`  ⏭  ${sessionId.slice(0, 8)} — already processed`);
      continue;
    }

    const transcript = messages
      .join("\n\n")
      .slice(0, MAX_CHARS_PER_SESSION);

    console.log(`  🔍 ${sessionId.slice(0, 8)} — ${messages.length} messages`);

    const learnings = await extractLearnings(transcript, sessionId, client);

    if (learnings.length > 0) {
      console.log(`     → ${learnings.length} learnings:`);
      for (const l of learnings) {
        console.log(`       [${l.type}] ${l.content}`);
      }
      allNewLearnings.push(...learnings);
    } else {
      console.log(`     → nothing new`);
    }

    store.last_processed[sessionId] = lastTs || new Date().toISOString();
  }

  console.log(`\n📊 Total new learnings: ${allNewLearnings.length}`);

  if (allNewLearnings.length === 0) {
    console.log("Nothing to store.");
    return;
  }

  // Deduplicate against existing learnings (rough content match)
  const existingContents = new Set(store.learnings.map((l) => l.content.toLowerCase().trim()));
  const deduped = allNewLearnings.filter(
    (l) => !existingContents.has(l.content.toLowerCase().trim())
  );

  console.log(`   After dedup: ${deduped.length} new`);

  if (dry) {
    console.log("\nDRY RUN — would store:");
    for (const l of deduped) console.log(`  [${l.type}] ${l.content}`);
    return;
  }

  // Store
  store.learnings.push(...deduped);
  saveStore(store);

  // Append rules to CLAUDE.md
  appendToClaudeMd(store.learnings);
  console.log(`\n✅ CLAUDE.md updated`);

  // Write to Obsidian
  await writeToObsidian(store.learnings);
  console.log(`✅ Obsidian updated (if running)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
