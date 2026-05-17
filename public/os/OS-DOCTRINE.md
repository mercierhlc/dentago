# Dentago OS Doctrine

This charter applies to everyone building or operating Dentago—humans and AI agents.

## Purpose

Everything meaningful is logged in the **OS** (the Dentago Operating System): Supabase tables such as `events`, `context_log`, `goals`, `decisions`, `os_state`, and related APIs. We do this so the company has **one queryable memory**, giving us the best possible chance of **eliminating open loops**—nothing important lives only in chat, heads, or scattered docs.

We want **everything to become queryable to AI**: structured rows, consistent event types, and session summaries beat ad-hoc notes. The OS must remain **easy for AI to read** (via `GET /api/os/state`, Goals, Context Log, Events, and `POST /api/intelligence`). **Any time we work on Dentago, we look here first.** When we finish discrete work, we **log it**—especially into **`events`**—so the timeline reflects reality.

## Principles

1. **Single source of truth** — The OS is the brain for operational and strategic memory. Prefer logging over remembering.
2. **Start from the OS** — Before substantive work: read live state (`GET /api/os/state`), scan Goals, Context Log, and recent Events (or use the `/os` dashboard).
3. **Close loops explicitly** — Capture blockers, next actions, and outcomes so nothing silently stalls.
4. **Log facts to Events** — Use `logEvent()` from `lib/events.ts` for discrete outcomes (ships, bookings, outreach, product actions, etc.). The Events tab is the audit trail.
5. **Log narrative to Context** — End sessions with `POST /api/os/log-context`: summary, decisions, work completed, open loops, outreach counts where relevant.
6. **Stay AI-legible** — Prefer clear payloads, stable `event_type` values, and summaries that a model or `/api/intelligence` can reason over later.

## Canonical references

| What | Where |
|------|--------|
| Session read | `GET https://www.dentago.co.uk/api/os/state` |
| Session write | `POST https://www.dentago.co.uk/api/os/log-context` |
| Structured facts | `logEvent()` in `lib/events.ts` → `events` table |
| Natural-language query | `POST /api/intelligence` |
| Human UI | `/os` (internal dashboard) |
| Founder approvals | `/os` → **Approvals** — file uncertain work via `POST /api/os/approval-requests`; resolve with approve/reject there |

## Uncertainty and approvals

If an agent or operator is **not sure** whether to execute something (scope, security, copy, data mutation), **do not guess**. Create an **approval request** from `/os` (Approvals tab) or `POST /api/os/approval-requests`. The founder can approve, reject, or resolve from the same UI; pending items surface as an amber badge on the dashboard.

## Shipping OS changes

Changes under **`app/os/`**, **`public/os/`**, and **`app/api/os/`** ship with the rest of the Next.js app: merge to **`main`** → **Vercel production**. GitHub also runs **`OS dashboard CI`** on pushes that touch those paths (`npm run build`). After changing OS **code**, run **`npm run ship:os`** (or merge to `main`) so production updates within ~1–2 minutes — React cannot hot-swap without a deploy.

**Live markdown (no redeploy):** the canonical URL is **`GET /api/os/live-doc/OS-DOCTRINE`** (same OS cookie auth). If row **`os_live_documents`** exists for slug `OS-DOCTRINE`, that body is served; otherwise this repo file is used. Update via **`PUT /api/os/live-doc/OS-DOCTRINE`** with JSON `{ "body_md": "..." }` while logged into `/os`.

This file lives in-repo at **`public/os/OS-DOCTRINE.md`** (fallback when the DB row is empty).

---

## Clinic product plans — Free tier operational wedge (canonical)

**Strategy:** The **Free** plan is the strong operational wedge — clinics should live inside Dentago daily (search, cart, multi-supplier orders, par levels, savings, approvals, spend visibility). **Dentago Pro** is reserved for *deeper automation and premium depth* (roadmap: conversational procurement assistant, predictive stock at scale, consolidated invoicing nuances, etc.) — not for locking core daily workflows.

### Free tier — included capabilities (check against repo + prod)

| Capability | Shipped? | Notes |
|------------|----------|--------|
| Multi-vendor ordering | **Yes** | Cart + push-to-supplier basket; multiple suppliers in one workspace. |
| Unified cart | **Yes** | `/cart` — lines across suppliers. |
| Order placement | **Yes** | Orders API + supplier checkout completion off-platform. |
| Supplier accounts | **Yes** | Integrations in Settings; credentials sync; `/clinic/suppliers`. |
| Basic inventory | **Yes** | Par levels + product linkage; not full ERP stock counts. |
| Par levels | **Yes** | `/clinic/par-levels`, `clinic_par_levels` API. |
| Stock alerts | **Yes** | Dashboard par-due + email/cron stockout path (`stockout-alerts` / par logic). |
| Spend dashboard | **Yes** | Dashboard spend snapshot + `/clinic/analytics`. |
| Savings calculator | **Yes** | Search/cart savings signals; dashboard estimated savings. |
| SKU matching | **Yes** | Supplier ops + catalog identity (admin); clinic benefits via unified catalogue. |
| Basic substitutions | **Yes** | Product substitutes API + OOS clinical equivalents on product page. |
| Approvals | **Yes** | `/approvals`, approval policy API, order approval_status. |
| Multi-location basics | **Partial** | `parent_clinic_id` + child site count on dashboard; no dedicated “Sites” manager UI yet. |
| Supplier portal | **Yes** | `/supplier` routes for supplier-facing order flow (separate auth surface). |
| Reorder suggestions | **Yes** | Dashboard “Reorder rhythm” from order history heuristic. |
| Savings history | **Yes** | `/clinic/savings` + `clinic_savings_log` / API. |

### Dentago Pro — positioning (not an exhaustive ship list)

Pro messaging should emphasise **automation depth** (e.g. in-app procurement assistant already Pro-gated on dashboard), not blocking the rows above for Free users. Update pricing/marketing when Pro SKU is finalised.

---

## Pivot Features

Strategic product bets that go beyond the core marketplace and become defensible moats. These are not roadmap items — they are category-defining features that, if executed correctly, make Dentago extremely difficult to displace. Each feature below has a phased build plan. **Do not skip phases.**

---

### 1. AI Substitutions System

**What it is:** When a clinic searches, reorders, hits a stockout, overpays, or exceeds budget, Dentago intelligently recommends better alternatives. The system optimises for compatibility, clinician trust, availability, delivery speed, pricing, and historical clinic preferences — not just lowest price.

**Strategic importance:**

| Benefit | Why It Matters |
|---|---|
| Higher order conversion | Clinics complete orders instead of abandoning |
| More procurement volume | More GMV flows through Dentago |
| Stronger lock-in | AI learns clinic preferences over time — switching cost rises every order |
| Better supplier leverage | Dentago controls product routing decisions |
| Inventory resilience | Prevents stockout disruptions from stalling procurement |
| Data moat | Competitor cannot replicate clinic behaviour data once accumulated |
| AI differentiation | Real operational AI vs chatbot gimmicks |

---

#### Phase 1 — Rule-Based Substitutions (build first)

Do NOT begin with LLM-heavy recommendations. Deterministic trust must come first. Clinics will not trust black-box recommendations early.

**1.1 Product Equivalency Engine**

Every SKU gets mapped into structured attributes:
- Category, subcategory, intended use, compatible procedures
- Material type, brand tier, dimensions/specifications
- Sterilisation type, regulatory equivalence, clinician preference tags

Example — *3M Filtek Supreme Flowable A2* maps to: restorative composite · flowable · shade A2 · light-cure · syringe delivery · nano-hybrid. Valid substitutes: Kulzer Venus Flow A2, Tokuyama Estelite Flow Quick A2, GC G-aenial Universal Injectable.

Without this normalisation layer, substitutions are dangerous and inaccurate. This is the foundation of the entire system.

**1.2 Substitute Confidence Score**

Every recommendation carries a confidence score. Example: 98% equivalent / 91% equivalent / 76% equivalent.

Inputs: exact material match, same dimensions, same procedure type, same manufacturer family, clinician acceptance rate, reorder retention, return rate, complaint rate.

Clinicians need to see this number. High confidence removes fear.

**1.3 Multi-Objective Optimisation**

Each substitute optimises across multiple vectors simultaneously:

| Mode | Purpose |
|---|---|
| Cheapest | Cost savings |
| Fastest delivery | Operational continuity |
| Highest-rated | Clinical trust |
| Most reordered | Social proof |
| Highest margin | Supplier economics |
| In-stock alternative | Stockout prevention |
| Preferred clinic brand | Personalisation |

UI example: *"Alternative available — Save £14 · Arrives tomorrow · Used by 183 clinics · 96% reorder satisfaction"*

**1.4 Out-of-Stock Rescue Flow (highest ROI workflow)**

When an item is unavailable: auto-suggest replacements, one-click replace, maintain cart continuity, preserve treatment compatibility.

Example: *"Your gloves are unavailable. Equivalent alternatives: same fit/material · 4% cheaper · ships today."*

This directly prevents procurement abandonment. Highest immediate ROI of anything in Phase 1.

**1.5 Smart Cart Recommendations**

Inside the cart: consolidate suppliers, reduce shipping costs, optimise basket composition, suggest better pack sizing, remove duplicate SKUs.

Example: *"You can reduce shipping by £22 by switching 2 items to Supplier B."*

Turns Dentago from a search tool into a procurement optimiser.

---

#### Phase 2 — Learning System

**2.1 Clinic Preference Learning**

System learns: preferred brands, acceptable substitute ranges, material sensitivities, price tolerance, delivery expectations, clinician-specific habits. If a clinic consistently rejects generic composites or off-brand implants, the system adapts and stops recommending them.

**2.2 Procedure-Aware Intelligence**

Map products to procedures. If composite usage is trending up and aligner attachments are increasing, AI predicts reorder timing, likely shortages, and future purchasing needs. Moves Dentago from reactive to predictive.

**2.3 Autonomous Reordering Suggestions**

Not auto-order initially. Suggest first. Example: *"You likely need to reorder nitrile gloves in 5 days · bonding agent next week."* High utility, low perceived risk.

**2.4 Supplier Reliability Scoring**

AI evaluates delivery consistency, cancellation rates, stock reliability, invoice accuracy, and backorder frequency — then adjusts recommendations away from unreliable suppliers regardless of price. Price alone is insufficient in healthcare procurement.

---

#### Phase 3 — AI Procurement Agent (long-term moat)

**3.1 Conversational Procurement**

*"Find me a cheaper alternative to our current implant drills but keep the same compatibility."*
*"Reduce this month's spend by 10% without changing restorative materials."*

Becomes an operational copilot. This is the beginning of AI-managed dental procurement.

**3.2 Budget-Constrained Optimisation**

Clinic sets a monthly budget (e.g. £12k). AI reallocates purchases, suggests alternatives, consolidates suppliers, delays non-urgent items. CFO-level tooling for practice owners.

**3.3 Predictive Stock Risk Engine**

AI predicts likely shortages, supplier disruptions, seasonal consumption spikes, and manufacturer instability before they affect the clinic.

---

#### UX Principles — Non-Negotiable

**Never make clinicians feel overridden.**
Wrong: *"We replaced your product."*
Correct: *"Recommended alternative."*
Trust is everything in healthcare.

**Explain WHY every recommendation exists.**
Every suggestion needs: price delta · compatibility explanation · delivery advantage · social proof · confidence score. Black-box AI fails in healthcare.

**Allow preference locking.**
Clinics must be able to ban brands, whitelist suppliers, lock clinical products, and enforce preferred substitutes. Control reduces resistance.

---

#### Data Moat

This system compounds aggressively. Dentago learns what clinics buy, what they reject, acceptable substitute ranges, reorder behaviour, treatment patterns, supplier reliability, and price elasticity thresholds. After 12 months of real orders, this dataset becomes extremely difficult for any competitor — especially fragmented distributors — to replicate.

**The substitutions system is not a feature. It is the beginning of AI-managed dental procurement. That is a very large category if executed correctly.**

---

#### What NOT to Build Early

Avoid: generative chatbot substitutions, voice AI, autonomous ordering without confirmation, hallucinated product equivalencies, fully automated purchasing, open-ended LLM recommendations with no structure.

Clinics want reliability, accuracy, and operational utility — not novelty.

---

#### Build Sequence

1. Product attribute normalisation schema (DB + admin UI)
2. Equivalency mappings for top 200 SKUs by order volume
3. Confidence scoring algorithm (rule-based v1)
4. Out-of-stock rescue flow in cart
5. Smart cart consolidation suggestions
6. Clinic preference capture (accept/reject signals)
7. Phase 2 learning system once 50+ active clinics
8. Phase 3 agent once £500k/month GMV
