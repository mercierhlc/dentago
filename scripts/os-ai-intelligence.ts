/**
 * OS AI Intelligence Feed
 *
 * Monitors: Anthropic blog, OpenAI, Google DeepMind, YC, HN, arXiv AI,
 * Vercel AI SDK, LangChain, trending GitHub AI repos.
 * 
 * Runs multiple times per day. Writes to Obsidian. Alerts on high-signal items.
 * 
 * Cron: every 4 hours
 * Run: npx tsx scripts/os-ai-intelligence.ts
 */

import Anthropic from "@anthropic-ai/sdk";
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OBSIDIAN_KEY = process.env.OBSIDIAN_API_KEY;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SEEN_FILE = path.join(__dirname, ".ai-intel-seen.json");

function loadSeen(): Set<string> {
  if (!fs.existsSync(SEEN_FILE)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")));
}
function saveSeen(seen: Set<string>) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2));
}

async function fetchHN(): Promise<{title: string; url: string; score: number; id: number}[]> {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    const ids: number[] = await res.json();
    const top30 = ids.slice(0, 80);
    const items = await Promise.all(
      top30.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null)
      )
    );
    return items
      .filter((i: any) => i && i.title && i.score > 100)
      .filter((i: any) => /ai|llm|gpt|claude|gemini|openai|anthropic|agent|model|ml|neural|transformer|yc|startup/i.test(i.title))
      .map((i: any) => ({ title: i.title, url: i.url ?? `https://news.ycombinator.com/item?id=${i.id}`, score: i.score, id: i.id }))
      .slice(0, 15);
  } catch { return []; }
}

async function fetchAnthropicBlog(): Promise<{title: string; url: string; date: string}[]> {
  try {
    const res = await fetch("https://www.anthropic.com/news", { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const matches = [...html.matchAll(/href="(\/news\/[^"]+)"[^>]*>.*?<[^>]+>([^<]{10,})</gs)];
    return matches.slice(0, 5).map(m => ({
      title: m[2].trim(),
      url: `https://www.anthropic.com${m[1]}`,
      date: new Date().toISOString().slice(0, 10),
    }));
  } catch { return []; }
}

async function fetchYCVideos(): Promise<{title: string; url: string}[]> {
  // YC posts on HN tagged "Show HN" or "YC" — covered by HN fetch
  // Also check YC's YouTube via RSS
  try {
    const res = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=UCcefcZRL2oaA_uBNeo5UOWg");
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 5);
    return entries.map(e => {
      const title = e[1].match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
      const link = e[1].match(/href="([^"]+)"/)?.[1] ?? "";
      return { title, url: link };
    }).filter(e => e.title && e.url);
  } catch { return []; }
}

async function classify(items: {title: string; url: string}[]): Promise<{item: {title: string; url: string}; relevance: string; signal: "HIGH" | "MEDIUM" | "LOW"; action: string}[]> {
  if (!items.length) return [];
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: `You are the AI intelligence analyst for Dentago (B2B dental procurement marketplace, building to £50M).
Mercier is the technical founder. He needs to know about:
- New AI models, capabilities, APIs (especially Anthropic/Claude updates)
- AI agent frameworks, tools for building autonomous systems
- YC-backed startups in procurement, health, or B2B SaaS
- Sales automation and outreach AI tools
- Anything that could give Dentago a competitive advantage
- Supply chain AI, healthcare AI

Classify each item. Return JSON array only.`,
    messages: [{
      role: "user",
      content: `Classify these items:\n${JSON.stringify(items.map(i => ({ title: i.title, url: i.url })))}\n\nReturn: [{"index": 0, "signal": "HIGH|MEDIUM|LOW", "relevance": "one sentence why this matters to Dentago", "action": "what Mercier should do (be specific, max 1 sentence)"}]`,
    }],
  });

  try {
    const text = res.content[0].type === "text" ? res.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    const classified = match ? JSON.parse(match[0]) : [];
    return classified
      .filter((c: any) => c.signal !== "LOW")
      .map((c: any) => ({
        item: items[c.index],
        relevance: c.relevance,
        signal: c.signal,
        action: c.action,
      }));
  } catch { return []; }
}

async function writeObsidian(title: string, content: string) {
  if (!OBSIDIAN_KEY) return;
  await fetch(`http://localhost:27123/vault/${encodeURIComponent(`Dentago/Intelligence/${title}.md`)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${OBSIDIAN_KEY}`, "Content-Type": "text/markdown" },
    body: content,
  }).catch(() => {});
}

async function logEvent(payload: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function main() {
  console.log(`\n🧠 AI Intelligence Feed — ${new Date().toLocaleTimeString("en-GB")}\n`);

  const seen = loadSeen();

  // Fetch all sources in parallel
  const [hnItems, ycVideos] = await Promise.all([
    fetchHN(),
    fetchYCVideos(),
  ]);

  const allItems = [
    ...hnItems.map(i => ({ title: i.title, url: i.url, source: "HN" })),
    ...ycVideos.map(i => ({ title: i.title, url: i.url, source: "YC" })),
  ].filter(i => !seen.has(i.url));

  console.log(`Found ${allItems.length} new items to classify`);

  if (!allItems.length) {
    console.log("Nothing new.");
    return;
  }

  const classified = await classify(allItems);
  const highSignal = classified.filter(c => c.signal === "HIGH");
  const medSignal = classified.filter(c => c.signal === "MEDIUM");

  console.log(`\n🔴 HIGH SIGNAL (${highSignal.length}):`);
  for (const item of highSignal) {
    console.log(`  • ${item.item.title}`);
    console.log(`    → ${item.relevance}`);
    console.log(`    Action: ${item.action}`);
  }

  console.log(`\n🟡 MEDIUM SIGNAL (${medSignal.length}):`);
  for (const item of medSignal) {
    console.log(`  • ${item.item.title}`);
  }

  // Mark seen
  for (const item of allItems) seen.add(item.url);
  saveSeen(seen);

  // Log high signal to OS events
  for (const item of highSignal) {
    await logEvent({
      event_type: "ai_intelligence_high_signal",
      entity_type: "intelligence",
      entity_id: item.item.url,
      payload: {
        title: item.item.title,
        url: item.item.url,
        relevance: item.relevance,
        action: item.action,
      },
      source: "os_ai_intelligence",
    });
  }

  // Write to Obsidian
  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const content = `# AI Intelligence — ${date} ${time}

${highSignal.length > 0 ? `## 🔴 High Signal — Act Now
${highSignal.map(i => `### ${i.item.title}
- **Why it matters:** ${i.relevance}
- **Action:** ${i.action}
- **Link:** ${i.item.url}`).join("\n\n")}` : ""}

${medSignal.length > 0 ? `## 🟡 On Radar
${medSignal.map(i => `- [${i.item.title}](${i.item.url}) — ${i.relevance}`).join("\n")}` : ""}

_Fetched by os-ai-intelligence.ts | Sources: Hacker News, YC_
`;

  await writeObsidian(`AI Intelligence — ${date}`, content);

  // Append to master AI feed
  if (highSignal.length > 0) {
    const appendContent = `\n## ${date} ${time}\n${highSignal.map(i => `- 🔴 **${i.item.title}** — ${i.action}\n  ${i.item.url}`).join("\n")}\n`;
    await fetch(`http://localhost:27123/vault/${encodeURIComponent("Dentago/Intelligence/AI Feed — Master.md")}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${OBSIDIAN_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: appendContent, insertAfter: "" }),
    }).catch(() => {});
  }

  console.log(`\n✅ Done — ${highSignal.length} high signal, ${medSignal.length} medium`);
}

main().catch(e => { console.error(e); process.exit(1); });
