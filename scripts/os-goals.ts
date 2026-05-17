/**
 * OS Goal Review — Closed Loop Goal Engine
 *
 * Operating contract:
 *   Humans define: goals, constraints, priorities, acceptance_criteria
 *   Agents handle: decomposition, execution, iteration, reporting
 *
 * A goal is DONE only when its acceptance_criteria is met.
 * When a goal fails, failure_context is captured and used in the next approach.
 *
 * Run: npx tsx scripts/os-goals.ts
 * Cron: every 6 hours
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
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function db(table: string, method = "GET", body?: object, filters = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === "GET") return res.json();
  return res.ok;
}

async function generateNewApproach(goal: any, pastApproaches: string[], failureContext: any[]): Promise<string> {
  const failureSummary = failureContext.length > 0
    ? `\nFailure context from past attempts:\n${failureContext.map((f: any, i: number) =>
        `${i + 1}. Approach: ${f.approach ?? "unknown"} | Why it failed: ${f.why_it_failed ?? "unknown"}`
      ).join("\n")}`
    : "";

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You are the AI OS for Dentago, a B2B dental procurement marketplace targeting £50M revenue by end of Year 2.
Operating contract: you handle decomposition, execution, iteration, and reporting. Humans define goals and acceptance criteria.
A goal has not met its acceptance criteria after ${pastApproaches.length} attempt(s). Generate a smarter new approach.
Use the failure context to avoid repeating what didn't work. Be specific: name the person, platform, exact message, action.`,
    messages: [{
      role: "user",
      content: `Goal: ${goal.title}
Category: ${goal.category}
Acceptance criteria (set by founder): ${goal.acceptance_criteria ?? goal.target_outcome}
Constraints: ${goal.constraints ? JSON.stringify(goal.constraints) : "none specified"}
${failureSummary}

Past approaches tried:
${pastApproaches.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Generate ONE new specific approach that avoids past failures. 3-4 sentences. Be concrete.`,
    }],
  });
  return res.content[0].type === "text" ? res.content[0].text.trim() : "Manual review required.";
}

async function generateAgentReport(goals: any[]): Promise<string> {
  const active = goals.filter(g => g.status === "active");
  const done = goals.filter(g => g.status === "done");

  const criticalGoals = active.filter(g => g.priority <= 2);
  const stuckGoals = active.filter(g => (g.approaches?.length ?? 0) >= 3);

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: `You are the Dentago AI OS. Generate a concise agent report on goal progress. Focus on what's stuck, what's moving, and what needs human attention.`,
    messages: [{
      role: "user",
      content: `Active goals: ${active.length} | Done: ${done.length}
Critical (priority 1-2): ${criticalGoals.map(g => g.title).join(", ") || "none"}
Stuck (3+ attempts, not done): ${stuckGoals.map(g => `${g.title} (${g.approaches?.length} attempts)`).join(", ") || "none"}

Write a 3-5 sentence report: what's the state of the business goals, what's stuck, what needs founder attention.`,
    }],
  });

  return res.content[0].type === "text" ? res.content[0].text.trim() : "";
}

async function checkAcceptanceCriteria(goal: any): Promise<{ met: boolean; evidence: string }> {
  // Check event-based criteria first
  const events = await db("events", "GET", undefined,
    `?event_type=eq.goal_achieved&payload->>goal_id=eq.${goal.id}&limit=1`);
  if (Array.isArray(events) && events.length > 0) {
    return { met: true, evidence: "goal_achieved event logged" };
  }

  // Check metric-based criteria
  if (goal.metric_target && goal.metric_current >= goal.metric_target) {
    return { met: true, evidence: `metric ${goal.metric_current} >= target ${goal.metric_target}` };
  }

  return { met: false, evidence: "acceptance criteria not yet met" };
}

async function logContextToOS(summary: string, goalsReviewed: any[]) {
  const workCompleted = goalsReviewed.map(g => ({
    task: `Goal review: ${g.title}`,
    result: g._outcome ?? "new approach generated",
  }));

  await db("context_log", "POST", {
    session_type: "cron_run",
    summary,
    work_completed: workCompleted,
    open_loops: goalsReviewed
      .filter(g => g._outcome !== "achieved")
      .map(g => ({
        task: g.title,
        blocker: `Not yet met acceptance criteria: ${g.acceptance_criteria ?? g.target_outcome}`,
        next_action: g._new_approach ?? "see approaches array",
      })),
    source: "os_goal_review",
  });
}

async function main() {
  console.log("\n🎯 OS Goal Review — Closed Loop\n");
  console.log("Operating contract: agents iterate until acceptance_criteria is met.\n");

  const now = new Date().toISOString();
  const goals = await db("goals", "GET", undefined,
    `?status=eq.active&next_review_at=lte.${now}&order=priority.asc,next_review_at.asc&limit=30`);

  if (!Array.isArray(goals) || goals.length === 0) {
    console.log("No goals due for review.");
    return;
  }

  console.log(`${goals.length} goal(s) due for review.\n`);

  const reviewed: any[] = [];

  for (const goal of goals) {
    const approaches: string[] = goal.approaches ?? [];
    const failureContext: any[] = goal.failure_context ?? [];

    console.log(`📌 [P${goal.priority ?? 5}] ${goal.title}`);
    console.log(`   Acceptance criteria: ${goal.acceptance_criteria ?? goal.target_outcome ?? "not set"}`);
    console.log(`   Attempts so far: ${approaches.length}`);

    const { met, evidence } = await checkAcceptanceCriteria(goal);

    if (met) {
      await db("goals", "PATCH", {
        status: "done",
        completed_at: now,
        agent_report: `Completed. Evidence: ${evidence}`,
      }, `?id=eq.${goal.id}`);

      await db("events", "POST", {
        event_type: "goal_achieved",
        entity_type: "goal",
        entity_id: goal.id,
        payload: { goal_title: goal.title, evidence, attempts: approaches.length },
        source: "os_goal_review",
      });

      console.log(`   ✅ ACCEPTANCE CRITERIA MET — ${evidence}`);
      goal._outcome = "achieved";
      reviewed.push(goal);
      continue;
    }

    // Capture failure context for the previous approach
    const updatedFailureContext = approaches.length > 0 ? [
      ...failureContext,
      {
        attempt: approaches.length,
        approach: approaches[approaches.length - 1],
        why_it_failed: "Did not meet acceptance criteria by review date",
        context_at_time: new Date().toISOString(),
      },
    ] : failureContext;

    // Generate new approach using failure context
    const newApproach = await generateNewApproach(goal, approaches, updatedFailureContext);
    const updatedApproaches = [...approaches, `[${new Date().toLocaleDateString("en-GB")}] ${newApproach}`];
    const nextReview = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const agentReport = `Attempt ${updatedApproaches.length}: ${newApproach.slice(0, 200)}`;

    await db("goals", "PATCH", {
      approaches: updatedApproaches,
      failure_context: updatedFailureContext,
      last_reviewed_at: now,
      next_review_at: nextReview,
      agent_report: agentReport,
    }, `?id=eq.${goal.id}`);

    await db("events", "POST", {
      event_type: "goal_reviewed",
      entity_type: "goal",
      entity_id: goal.id,
      payload: {
        goal_title: goal.title,
        attempts: updatedApproaches.length,
        new_approach: newApproach,
        failure_context_count: updatedFailureContext.length,
        next_review: nextReview,
      },
      source: "os_goal_review",
    });

    console.log(`   🔄 New approach (attempt ${updatedApproaches.length}): ${newApproach.slice(0, 120)}...`);
    console.log(`   Next review: ${new Date(nextReview).toLocaleDateString("en-GB")}\n`);

    goal._outcome = "iterated";
    goal._new_approach = newApproach;
    reviewed.push(goal);
  }

  // Generate and store agent report
  const allGoals = await db("goals", "GET", undefined, "?order=priority.asc,category.asc&limit=100");
  if (Array.isArray(allGoals) && allGoals.length > 0) {
    const report = await generateAgentReport(allGoals);
    console.log(`\n📊 Agent Report:\n${report}\n`);

    // Update OS state with goal summary
    const active = allGoals.filter(g => g.status === "active");
    const done = allGoals.filter(g => g.status === "done");
    await db("os_state", "POST", {
      category: "goals_summary",
      state: {
        active_count: active.length,
        done_count: done.length,
        critical_active: active.filter(g => g.priority <= 2).map(g => g.title),
        stuck: active.filter(g => (g.approaches?.length ?? 0) >= 3).map(g => ({
          title: g.title,
          attempts: g.approaches?.length,
          last_approach: g.approaches?.slice(-1)[0],
        })),
        last_report: report,
        updated_at: now,
      },
    }, "?on_conflict=category");
  }

  // Log this session to context_log
  const sessionSummary = `Goal review run: reviewed ${reviewed.length} goals. ${reviewed.filter(g => g._outcome === "achieved").length} achieved. ${reviewed.filter(g => g._outcome === "iterated").length} iterated with new approaches.`;
  await logContextToOS(sessionSummary, reviewed);

  console.log(`\n✅ Goal review complete. ${reviewed.length} goals processed.`);
}

main().catch(e => { console.error(e); process.exit(1); });
