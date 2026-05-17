# Cross-browser QA — clinic journey (reference)

> **Reference only.** Automated runbook + findings from headless checks. Re-run after major UI or analytics changes.

## How to re-run

```bash
# Production (default base URL in script)
npx tsx scripts/cross-browser-site-audit.ts

# Or explicit
BASE_URL=https://www.dentago.co.uk npx tsx scripts/cross-browser-site-audit.ts

# Local (with `npm run start` on that port)
BASE_URL=http://127.0.0.1:3000 npx tsx scripts/cross-browser-site-audit.ts
```

npm alias: `npm run test:browsers`

**Engines:** Chromium, Firefox, WebKit (Playwright). **Edge:** on macOS the script probes `channel: "msedge"`; install Edge locally if you need that row in the matrix.

**Scope (anonymous):** `/`, search, product (first hit from `/api/search`), `/signup`, `/cart`, `/watch`, `/demo`, `/terms`, `/privacy`, `/blog`, `/os/login`, `/admin/login`, `/supplier`, `/orders`, `/dashboard`, `/clinic/suppliers`. Authenticated clinic flows are not exercised here — add cookies or a dedicated Playwright project when you want full signed-in coverage.

## Run log — 2026-05-05 (https://www.dentago.co.uk)

| Severity | Area | Browsers | Finding |
|----------|------|----------|---------|
| **P0** | Admin | Chromium, Firefox, WebKit | `/admin/login` hits **too many redirects** when `ADMIN_SECRET` is set (307 loop to `?from=/admin/login`). Confirmed with `curl -I`. **Fix:** ensure middleware treats `/admin/login` (and trailing-slash variants) as public — repo normalizes pathname; **deploy** and re-verify. |
| **P1** | Next.js prefetch | Chromium, WebKit | Console: `404` on `https://www.dentago.co.uk/onboarding/step1.html?_rsc=…` and `…/onboarding/login.html?_rsc=…`. Plain GET to those URLs returns **200** (static `public/onboarding/*.html`). **Cause:** `<Link>` from App Router prefetches **RSC** flights; there is no matching app route for those paths, so Flight requests 404. **Mitigation:** replace with `<a>`, add `prefetch={false}` on `Link`, or migrate onboarding to `app/` routes. |
| **P1** | Analytics | Firefox | GA cookies `_ga` / `_ga_56PWNL0V42` rejected for **invalid domain** on `www.dentago.co.uk`. **Check:** GA4 web stream domain list (include `www.dentago.co.uk` / cross-domain if using apex), and tag installation domain. |
| **P2** | Third-party assets | Firefox | Homepage best-seller image `cranberryglobal.com/.../Carbon-100_3D.png` logs **Image corrupt or truncated** (supplier CDN / CORS / file). Consider self-hosting or a different asset URL. |
| **P2** | Embeds | Firefox | Calendly iframe: third-party **SameSite** cookie warnings — expected noise in strict tracking environments; not a Dentago code bug. |
| **P2** | Console | Firefox | `JSHandle@object` console error from embed/third script — capture source in DevTools if it recurs. |

**Pass (no issues in this pass):** `/os/login` loads; main marketplace pages return 200; WebKit did not show the GA cookie noise (browser-specific).

## Follow-ups

1. Land middleware pathname normalization + confirm `/admin/login` no longer loops in production.
2. Decide on onboarding link strategy (`prefetch={false}` vs App routes) to clear RSC 404 noise and improve perceived performance.
3. Audit GA4 **Web stream** domains for `www` + apex.
4. Optional: extend `scripts/cross-browser-site-audit.ts` to log `requestfailed` URLs and to run signed-in flows with stored state.

## Related `/os` items

- **Product:** activation / onboarding checklist specs — [`specs/add-onboarding-checklist.md`](../specs/add-onboarding-checklist.md)
- **Agents:** “Fix 404s” / analytics specs if you file queue items
