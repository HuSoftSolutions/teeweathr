# TeeWeathr — Data Flow & Caching Reference

Visual reference for how data moves through the embed widget, where each
cache layer lives, and how mutations invalidate them. Companion to
`INFRASTRUCTURE.md` (which explains the *why* behind these choices).

---

## The big picture: layered request lifecycle

Every public request runs the same gauntlet. Each layer is cheaper than the
one below it; the goal is to die at the highest layer that can answer.

```mermaid
flowchart TD
    Req[Browser request] --> CDN{CDN edge cache?}
    CDN -- hit --> R1[Serve from CDN<br/>zero origin work]:::cheap
    CDN -- miss --> Proxy{Proxy: blocked IP<br/>or rate-limited?}
    Proxy -- yes --> R2[403 / 429]:::block
    Proxy -- no --> Fn[Route handler]
    Fn --> DC{Next Data Cache<br/>or unstable_cache?}
    DC -- hit --> R3[Serve from data cache<br/>no upstream call]:::medium
    DC -- miss --> Origin[Origin: NWS or Firestore]:::costly
    Origin --> Pop[Populate caches] --> R4[Fresh response]:::costly

    classDef cheap fill:#d1fae5,stroke:#10b981,color:#065f46
    classDef medium fill:#fef9c3,stroke:#facc15,color:#713f12
    classDef costly fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef block fill:#1f2937,stroke:#374151,color:#fff
```

**Reading this:** green = no infra cost, yellow = function invocation but no
external call, red = origin work (NWS or Firestore). The cache layers
together push the vast majority of traffic into green.

---

## Keyed embed: full request flow

What happens when a paid customer's `<iframe src=".../embed?key=tw_…">`
loads. Three parallel data fetches, each with its own cache strategy.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (iframe)
    participant CDN as Vercel CDN
    participant P as proxy.ts<br/>(rate limit + IP block)
    participant CFG as /api/embed/[key]
    participant W as /api/weather
    participant A as /api/alerts
    participant AN as /api/embed/analytics
    participant DC as Next Data Cache
    participant FS as Firestore
    participant NWS as api.weather.gov

    B->>CDN: GET /embed (page bundle)
    CDN-->>B: static JS/CSS

    par Config lookup
        B->>CDN: GET /api/embed/{key}?course=…
        CDN->>P: miss → proxy
        P->>CFG: rate-limit OK
        CFG->>DC: unstable_cache lookup (10 min)
        alt cache hit
            DC-->>CFG: cached config
        else miss
            CFG->>FS: businesses where embedApiKey ==
            CFG->>FS: courses/{id}
            CFG->>FS: embedConfigs/{biz_course}
            CFG->>DC: populate
        end
        CFG-->>B: tier, lat/lon, branding, ads
    and Weather forecast
        B->>CDN: GET /api/weather?lat&lon
        CDN->>P: miss → proxy
        P->>W: rate-limit OK
        W->>DC: fetch w/ revalidate (1 hr)
        alt cache hit
            DC-->>W: cached
        else miss
            W->>NWS: /points/{lat,lon}
            W->>NWS: /gridpoints/.../forecast
            W->>NWS: /gridpoints/.../forecast/hourly
        end
        W-->>B: periods + hourly + generatedAt
    and Active alerts
        B->>CDN: GET /api/alerts?lat&lon
        CDN->>P: miss → proxy
        P->>A: rate-limit OK
        A->>DC: fetch w/ revalidate (5 min)
        alt cache hit
            DC-->>A: cached
        else miss
            A->>NWS: /alerts/active?point=
        end
        A-->>B: classified alerts (blocking / warning / info)
    end

    Note over B: Render widget. Session events queue in memory.

    B->>AN: POST batched events<br/>(debounce 3s OR pagehide via sendBeacon)
    AN->>FS: 1 doc set w/ FieldValue.increment(N)
```

**Key points:**
- Steps 2/8/14 are CDN cache hits in steady state — the common case skips
  every layer below the CDN.
- The three fetches happen in parallel, not in series. Total wall time =
  the slowest of the three (usually weather), not their sum.
- Step 23 onward: a single batched analytics POST with all events from the
  session, not one POST per click.

---

## Cache TTL reference

| Layer | What it caches | TTL | Where it lives |
|---|---|---|---|
| **CDN edge** (`Cache-Control: s-maxage`) | `/api/weather` response | 1 hr fresh, 24 hr SWR | Vercel global CDN |
| **CDN edge** | `/api/alerts` response | 5 min fresh, 5 min SWR | Vercel global CDN |
| **CDN edge** | `/api/embed/[key]` response (success) | 10 min fresh, 1 hr SWR | Vercel global CDN |
| **CDN edge** | `/api/embed/[key]` response (4xx) | 60 s | Vercel global CDN |
| **Next Data Cache** (`fetch.next.revalidate`) | NWS `/points` lookup | 24 hr | Vercel runtime cache |
| **Next Data Cache** | NWS forecast / hourly | 1 hr | Vercel runtime cache |
| **Next Data Cache** | NWS active alerts | 5 min | Vercel runtime cache |
| **`unstable_cache`** | Firestore embed-config result | 10 min | Vercel runtime cache |
| **Upstash Redis** | Rate-limit counters | 1 min sliding window | Upstash (external) |
| **Browser memory** | Analytics event queue | until flush (3 s / pagehide) | iframe JS |

---

## Mutation → invalidation flow

When a customer changes branding, gets a tier upgrade, or admin reassigns a
course, the cached embed config must update — without waiting for the 10-min
TTL.

```mermaid
flowchart LR
    subgraph Triggers
        D[Dashboard 'Save' button]
        S[Stripe webhook<br/>tier change]
        A1[Admin: assign/unassign course]
        A2[Admin: edit course details]
    end

    D --> EP1[PATCH /api/dashboard/embed-config]
    S --> EP2[POST /api/subscription/webhook]
    A1 --> EP3[POST or DELETE<br/>/api/admin/businesses/<br/>:id/courses]
    A2 --> EP4[PUT or DELETE<br/>/api/admin/courses]

    EP1 --> AuthZ{Session +<br/>ownership check}
    EP2 --> Sig{Stripe<br/>signature OK?}
    EP3 --> AdminZ{Admin role?}
    EP4 --> AdminZ

    AuthZ -- ok --> W1[Write Firestore]
    Sig   -- ok --> W2[Write Firestore]
    AdminZ -- ok --> W3[Write Firestore]

    W1 --> Bust
    W2 --> Bust
    W3 --> Bust

    Bust[revalidateTag<br/>'embed-config', 'max']
    Bust --> Effect[Next /api/embed/key load:<br/>cache miss → fresh Firestore read]

    style Bust fill:#fef3c7,stroke:#f59e0b,color:#78350f
    style Effect fill:#d1fae5,stroke:#10b981,color:#065f46
```

**Reading this:** every server-side mutation that touches business config,
course details, or subscription tier ends with a single
`revalidateTag(EMBED_CONFIG_TAG, "max")` call. That bust propagates within
seconds — customers don't wait 10 minutes to see their save.

---

## What does NOT get cached (and why)

- **Analytics writes** (`POST /api/embed/analytics`). Mutations bypass
  edge caches by design; they go straight to Firestore (one batched write
  per session).
- **Auth-gated routes** (`/admin`, `/dashboard`, `/api/dashboard/*`). The
  proxy redirects unauthenticated requests to `/login`, and the page-level
  layouts read fresh session data per request. Caching personalized HTML
  would leak between users.
- **Stripe webhooks**. Single-shot mutations that mutate state and trigger
  a `revalidateTag`. Idempotent on the Stripe side via signature
  verification.
- **NWS active alerts beyond the 5-minute window**. Tornado warnings need
  to propagate fast — caching them aggressively would defeat the purpose.

---

## Onboarding new devs: where to start

1. Read this file to get the cache topology.
2. Open `INFRASTRUCTURE.md` for the *why* — design tradeoffs, what we
   considered and rejected.
3. To add a new cached endpoint, copy the shape of
   `src/app/api/weather/route.ts`: `next.revalidate` on the upstream
   `fetch`, `Cache-Control` on the response, optional `unstable_cache`
   wrapper for non-fetch sources.
4. To invalidate caches on mutation, import `revalidateTag` from
   `next/cache` and the relevant tag constant. Always pass the second
   `swr` argument (`"max"` is the safe default in Next 16).
