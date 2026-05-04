# TeeWeathr — Infrastructure, Cost & Reliability Plan

This document records the architectural initiatives we've taken (and still need
to take) to keep the embed widget reliable, accurate, and cheap to run as
traffic scales.

It exists because the widget is keyless-by-default — anyone can paste an
`<iframe>` from `EMBED.md` into any site without signing up. Without
intentional defenses, that's a Vercel/Firebase bill waiting to happen.

---

## Goals

1. **Reliability** — golfers see fresh, accurate forecasts. Stale data or
   missing severe-weather alerts erodes trust and can mislead decisions.
2. **Accuracy** — caching can never reduce the precision NWS itself provides.
3. **Cost containment** — bounded per-course infra cost regardless of how
   popular any single embedder becomes.
4. **Observability** — we know who's hitting us, how much, and from where,
   before a bill arrives.

---

## The five-layer defense model

Every request should die at the earliest layer that can stop it. Layers are
ordered from cheapest (CDN) to most expensive (application logic).

| # | Layer | Purpose | Status |
|---|---|---|---|
| 1 | Edge cache (Vercel CDN) | Same URL, same region → no function wakes up | Partial |
| 2 | Upstream-fetch cache (Next Data Cache) | One NWS / Firestore call per (key, hour) regardless of how many functions wake | Done for NWS, partial for Firestore |
| 3 | Rate limiting (proxy + KV) | Per-IP and per-key request caps before the function runs | Not started |
| 4 | Firewall (Vercel Pro) | IP block list, country rules, bot challenges | Not started |
| 5 | Per-customer quotas (app logic) | Tier-based monthly caps on origin fetches | Not started |

---

## Current state of the codebase (audit baseline)

Captured before this round of work began.

| Concern | Where | Finding |
|---|---|---|
| NWS fetch caching | `src/app/api/weather/route.ts` | No revalidation — every iframe load = 3 NWS calls |
| Per-load Firestore reads | `src/app/api/embed/[apiKey]/route.ts` | ≥3 reads per keyed embed load (business query, course doc, embedConfig doc) |
| Per-load Firestore writes | `src/app/embed/page.tsx` analytics beacon | Write on every view + every interaction + every referral click |
| Rate limiting | `src/proxy.ts` | Only matches `/admin` and `/dashboard` for login redirects — API routes are wide open |
| Coordinate validation | `src/app/api/weather/route.ts` | Raw passthrough — vulnerable to coord-rotation cache busting |
| Active weather alerts | `src/app/api/weather/route.ts` | Not fetched — lightning/severe-weather warnings invisible to widget |
| Spend alerts | Vercel + Firebase dashboards | Status unknown — must be enabled |

---

## Implemented in this round

### 1. NWS fetch caching with gridpoint-friendly normalization

`src/app/api/weather/route.ts`

- Each NWS `fetch` now passes `next.revalidate` so the Next Data Cache
  deduplicates upstream calls.
- `/points/{lat},{lon}` cached for 24 hours — gridpoint mapping is
  geographic and effectively static.
- `/gridpoints/{id}/{x,y}/forecast` and `/forecast/hourly` cached for 1 hour
  — aligns with NWS upstream refresh cadence.
- Input lat/lon normalized to 3 decimal places (~100 m precision) before
  building the points URL. **Cannot change which grid cell resolves**
  because NWS grid cells are 2,500 m on a side; rounding stays well within
  one cell. This boosts cache hit rate when two courses are <100 m apart
  or when a user submits floating-point noise on the same coordinate.
- Response carries `Cache-Control: public, s-maxage=3600,
  stale-while-revalidate=86400` so Vercel's CDN edge serves repeat hits
  without waking the function at all.
- Fetches are tagged `"nws"` so a future cron or admin tool can trigger a
  manual refresh via `revalidateTag("nws")`.

**Net effect at 1 M iframe loads / month:** roughly 720 NWS calls per course
(one per hour) instead of ~3 M, and the function only wakes for cache misses.

### 2. CDN cache on the keyed embed config endpoint

`src/app/api/embed/[apiKey]/route.ts`

- Response carries `Cache-Control: public, s-maxage=600,
  stale-while-revalidate=3600`. The 10-minute `s-maxage` gives a balance
  between absorbing repeat impressions and reflecting dashboard changes
  reasonably quickly.
- Dashboard mutations should call `revalidateTag` (TODO once we tag the
  config response) for instant invalidation when a customer changes their
  branding or accent color. Today, customers wait up to 10 minutes for the
  CDN to expire.

### 3. Visible freshness indicator

`src/app/embed/page.tsx`

- Compact, medium, and full views now show "Updated H:MM AM/PM" derived
  from the NWS `generatedAt` timestamp. Skipped on micro (no room).
- Reinforces trust and makes it obvious when a cached response is being
  served.

### 4. NWS active alerts integration

`src/app/api/alerts/route.ts` (new), `src/lib/types.ts`, `src/app/embed/page.tsx`

- New `/api/alerts` route fetches `https://api.weather.gov/alerts/active?point={lat},{lon}`
  with a 5-minute cache (`next.revalidate: 300`, `Cache-Control: s-maxage=300,
  stale-while-revalidate=300`). Short enough to react to fast-moving weather,
  long enough that mass impressions don't hammer NWS.
- Tagged `"nws-alerts"` so a future cron / admin tool can call
  `revalidateTag("nws-alerts", "max")` for instant invalidation.
- Server-side classifier sorts alert events into three buckets:
  - **blocking** — Tornado Warning, Severe Thunderstorm Warning, Flash Flood
    Warning, Hurricane Warning, Tropical Storm Warning, Extreme Wind Warning,
    plus anything else with severity Extreme/Severe.
  - **warning** — corresponding watches, Heat Advisories, Wind Advisories,
    Winter Storm warnings, plus anything else with severity Moderate.
  - **info** — everything else (filtered out before reaching the client).
- Failures degrade silently (`{ alerts: [] }` with a 60s cache) so a 500 from
  NWS never blocks the widget.
- Embed page fetches alerts in parallel with weather. New `AlertBanner`
  component renders the most severe alert above the verdict in compact,
  medium, and full views (red for blocking, amber for warning).
- When a blocking alert is active, the verdict status icon is forced to the
  red `ShieldX` regardless of the underlying score — wind/temp may still be
  fine, but a tornado warning overrides "B+, go play."

**Net effect:** lightning-on-a-golf-course (the canonical case for this whole
product) is now a top-of-widget red banner that you cannot miss, refreshed
every 5 minutes.

### 5. Firestore-backed embed config caching with revalidateTag

`src/app/api/embed/[apiKey]/route.ts`,
`src/app/api/admin/businesses/[id]/courses/route.ts`,
`src/app/api/admin/courses/route.ts`,
`src/app/api/subscription/webhook/route.ts`

- Extracted the Firestore-touching logic into a pure
  `loadEmbedConfigUncached(apiKey, courseId)` helper that returns a
  discriminated `EmbedConfigResult`. Internal exceptions throw (so transient
  Firestore failures are not memoized); known outcomes — invalid key, missing
  course, success — return as plain values that *are* safe to cache.
- Wrapped the helper with `unstable_cache` from `next/cache`. Cache key is
  `["embed-config-v1", apiKey, courseId]`. Revalidation is 600 s, matching
  the CDN `s-maxage` so the two layers stay aligned.
- The wrapper carries a single `EMBED_CONFIG_TAG = "embed-config"` exported
  constant. Server-side mutations that affect a customer's cached response
  call `revalidateTag(EMBED_CONFIG_TAG, "max")` so changes propagate
  immediately:
  - **Course assignments** — `/api/admin/businesses/[id]/courses` POST and DELETE
  - **Course content edits** — `/api/admin/courses` PUT and DELETE
  - **Subscription tier changes** — `/api/subscription/webhook` for
    `checkout.session.completed`, `customer.subscription.updated`,
    `customer.subscription.deleted`
- Invalid-key and course-not-found responses are themselves cached (briefly,
  60 s at the CDN) so an attacker probing random keys hits Firestore once
  per key, not once per probe.
- Note: in Next 16, `revalidateTag` requires a second `swr` argument
  (e.g. `"max"`); single-arg calls fail to type-check. The doc-level
  caching guide mentions this is "recommended" — the framework now
  enforces it.

**Net effect on cache miss:** instead of 3 Firestore reads per cache miss
(business query + course doc + embedConfig doc), we get 0 reads as long as
the result is in the data cache — same business + course will only hit
Firestore once per 10 min per region, regardless of CDN cache misses.

> **Known gap:** the dashboard branding/accent UI writes directly to
> `embedConfigs` via the client Firebase SDK. Because that bypasses the
> server, those changes wait up to 10 minutes for the cache to expire on
> its own. Future work: move dashboard config saves through a thin API
> route that writes the doc + calls `revalidateTag`.

### 6. Batched analytics writes

`src/lib/embed-analytics.ts` (new), `src/app/api/embed/analytics/route.ts`,
`src/app/embed/page.tsx`

- New client-side queue: events accumulate in module-scope memory, flush as a
  single batched POST. Triggers:
  - Debounced timer (3 s after the most recent enqueue)
  - `visibilitychange` to `hidden` (user switching tabs)
  - `pagehide` (tab/iframe being torn down) — uses `navigator.sendBeacon`
    when available so events survive unload
  - Hard cap of 20 events to flush immediately if a widget is somehow firing
    a flood of interactions
- Server route now accepts both shapes:
  - Legacy: `{ apiKey, courseId, event }` — single event (back-compat)
  - Batch:  `{ apiKey, courseId, events: [event, ...] }` — up to 100 events
- Server tallies counts per event type, then issues **one** Firestore
  `set({ merge: true })` call with multiple `FieldValue.increment(count)`
  fields. So a 20-event batch = 1 write, not 20.
- Unknown event types are silently dropped server-side so a malformed client
  can't pollute the analytics doc with arbitrary fields.

**Net effect:** at typical browse patterns (1 view + a couple of interactions
per session), each session collapses to ~1 Firestore write instead of ~3.
Bursty users (clicking through multiple days) collapse even further. Combined
with the existing monthly aggregation, 1M widget loads/month produces on the
order of single-digit thousands of Firestore writes, not millions.

### 7. Micro view alert treatment

`src/app/embed/page.tsx`

- `MicroView` now accepts an `alert` prop. When a blocking alert is active,
  the grade letter is forced to red, a `ShieldX` icon precedes the course
  name, and the second line is replaced with the alert event name in red
  (e.g. "Tornado Warning · 64°"). For warning-level alerts, the second line
  goes amber.
- Closes the gap from item 4: every widget size now signals NWS alerts.

### 8. Structured JSON logger + applied to touched routes

`src/lib/logger.ts` (new), `/api/weather`, `/api/alerts`, `/api/embed/[apiKey]`

- New zero-dependency `logger` that emits a single JSON line per event with
  `ts`, `level`, `msg`, plus arbitrary context. Vercel runtime logs and any
  log drain parse JSON natively.
- `warn` and `error` go to stderr so Vercel surfaces them appropriately.
- Defensive stringify so a circular-reference context can't crash a handler.
- Replaced `console.error` calls in routes I've touched in this initiative.
  Other routes can migrate incrementally — adding now would balloon scope.

### 9. Dashboard embed-config save endpoint

`src/app/api/dashboard/embed-config/route.ts` (new),
`src/components/embed-configurator.tsx`

- New `PATCH /api/dashboard/embed-config` route. Validates the customer's
  session, confirms they own the requested course, validates `theme` /
  `accent` against allow-lists, writes `embedConfigs/{businessId}_{courseId}`,
  and calls `revalidateTag(EMBED_CONFIG_TAG, "max")` so the change shows up
  on the next keyed embed render — no 10-min lag.
- `hideBranding` is enterprise-only and silently ignored for other tiers, so
  a stale UI on a downgraded plan doesn't error.
- Configurator UI: added a "Save as default for this course" button next to
  the theme/accent controls. Visible only when the customer has an `apiKey`
  (i.e. is a paid tier with keyed embed). Shows saving / saved / error states
  with a 2.5 s confirmation flash.

### 10. Rate limiting in the Proxy (Upstash)

`src/lib/ratelimit.ts` (new), `src/proxy.ts`,
deps: `@upstash/ratelimit`, `@upstash/redis`

- Public API routes (`/api/weather`, `/api/alerts`, `/api/ads/serve`,
  `/api/embed/*`) now run through `proxy.ts` for rate-limit checks before
  the function or the data cache wakes up. CDN-cached responses still skip
  the proxy entirely, so the limiter only kicks in on cache misses + writes
  — exactly where cost lives.
- Default policy: sliding window of 60 requests / minute per client IP.
  Breaches return `429 Too Many Requests` with `Retry-After`,
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers.
- `BLOCKED_IPS` env var (comma-separated) is the immediate "block this jerk
  now" lever — checked before the limiter, returns 403 instantly. Useful
  before standing up Vercel Firewall.
- **Fail-open by design.** If `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` are missing, or Upstash is unreachable, every
  request is allowed. Rate limiting is a cost defense, not an availability
  layer — a misconfigured limiter must never take the site down.
- Per the Next 16 proxy docs: `fetch` `cache` / `next.revalidate` /
  `next.tags` options have no effect inside proxy. Upstash's REST client is
  built for exactly this shape (single small roundtrip, ~5–15 ms from
  Vercel Edge).
- 429 events are emitted via the structured logger (`route`, `ip`, `reason`,
  `limit`) so we can spot abuse patterns once log drains are wired up.

### 12. Tier consolidation + new pricing structure

`src/app/pricing/page.tsx`, `src/app/page.tsx`

- Public tier list shrinks to **Free / Pro $19.99/mo / Multi-course (Custom)**.
  The "up to 3 courses" pseudo-tier was a poor fit for golf (~95% of US
  courses are single-property, owner-operated) and gets removed.
- Multi-course is now a "Contact us" tier with a `mailto:` CTA — manual
  sales process appropriate for management groups, resorts, and
  multi-property operators who want custom contracts and invoicing.
- Internal tier identifier in Firestore (`subscription.tier`) stays
  `"enterprise"` for the multi-course tier — public-facing label is
  "Multi-course" but the backend identifier is unchanged so the webhook,
  embed config endpoint, and feature flags didn't need to be touched.
- Stripe `STRIPE_PRO_PRICE_ID` updated to a $19.99/mo price; existing
  enterprise prices are kept in `PLANS` (hidden from `/pricing`) so private
  checkout links can still be sent to multi-course leads.

### 15. Lock down `/api/businesses` to admin role + EMBED.md rewrite

`src/app/api/businesses/route.ts`, `EMBED.md`, removed `public/embed-tester.html`

- `/api/businesses` POST and GET now both require `user.role === "admin"`
  via a shared `requireAdmin()` helper. Self-serve signup goes through
  `/api/auth/signup`; this admin path stays for manual creation from the
  admin UI but no longer accepts unauthenticated traffic.
- `EMBED.md` rewritten under the keyed-only model:
  - Opens by directing readers to `/signup` for an API key, with a note
    that the live demo on the landing page works without signup for
    visual verification.
  - Each size pattern has a single example using `YOUR_API_KEY` placeholder
    — no more 8 keyless variants.
  - URL parameter table reduced to `key` (required) and `course` (optional);
    the "key is optional" caveat from the old version is gone.
  - Tier-features are described as "server-resolved" so customers know
    they don't need to change their snippet to flip ads/branding.
  - Reference to the public embed tester page removed.
- `public/embed-tester.html` deleted. The dashboard configurator
  (`/dashboard/embed`) covers the same ground for actual customers, and
  the landing page demo covers public verification.

### 14. Self-serve signup with reCAPTCHA + post-signup welcome

`src/lib/recaptcha.ts` (new), `src/app/api/auth/signup/route.ts` (new),
`src/app/signup/page.tsx` (new), `src/app/dashboard/welcome/page.tsx` (new),
`src/app/dashboard/welcome/copy-key-button.tsx` (new)

- New `/signup` page mirrors the existing `/login` flow shape:
  - Client uses Firebase Auth's `createUserWithEmailAndPassword`
  - Loads reCAPTCHA v3 script when `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is set
  - On submit: creates the Firebase user → gets ID token → fetches a
    reCAPTCHA token → POSTs both + business name to `/api/auth/signup`
  - On success: redirects to `/dashboard/welcome` (Free) or
    `/api/subscription/checkout?plan=pro` (Pro signup with `?plan=pro`
    query param)
- Server endpoint `/api/auth/signup`:
  1. Verifies the reCAPTCHA token via Google's siteverify (action =
     `"signup"`, score threshold 0.5).
  2. Verifies the Firebase ID token to extract the uid + email.
  3. Idempotency: if a business already exists for this uid, returns it
     without creating a duplicate.
  4. Creates the business doc with auto-generated `embedApiKey` (UUID),
     `subscription.tier: "free"`, empty `courseIds`.
  5. Sets the `__session` cookie via `adminAuth.createSessionCookie`.
- New `src/lib/recaptcha.ts` is the server-side verifier:
  - Fail-open if `RECAPTCHA_SECRET_KEY` is missing (dev / preview without
    the key still works).
  - Fail-open on Google network/parse errors (better to let real users
    through than block everyone if Google has a bad minute).
  - Hard fail on missing token, verify failure, action mismatch, or score
    below 0.5.
- `/dashboard/welcome` is the single first-run landing:
  - Banner if no courses are assigned, pointing to `/dashboard/courses`
  - The new API key with a small client-side copy button
  - The pre-filled iframe snippet to paste
  - Quick-action cards to embed configurator / analytics / dashboard home

> **You'll need to set this up** to actually verify reCAPTCHA in prod:
> 1. Register a v3 reCAPTCHA at <https://www.google.com/recaptcha/admin>
>    with your domain(s).
> 2. Add `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` to
>    Vercel env vars.
> 3. Redeploy. Until then, signup works without reCAPTCHA verification
>    (the verifier no-ops silently).

### 13. Public demo business + key on the landing page

`src/lib/demo.ts` (new), `src/app/api/admin/setup-demo/route.ts` (new),
`src/app/api/embed/analytics/route.ts`, `src/app/page.tsx`

- `src/lib/demo.ts` exports stable public constants:
  `DEMO_API_KEY = "tw_demo_pebble"`, `DEMO_BUSINESS_ID = "teeweathr-demo"`,
  `DEMO_COURSE_ID = "teeweathr-demo-pebble"`, plus `DEMO_COURSE` data
  (Pebble Beach Golf Links, real coordinates).
- New `POST /api/admin/setup-demo` endpoint provisions/refreshes the demo
  business + course documents in Firestore. Idempotent (uses merge-set),
  admin-only, bumps `EMBED_CONFIG_TAG` so any stale cache entry is busted
  on the next request.
- Demo business carries `isDemo: true` plus `subscription.tier: "free"`.
  The free-tier flags drive ad rendering automatically — landing-page
  visitors see the same widget free customers will.
- Analytics endpoint short-circuits on `isDemoApiKey(apiKey)` and returns
  204 immediately — landing-page traffic never hits Firestore. Cheap
  string compare, no DB lookup needed.
- Landing page snippet block now renders the real `DEMO_API_KEY` at
  server-render time instead of the placeholder `tw_live_xxxx`. Visitors
  can paste the snippet into any page and it works.

> **One-time setup step:** after deploy, an admin must hit
> `POST /api/admin/setup-demo` once to provision the demo docs. Easiest:
> from the admin console, or `curl -X POST -H "Cookie: __session=…"
> https://teeweathr.com/api/admin/setup-demo`. Re-running is safe.

### 11. Admin "morning glance" overview page

`src/app/admin/page.tsx`

- Replaced the 3-card overview with a richer dashboard organized into
  inventory, tier distribution, MTD activity (keyed embeds), top customers,
  and recent signups sections — every tile sourced from existing Firestore
  data, no log drain required.
- Wrapped the overview reads in `unstable_cache` with a 30 s TTL +
  `"admin-overview"` tag, so an admin refresh-spamming the page can't fan
  out 10× Firestore reads. Future mutations that should reflect instantly
  call `revalidateTag("admin-overview", "max")`.
- Top-customers list aggregates by `apiKey` across the current month's
  analytics docs in JS (Firestore can't GROUP BY). For our scale (tens of
  customers, hundreds of analytics docs / month) this is fast.
- Page includes a "Coming next" hint at the bottom for the metrics that
  legitimately need a log drain (cache hit %, 5xx, top IPs, 429 rate).
  These can't be sourced from Firestore — they live in Vercel runtime logs.

> **Phase 2 — log drain wiring (not yet shipped):** to populate the rest of
> the morning-glance tiles, drain Vercel runtime logs to a queryable store.
> BetterStack / Logtail (~$10/mo) is the cheapest option that supports JSON
> log parsing out of the box. The structured logger introduced in
> initiative 8 already emits the right shape — once a drain is wired up,
> queries like `level=warn AND msg=rate_limit_blocked` and
> `level=error AND msg=nws_*_failed` give you the missing tiles.

> **You need to set this up to actually rate-limit:**
> 1. Create an Upstash Redis database (free tier is plenty for the limiter
>    — ~10 k commands/day = ~7 req/min sustained, far more than the limiter
>    actually consumes).
> 2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your
>    Vercel project's environment variables (all environments).
> 3. (Optional) Set `BLOCKED_IPS` to a comma-separated list of IPs to
>    hard-block.
> 4. Redeploy. Until step 2 is done, the limiter no-ops silently.

---

## Still to do (in priority order)

### Now / next

1. **Enable Vercel spend alerts and Firebase budget alerts.** Dashboard-only
   action — this is the single cheapest piece of insurance available.
2. **Provision Upstash and set rate-limit env vars.** Code is in place;
   limiter is no-op until `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN` are configured in Vercel. Free tier is
   sufficient for our volume.
3. **Migrate remaining routes to structured logger.** Routes touched in
   this initiative use `logger`; older routes still use `console.error`.
   Migrate as they're edited rather than in a big-bang sweep.

### Soon

4. **Per-key rate-limit tiers.** Today the proxy applies one anonymous-IP
   limit (60/min) to every public API route. To give paid customers higher
   ceilings, the proxy needs to resolve the API key → tier without hitting
   Firestore on every request. Two options:
   - Carry tier in a JWT-style key string (e.g. `tw_pro_…`) so the proxy
     can decode it without network I/O.
   - Cache `apiKey → tier` in Upstash itself with a short TTL, populated
     by the existing `loadEmbedConfig` cache hit.

5. **Server-side coordinate bounds check.** Reject lat/lon outside NWS
   coverage (CONUS + AK/HI/PR/Guam) early to defeat coord-rotation cache
   attacks. Today we let NWS reject — works, but burns one upstream call.

### Later

6. **Vercel Firewall (Pro plan, ~$20/mo)** — IP block list, country rules,
   custom bot challenges. Worth the upgrade once we see real abuse beyond
   what `BLOCKED_IPS` can handle.
7. **Per-key monthly quotas** — counter in KV (or Firestore, if we keep
   per-tier limits coarse). Increment only on cache miss so we don't punish
   keys for popular embeds. Surface usage in the dashboard.
8. **Admin observability page** — top 20 IPs, top 20 referrer domains,
   cache hit rate, NWS calls/hour, 429 rate. Pulls from runtime logs /
   log drains.
9. **Cron-driven cache warming** — a Vercel cron that hits
   `revalidateTag("nws", "max")` once an hour ensures the very first user
   after NWS publishes new data triggers the refetch in the background,
   not in the foreground.

---

## Things I learned about Next 16 while doing this

The framework documentation in `node_modules/next/dist/docs/` is the source
of truth — these notes summarize what I checked.

- **Middleware is now Proxy.** `src/proxy.ts` (not `src/middleware.ts`).
  Same shape: optional default or named `proxy` export, plus a
  `config.matcher`. Existing file is correct.
- **`fetch` cache options have no effect inside Proxy** — explicit per the
  Next 16 docs. Caching belongs in route handlers / cached helpers.
- **Cache Components is opt-in.** Setting `cacheComponents: true` in
  `next.config.ts` switches the project to the new model with `'use cache'`
  + `cacheLife()`. We have NOT enabled this — it's a project-wide
  migration where every uncached data read needs a Suspense boundary or a
  `'use cache'` helper.
- **Previous-model caching still works.** `fetch(url, { next: { revalidate
  } })` still works in route handlers; route-level `export const revalidate
  = 3600` still works. That's what we use today.
- **`'use cache'` cannot be used directly inside a Route Handler body** —
  must be in a helper function. Keep this in mind if we ever migrate to
  Cache Components.
- **`request.nextUrl.searchParams` in Route Handlers is synchronous.** Don't
  confuse it with the page-level `searchParams: Promise<...>` prop, which
  is async in Next 16. The route handler API has not changed.

---

## NWS-specific notes

- **Gridpoints are 2.5 km × 2.5 km.** Whatever lat/lon precision you send
  to `/points`, the response resolves to one grid cell. Two courses 500 m
  apart usually share the same forecast.
- **Forecast refreshes ~hourly upstream**, sometimes more often near-term.
  A 1-hour cache aligns with their cadence — we never serve data older
  than NWS itself has.
- **Active alerts (`/alerts/active`) are a separate endpoint** and should
  not be cached aggressively. Lightning, severe-thunderstorm, tornado, and
  flood warnings live there.
- **NWS does not require an API key** but requires a `User-Agent` header
  identifying the app. Currently `TeeWeathr/1.0 (golf-weather-app)`.
- **NWS will rate-limit by IP** if abused. Hammering them from one Vercel
  region without caching is a fast way to get throttled. Layer 2 caching
  is what protects us here.

---

## Cost ballparks (orders of magnitude, not quotes)

Assumes one moderately popular embedder driving 1 M iframe loads/month.

| Without caching | With caching (now) |
|---|---|
| ~3 M NWS calls (will get throttled) | ~720 NWS calls/course (one/hour) |
| ~1 M Vercel function invocations | Cache misses only — hundreds/course |
| ~3 M Firestore reads (keyed path) | Hundreds/month after CDN cache |
| ~1 M Firestore writes (analytics) | Single-digit thousands — batched and aggregated |

Reference free-tier limits:
- Vercel Hobby: 100 GB bandwidth/mo, 100 k function invocations/mo
- Vercel Pro: $20/mo, generous overages, includes Firewall
- Firebase Spark (free): 50 k Firestore reads/day, 20 k writes/day
- Firebase Blaze (pay-go): ~$0.06/100 k reads, ~$0.18/100 k writes

The "without caching" column hits Hobby caps in days and Spark caps in
hours. The "with caching" column should comfortably stay on Hobby for some
time, with Firebase being the next limit we hit (driven by analytics
writes — see TODO #4).

---

## Operational checklist

When deploying or making material infra changes, run through this list.

- [ ] Vercel spend alert configured (dashboard → Settings → Billing)
- [ ] Firebase budget alert configured (console → Settings → Usage and
      billing → Budget alerts)
- [x] Cache headers set on `/api/weather`, `/api/alerts`, and
      `/api/embed/[apiKey]`
- [x] `next.revalidate` set on every NWS `fetch` call
- [x] NWS alerts integration shipped (`/api/alerts` + `AlertBanner` UI)
- [x] Proxy matcher covers all public API endpoints
- [x] Structured logger in place (`src/lib/logger.ts`)
- [x] Dashboard config save endpoint (`/api/dashboard/embed-config`)
- [ ] Upstash Ratelimit env vars configured in Vercel project
- [ ] Admin dashboard shows recent traffic by IP/referrer (when
      observability page ships)

---

## See also

- [DATA-FLOW.md](./DATA-FLOW.md) — visual diagrams of the request lifecycle,
  cache topology, and mutation/invalidation paths. Start there if you're
  onboarding a new dev; come back here for the *why*.

## File references

- `src/app/api/weather/route.ts` — NWS forecast fetch + caching
- `src/app/api/alerts/route.ts` — NWS active-alerts fetch + classifier
- `src/app/api/embed/[apiKey]/route.ts` — keyed embed config (`unstable_cache`,
  `EMBED_CONFIG_TAG`)
- `src/app/api/embed/analytics/route.ts` — batched analytics writes
- `src/app/api/dashboard/embed-config/route.ts` — dashboard config save
- `src/components/embed-configurator.tsx` — dashboard UI + Save button
- `src/lib/embed-analytics.ts` — client queue + sendBeacon flush
- `src/lib/logger.ts` — structured JSON logger
- `src/lib/ratelimit.ts` — Upstash-backed rate limiter (fail-open)
- `src/app/admin/page.tsx` — morning-glance overview (Firestore-sourced)
- `src/lib/demo.ts` — public demo business / course / key constants
- `src/app/api/admin/setup-demo/route.ts` — idempotent demo provisioner
- `src/lib/recaptcha.ts` — server-side reCAPTCHA v3 verifier (fail-open)
- `src/app/api/auth/signup/route.ts` — self-serve signup endpoint
- `src/app/signup/page.tsx` — signup form
- `src/app/dashboard/welcome/page.tsx` — post-signup welcome screen
- `src/app/embed/page.tsx` — embed widget UI, freshness label, alert banner,
  micro-view alert treatment
- `src/lib/types.ts` — `WeatherData`, `WeatherAlert`, supporting types
- `src/proxy.ts` — Next 16 proxy with rate limiting + auth gate
- `next.config.ts` — Next config (Cache Components currently disabled)
- `EMBED.md` — public-facing iframe snippets
