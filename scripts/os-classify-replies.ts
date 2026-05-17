/**
 * Outreach Reply Classification Loop
 * Run this after checking email — paste reply content, get classification + suggested response
 * Usage: npx tsx scripts/os-classify-replies.ts --reply="..." --from="email@clinic.com"
 */
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

function loadEnv(f: string) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f,'utf8').split('\n')) { const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,''); } }
loadEnv(path.resolve(__dirname,'..', '.env.local'));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CALENDLY = 'https://calendly.com/rnsv/dentago-introduction';

async function classifyReply(replyText: string, fromEmail: string) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: `You are the Dentago outreach reply classifier. Dentago is a free B2B dental procurement platform for UK clinics.

Classify inbound email replies into exactly one of:
- INTERESTED: Wants to learn more, book a demo, or try the product
- NOT_NOW: Politely declined, timing issue, busy
- WRONG_PERSON: Not the right contact at the practice
- UNSUBSCRIBE: Wants to be removed from list
- QUESTION: Has a specific question about Dentago

Then write the ideal response. Keep responses short, human, no salesy language.

For INTERESTED: Send Calendly link (${CALENDLY}) and confirm free for practices
For NOT_NOW: Acknowledge, leave door open, no pressure close
For WRONG_PERSON: Ask who the right person is
For UNSUBSCRIBE: Confirm removal immediately, no pushback
For QUESTION: Answer directly and concisely

Output JSON: { "classification": "INTERESTED|NOT_NOW|WRONG_PERSON|UNSUBSCRIBE|QUESTION", "confidence": 0.0-1.0, "suggested_response": "...", "demo_book_probability": 0.0-1.0, "reasoning": "..." }`,
    messages: [{ role: 'user', content: `From: ${fromEmail}\n\nReply:\n${replyText}` }],
  });

  const text = res.content[0].type === 'text' ? res.content[0].text : '{}';
  const result = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());

  // Log to events
  await supabase.from('events').insert({
    event_type: 'outreach_classified',
    entity_type: 'outreach',
    payload: { from: fromEmail, classification: result.classification, confidence: result.confidence, demo_book_probability: result.demo_book_probability },
    source: 'classify_replies_script',
  });

  // Log to Supabase loop_runs
  await supabase.from('loop_runs').insert({
    loop_name: 'reply_classification',
    triggered_by: fromEmail,
    status: 'completed',
    input: { reply_text: replyText, from: fromEmail },
    output: result,
    kpis_measured: { classification: result.classification, demo_probability: result.demo_book_probability },
    completed_at: new Date().toISOString(),
  });

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const replyArg = args.find(a => a.startsWith('--reply='))?.slice(8) ?? '';
  const fromArg = args.find(a => a.startsWith('--from='))?.slice(7) ?? 'unknown@example.com';
  const reply = replyArg.replace(/^["']|["']$/g, '');

  if (!reply) {
    console.log('Usage: npx tsx scripts/os-classify-replies.ts --reply="..." --from="email@clinic.com"');
    return;
  }

  console.log(`\nClassifying reply from ${fromArg}...\n`);
  const result = await classifyReply(reply, fromArg);

  console.log(`Classification: ${result.classification} (${(result.confidence * 100).toFixed(0)}% confidence)`);
  console.log(`Demo probability: ${(result.demo_book_probability * 100).toFixed(0)}%`);
  console.log(`\nSuggested response:\n---\n${result.suggested_response}\n---`);
  console.log(`\nReasoning: ${result.reasoning}`);
}

main().catch(console.error);
