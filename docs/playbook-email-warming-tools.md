# Domain warming & outbound tooling (Instantly & alternatives)

> **Reference only.** This guide supports founder decisions — it does **not** create tool accounts or tick Agents / Approvals as done.

## Preconditions

- SPF + DKIM + DMARC passing on dentago.co.uk (confirm in Postmaster).
- Sending identity matches authenticated domain in Resend.

## If proceeding with Instantly

1. Create workspace (founder-owned account); connect dentago.co.uk as sending domain (DNS TXT as instructed).
2. Import **only** opted-in B2B contacts (CRM export); tag source batch for reply metrics.
3. Warm-up: start at ~20–40 sends/day per inbox if domain &lt;30 days old; ramp per vendor guidance + Postmaster spam rate (must stay &lt;0.3%).
4. Align sequences with existing Resend templates — avoid duplicate touches same week.

## Alternatives

- **Resend-only:** Increase batch cadence slowly using Postmaster + complaint rate.
- **Smartlead / Lemlist:** Same DNS prerequisites; compare on inbox UX + UK GDPR tooling.

## Founder decisions (tracked in Approvals)

- Budget ceiling for parallel sending tools.
- Single vs multi-inbox strategy for founder vs hello@.

## Related `/os` items

- **Approvals:** “Founder · Instantly.ai vs alternatives”
- **Goals:** Any goal referencing Instantly / warm-up — satisfy acceptance criteria separately.
