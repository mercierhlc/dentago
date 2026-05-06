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
