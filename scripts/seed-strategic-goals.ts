/**
 * Seeds the 12 strategic goals into the OS goals table.
 * Reverse-engineered from the PRD to hit 1,000 clinics + £2M revenue in Year 1.
 */
import * as path from 'path';
import * as fs from 'fs';

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.resolve(__dirname, '..', '.env.local'));
loadEnv(path.resolve(__dirname, '..', '.env'));

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const goals = [

  // ── YEARLY (3) ──────────────────────────────────────────────────────────────

  {
    title: "1,000 verified clinics on Dentago by end of Year 1",
    category: "product",
    status: "active",
    priority: 0,
    target_outcome: "1,000 UK dental clinics with verified accounts actively using Dentago for procurement",
    acceptance_criteria: "1,000 rows in clinic_accounts with status = verified AND at least one search or order placed in the last 30 days",
    success_metric: "clinic_verified_count >= 1000",
    metric_current: 2,
    metric_target: 1000,
    approaches: [
      "Cold email outreach to 5,000+ UK dental practice managers per day",
      "BDA / ADAM association partnership for distribution to all UK practices",
      "WhatsApp dental practice manager networks — peer referral is zero CAC",
      "Door-to-door in London dental districts (Harley Street, Wimpole Street, Islington)",
      "Calendly demo flow + concierge onboarding for first 50 clinics"
    ],
    failure_context: [],
    constraints: ["Free for clinics — no paywall that blocks signups", "GDC verification required before ordering"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },

  {
    title: "£2M in supplier revenue by end of Year 1",
    category: "supplier",
    status: "active",
    priority: 0,
    target_outcome: "£2M in committed annual recurring revenue from supplier transaction fees, featured placement, or commercial agreements",
    acceptance_criteria: "Signed supplier agreements totalling £2M ARR, OR £167K+ MRR confirmed in any single month of Year 1",
    success_metric: "supplier_arr >= 2000000",
    metric_current: 0,
    metric_target: 2000000,
    approaches: [
      "Henry Schein anchor deal — 8 May meeting with Gary Marvin is the lever. One signed agreement unlocks all other supplier conversations.",
      "GMV-as-pitch: show suppliers the £ being directed to their competitors through the platform",
      "Transaction fee model: 2.5% of GMV once formal agreement in place — per PRD revenue stack",
      "Featured placement: £800–£2,500/month per supplier for promoted product placement",
      "Exclusion threat: suppliers not on Dentago are invisible to clinics comparing in real time"
    ],
    failure_context: [],
    constraints: ["Revenue model is GMV-gated — need real order volume before supplier fees are credible", "Suppliers have tight margins — commission rate must be negotiated per supplier"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },

  {
    title: "£36M annualised GMV through the platform by end of Year 1",
    category: "product",
    status: "active",
    priority: 0,
    target_outcome: "£3M/month of dental supply spend flowing through Dentago — the asset that makes £2M revenue inevitable",
    acceptance_criteria: "£3M GMV in any single calendar month before December 2026, verified via order_items sum",
    success_metric: "monthly_gmv >= 3000000",
    metric_current: 0,
    metric_target: 3000000,
    approaches: [
      "1,000 clinics × £3,000 avg monthly spend = £3M/month. Clinic count is the lever.",
      "Supplier API connections (Henry Schein, Kent Express, DD Group) — live pricing drives conversion",
      "Autonomous reorder reminders once 3 months of order history exists per clinic",
      "Group purchasing at 200+ clinics — Dentago-exclusive pricing becomes a moat"
    ],
    failure_context: [],
    constraints: ["Order placement requires live supplier API/EDI — no email fallback per PRD decision", "GDC verification gate means not every signup becomes a buyer"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },

  // ── QUARTERLY — Q2 2026 (Apr–Jun) ───────────────────────────────────────────

  {
    title: "Q2: 100 verified clinics and first GMV by end of June 2026",
    category: "outreach",
    status: "active",
    priority: 1,
    target_outcome: "100 verified clinics on the platform, at least one real order placed, first £ of GMV tracked",
    acceptance_criteria: "clinic_accounts.status = verified COUNT >= 100 AND total_gmv > 0",
    success_metric: "verified_clinics >= 100 AND gmv > 0",
    metric_current: 2,
    metric_target: 100,
    approaches: [
      "50 verified by end of May (current sprint), 100 by end of June",
      "Warm up email domain — 11 batches sent, continue daily sending at increasing volume",
      "Demo → onboarding conversion: every booked demo must end with supplier connection and first search",
      "Fix activation flow (empty state) — P0 gap in PRD — clinics must be guided to their first order"
    ],
    failure_context: [],
    constraints: ["Domain warming limits daily email volume for next 10 days", "Reply rate currently ~0% — diagnose and fix before scaling volume"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },

  {
    title: "Q2: Henry Schein heads-of-terms agreed by 31 May 2026",
    category: "supplier",
    status: "active",
    priority: 1,
    target_outcome: "Commercial terms agreed with Henry Schein — the anchor supplier that unlocks every other supplier conversation",
    acceptance_criteria: "Written heads-of-terms or LOI from Henry Schein covering: catalog access, transaction fee rate, integration timeline",
    success_metric: "henry_schein_agreement_signed = true",
    metric_current: 0,
    metric_target: 1,
    approaches: [
      "8 May meeting with Gary Marvin — prepare GMV data, clinic growth trajectory, and competitive framing",
      "Pitch: 'We've directed £X to your competitors — here's what you're missing. We already have your catalog.'",
      "Anchor offer: featured placement + first-mover advantage — be the first supplier with a verified badge",
      "Follow-up within 24h of meeting with proposed terms and next steps"
    ],
    failure_context: [],
    constraints: ["Must not agree to exclusive arrangement that blocks other suppliers", "Commission rate must be sustainable for Henry Schein's margin profile"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },

  {
    title: "Q2: Reply rate ≥ 10% and demo → verified conversion ≥ 50%",
    category: "outreach",
    status: "active",
    priority: 1,
    target_outcome: "Cold outreach reply rate reaches 10%+ and every demo booked converts to a verified clinic",
    acceptance_criteria: "reply_rate >= 0.10 on any batch of 500+ emails AND 2 out of every 4 demos result in verified clinic account",
    success_metric: "reply_rate >= 0.10",
    metric_current: 0,
    metric_target: 0.10,
    approaches: [
      "A/B test subject lines — current open rate data from Resend suggests deliverability issue not copy issue",
      "Personalise by practice size and location — Harley Street vs NHS vs mixed practice need different copy",
      "Follow-up sequence: 3-touch (initial, day 3, day 7) — most replies come on touch 2 or 3",
      "Fix demo → verified drop-off: send GDC verification link within the demo call, not after"
    ],
    failure_context: [],
    constraints: ["Domain is 10 days old — spam risk if volume exceeds warming curve", "Do not send from secondary domains until primary is warmed"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },

  // ── MONTHLY — MAY 2026 ───────────────────────────────────────────────────────

  {
    title: "May: 50 verified clinics by 31 May 2026",
    category: "outreach",
    status: "active",
    priority: 2,
    target_outcome: "50 UK dental clinics with verified Dentago accounts by end of May",
    acceptance_criteria: "SELECT COUNT(*) FROM clinic_accounts WHERE status = 'verified' >= 50",
    success_metric: "verified_clinics >= 50",
    metric_current: 2,
    metric_target: 50,
    approaches: [
      "Currently 2 verified. Need 48 more in 27 days = ~2 verifications/day",
      "Prioritise warm leads: 4 demos already booked — convert all 4 this week",
      "Karuna Giri (NHS, 11 chairs) — followed up after 28 Apr demo, push to verify",
      "Sara @ Dentist Gallery — followed up after 30 Apr demo, push to verify",
      "Scale email outreach to 500/day this week, 1,000/day next week as domain warms"
    ],
    failure_context: [],
    constraints: ["27 days remaining", "Each verification requires GDC document upload and admin approval"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },

  {
    title: "May: First order placed — any GMV > £0",
    category: "product",
    status: "active",
    priority: 2,
    target_outcome: "At least one real dental supply order placed through Dentago, generating first GMV",
    acceptance_criteria: "orders table has at least 1 row with status = placed AND total > 0",
    success_metric: "total_gmv > 0",
    metric_current: 0,
    metric_target: 1,
    approaches: [
      "Fix empty state / activation flow (PRD P0 gap) — verified clinics land on a dead dashboard",
      "Build onboarding checklist: connect suppliers → search product → see savings → place order",
      "Personally walk Karuna Giri or Sara through their first order on a screen share",
      "Ensure Henry Schein + DD Group live pricing is working for connected clinic accounts"
    ],
    failure_context: [],
    constraints: ["Order placement requires live supplier API — no email fallback", "Clinic must be verified before they can order"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },

  {
    title: "May: Henry Schein meeting on 8 May — leave with a clear next step",
    category: "supplier",
    status: "active",
    priority: 2,
    target_outcome: "8 May meeting with Gary Marvin at Henry Schein results in a defined commercial next step — trial, pilot, or heads-of-terms discussion",
    acceptance_criteria: "Meeting held AND follow-up sent within 24h with proposed terms or pilot structure AND response received",
    success_metric: "henry_schein_next_step_agreed = true",
    metric_current: 0,
    metric_target: 1,
    approaches: [
      "Prepare 5-slide deck: what Dentago is, current clinic count + trajectory, GMV directed to HS, proposed partnership terms, ask",
      "Lead with GMV data: 'We've directed £X to your catalog. Here's what a formal integration looks like.'",
      "Secondary ask if commercial terms too early: catalog API access in exchange for featured placement",
      "Book follow-up meeting before leaving the room"
    ],
    failure_context: [],
    constraints: ["Meeting is 8 May — 4 days away", "Gary Marvin is HS account manager level — may need to escalate to commercial/partnerships team"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },

  // ── WEEKLY — Week of 4 May 2026 ─────────────────────────────────────────────

  {
    title: "This week: Fix clinic activation flow and get first order placed",
    category: "product",
    status: "active",
    priority: 3,
    target_outcome: "Verified clinic sees a guided onboarding checklist on their dashboard and completes their first order",
    acceptance_criteria: "Onboarding checklist component live on /dashboard for verified clinics with no existing orders AND at least 1 order placed this week",
    success_metric: "first_order_placed = true",
    metric_current: 0,
    metric_target: 1,
    approaches: [
      "Build onboarding checklist: step 1 connect suppliers, step 2 search a product, step 3 place your first order",
      "Progress-tracked, dismissible once all steps complete",
      "Screen share with Karuna or Sara to walk through first order — do not wait for them to discover it",
      "Ensure supplier connections for Henry Schein and DD Group are working correctly"
    ],
    failure_context: [],
    constraints: ["This week only — 7 days", "Must not break existing dashboard for clinics that have already placed orders"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },

  {
    title: "This week: Send 2,000 cold emails and book 3 new demos",
    category: "outreach",
    status: "active",
    priority: 3,
    target_outcome: "2,000 personalised cold emails sent to UK dental practice managers this week, generating 3+ new demo bookings",
    acceptance_criteria: "events table: outreach_sent count >= 2000 this week AND calendly_booking_created count >= 3 this week",
    success_metric: "weekly_emails_sent >= 2000 AND new_demos >= 3",
    metric_current: 0,
    metric_target: 2000,
    approaches: [
      "Continue domain warming — scale from current batch size to 400/day by end of week",
      "Segment by practice type: private, NHS, mixed — use different subject lines per segment",
      "3-touch sequence: initial email today, follow-up day 3, final day 7",
      "Include Calendly link in every email — friction-free booking"
    ],
    failure_context: [],
    constraints: ["Domain is young — do not exceed warming curve or risk spam classification", "Resend daily send limit based on current domain reputation"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },

  {
    title: "This week: Prepare Henry Schein meeting deck and confirm 8 May",
    category: "supplier",
    status: "active",
    priority: 3,
    target_outcome: "5-slide meeting deck ready, meeting confirmed, and proposed commercial terms drafted before 8 May",
    acceptance_criteria: "Deck file exists in Dentago/Supplier Outreach/ AND meeting confirmed with Gary Marvin AND one-page terms doc drafted",
    success_metric: "henry_schein_deck_ready = true",
    metric_current: 0,
    metric_target: 1,
    approaches: [
      "Slide 1: What Dentago is (one sentence + live URL)",
      "Slide 2: Market traction — clinics signed, demos booked, GMV data",
      "Slide 3: What Henry Schein gets — new digital channel, clinic reach, data",
      "Slide 4: Proposed partnership structure — catalog API access + transaction fee or featured placement",
      "Slide 5: The ask — pilot with 10 clinics, review after 30 days",
      "One-page terms: catalog integration scope, fee structure, data sharing, exclusivity (none)"
    ],
    failure_context: [],
    constraints: ["Meeting is 8 May — 4 days", "Keep deck to 5 slides maximum — Gary is a sales person not a board member"],
    agent_decomposition: [],
    next_review_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },

];

async function main() {
  console.log('\n🎯 Seeding strategic goals into the OS...\n');

  // Check for existing strategic goals to avoid duplicates
  const { data: existing } = await s.from('goals').select('title');
  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));

  const newGoals = goals.filter(g => !existingTitles.has(g.title));
  console.log(`  ${goals.length - newGoals.length} already exist, inserting ${newGoals.length} new goals\n`);

  for (const goal of newGoals) {
    const { error } = await s.from('goals').insert(goal);
    if (error) {
      console.error(`  ❌ ${goal.title.slice(0, 60)}: ${error.message}`);
    } else {
      const tier = goal.priority === 0 ? '📅 YEARLY' : goal.priority === 1 ? '📆 QUARTERLY' : goal.priority === 2 ? '🗓 MONTHLY' : '📋 WEEKLY';
      console.log(`  ✅ ${tier} — ${goal.title.slice(0, 65)}`);
    }
  }

  console.log('\n✨ Strategic goals seeded into the OS\n');
  console.log('View at: https://www.dentago.co.uk/os → Goals tab\n');
}

main().catch(e => { console.error(e); process.exit(1); });
