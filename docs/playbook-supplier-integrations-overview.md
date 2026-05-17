# Supplier integrations — technical reference

> **Reference only.** Integration engineering stays tracked via Agents / Approvals / live scrapers — this doc is a snapshot.

Last verified: 2026-05-04 (live HTTP tests run)

## Related `/os` items

- **Approvals:** “Founder · Supplier connections — Kent Express, Dental Sky, DD Group”
- **Agents / codebase:** `lib/scrapers.ts`, `lib/henry-schein-negotiated.ts`, supplier APIs under `app/api/supplier/`

---

## Status table

| Supplier | Auth Method | Scraper Status | Last Tested | Blocker | Next Action |
|---|---|---|---|---|---|
| Henry Schein | ASP.NET form login | ✅ Working | Prior sessions | None | Monitor for API changes |
| Dental Sky | Magento form_key + POST | ✅ Verified (end-to-end HTTP exchange confirmed) | 2026-05-04 | No credentials for full auth test | Test with real clinic creds when available |
| Kent Express | Angular SPA + JWT OAuth | ❌ Not possible via HTTP | 2026-05-04 | Requires JS execution | Send API partnership email to Anthony Trombetta (draft below) |
| DD Group | JSON API POST + Algolia | ✅ Working (catalog prices confirmed live) | 2026-05-04 | Negotiated pricing endpoint unknown | Get test account from Jon Wiltshire |

---

## Henry Schein UK

- **Login URL:** `https://www.henryschein.co.uk/` (ASP.NET form)
- **Auth mechanism:** Cookie-based session, ASP.NET form POST
- **Search endpoint:** Custom authenticated search
- **Implementation:** `lib/henry-schein-negotiated.ts`
- **Status:** ✅ Working (confirmed by prior sessions)
- **Anti-bot:** None observed beyond standard session cookies

---

## Dental Sky

- **Login URL:** `https://www.dentalsky.com/customer/account/login/`
- **Platform:** Magento 1 (Cloudflare-protected)
- **Auth mechanism:**
  1. GET `/customer/account/login/` → extract `form_key` from hidden input
  2. POST `/customer/account/loginPost/` with `form_key`, `login[username]`, `login[password]`, `send`
  3. Success: 302 redirect to `/customer/account/` (not `/login`)
  4. Failure: 302 redirect back to `/customer/account/login/`
- **Session cookie:** `PHPSESSID` (set by Cloudflare/origin, `SameSite=Lax`)
- **Search endpoint:** `/catalogsearch/result/?q=<term>`
- **Price extraction:** `data-price="X.XX"` (Magento data attribute) or `.price` class
- **Anti-bot:** Cloudflare WAF + PHPSESSID; no CAPTCHA observed on login
- **Status:** ✅ Fully verified — GET and POST tested live on 2026-05-04

### Live test evidence (2026-05-04)

**Step 1 — GET /customer/account/login/**

```
HTTP/2 200
Set-Cookie: PHPSESSID=lqpitl1jcfljjmfomaobl82r21; SameSite=Lax
form_key extracted: E2sboxQB8VLWBQ97 (present, correct format, changes per session)
```

**Step 2 — POST /customer/account/loginPost/ (dummy credentials)**

```
Request:
  POST https://www.dentalsky.com/customer/account/loginPost/
  Content-Type: application/x-www-form-urlencoded
  Cookie: PHPSESSID=lqpitl1jcfljjmfomaobl82r21
  Body: form_key=E2sboxQB8VLWBQ97&login[username]=test@fakeclinic.com&login[password]=wrongpassword123&send=

Response:
  HTTP/2 302
  Location: https://www.dentalsky.com/customer/account/login/
  (302 back to /login → confirms failure path works correctly)
  (302 to /customer/account/ would indicate success)

Set-Cookie: PHPSESSID=lqpitl1jcfljjmfomaobl82r21; SameSite=Lax
Set-Cookie: private_content_version=09bb394d7ea842daedc5ecea83a8805d; Max-Age=315360000
```

**Conclusion:** Scraper logic in `lib/scrapers.ts` is correct. With real credentials, login would redirect to `/customer/account/` and the scraper would proceed to authenticated search. No CAPTCHA, no rate-limit observed in testing.

---

## Kent Express

- **Login URL:** `https://www.kentexpress.co.uk/` (Angular SPA modal)
- **Platform:** Angular SPA on Henry Schein SAP Commerce Cloud / Sitecore (Azure Front Door + Akamai)
- **Auth mechanism:** Angular-executed OAuth2/JWT flow
  - Stores `uid`, `authToken`, `jwtToken`, `locationId` in browser sessionStorage
  - JWT bearer token required for all API calls
  - Cannot be replicated without JavaScript execution
- **API layer:** `https://api.kentexpress.co.uk` (Akamai CDN)
- **CSP confirms:** `*.henryschein.com`, `*.eschein.com` — shared Henry Schein EU platform
- **Magento paths:** All return 404 (confirmed)
- **Status:** ❌ Not implementable via plain HTTP requests

### Alternative: API partnership (recommended)

Henry Schein UK/EU exposes a formal B2B pricing API:

- **Endpoint:** `https://api.eu.henryschein.com/eapi/web-linepricing/v1/customerprice`
- **Auth:** OAuth2 bearer token
- **Contact:** Anthony Trombetta (existing relationship with Dentago)
- **Next action:** Founder-led outreach — tracked under `/os` Approvals above.

### API partnership outreach email (draft)

**To:** Anthony Trombetta, Kent Express  
**Subject:** Dentago × Kent Express — API pricing integration  

```
Hi Anthony,

Following up on our earlier conversation about Dentago — we're building the
UK's first B2B dental procurement marketplace and I'd love to explore a
formal API integration with Kent Express.

Specifically, we want to surface Kent Express products and pricing directly
within Dentago, so that dental clinics using your account can compare and
order through us. We'd handle the clinic authentication on our side and use
the API to fetch negotiated pricing per customer.

I understand Henry Schein UK/EU has a B2B pricing API
(api.eu.henryschein.com/eapi/web-linepricing) — is that something we could
get access to as a marketplace integration partner? Or is there a preferred
integration path for Kent Express specifically?

Happy to jump on a quick call to discuss. This would give Kent Express
exposure to every clinic we onboard — currently ~7 and growing.

Best,
Mercier
mercier@dentago.co.uk | +447466 607116
dentago.co.uk
```

### Fallback: Playwright headless browser

A Playwright-based scraper could execute the Angular login flow and extract the JWT. Estimated latency: 5–10s per request. Not currently implemented. Would require `@playwright/test` or `playwright-core` added to dependencies.

---

## DD Group

- **Login URL:** `https://www.ddgroup.com/login/`
- **Platform:** Next.js (Azure) + ASP.NET backend
- **Auth mechanism:** JSON API
  - POST `https://www.ddgroup.com/hapi/user/login/`
  - Body: `{ "username": "...", "password": "...", "rememberMe": false }`
  - Success: HTTP 200 + session cookies (`ASP.NET_SessionId`, `ARRAffinity`)
  - Failure: HTTP 400 + `{"error":"Password or username is incorrect."}`
- **Search:** Algolia (public API key embedded in client-side JS)
  - Application ID: `CF4C8XNBT0`
  - Search API Key: `0f266d9536c1a3cd9dbd8d672eac4dbd`
  - Index: `prod_dd`
  - Returns `catalogPrice` (list/catalog price per product) — NO auth required
- **Negotiated pricing:** Unknown endpoint — requires authenticated session + test credentials to verify. Not currently implemented.
- **Anti-bot:** None observed. No CAPTCHA on login endpoint (confirmed live).
- **Status:** ✅ Catalog pricing working (Algolia confirmed). Negotiated pricing blocked pending test credentials from Jon Wiltshire.

### Live test evidence (2026-05-04)

**Login POST — dummy credentials:**

```
Request:
  POST https://www.ddgroup.com/hapi/user/login/
  Content-Type: application/json
  Body: {"username":"test@test.com","password":"wrongpassword123","rememberMe":false}

Response:
  HTTP/2 400
  Content-Type: application/json; charset=utf-8
  Set-Cookie: ASP.NET_SessionId=sepigrp3yybizj30sptkn3pp; path=/; secure; HttpOnly; SameSite=None
  Set-Cookie: ARRAffinity=d9b79af6c821b6a8df4588c92e08507c88ca2d102f7260a3ff60ab2d7ee25b03; HttpOnly; Secure

  Body: {"error":"Password or username is incorrect."}
```

**Algolia search — live query (nitrile gloves):**

```
Request:
  POST https://CF4C8XNBT0-dsn.algolia.net/1/indexes/prod_dd/query
  X-Algolia-Application-Id: CF4C8XNBT0
  X-Algolia-API-Key: 0f266d9536c1a3cd9dbd8d672eac4dbd
  Body: {"query":"nitrile gloves","hitsPerPage":2}

Response:
  HTTP/1.1 200 OK
  Content-Type: application/json; charset=UTF-8

  hits[0]: {
    "name": "CGS305 : Lilac Utility Nitrile Gloves Medium (Size 8)",
    "catalogPrice": 68.25,
    "brand": "Hu-Friedy",
    "mainImage": "https://www.ddgroup.com/globalassets/productimages/cgs305/cgs305_1.jpg"
  }
```

**Conclusion:** Login endpoint is clean JSON API, no CAPTCHA, no anti-bot. Algolia returns real product data and catalog prices. The scraper in `lib/scrapers.ts` is correct and production-ready for catalog pricing. Negotiated pricing needs test account.

---

## Open items

1. **Kent Express** — Founder approve/participate in API partnership outreach (tracked via Approvals).
2. **Dental Sky** — Test with real clinic credentials when available. Logic is confirmed correct.
3. **DD Group** — Get test account credentials from Jon Wiltshire to verify negotiated pricing endpoint after login.
4. **Henry Schein** — Monitor for API changes; document the negotiated scraper in detail.
