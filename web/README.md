# ClaraCasas Web App

Next.js 14 app for the ClaraCasas platform. See the [root README](../README.md) for full stack setup. Agent-oriented architecture notes live in [`AGENTS.md`](../AGENTS.md).

## Quick start

```bash
cp .env.example .env
npm install
npm run prisma:migrate
npm run dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run dev:clean` | Clear `.next` then dev |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |
| `npm run test:e2e` | Playwright smoke tests (requires `npx playwright install`) |
| `npm run prisma:migrate` | Apply migrations (dev) |
| `npm run prisma:deploy` | Apply migrations (production) |

## i18n

UI strings live under `lib/i18n/` (domain modules: `common`, `opportunities`, `listing`, …). Import the merged pack from `@/lib/i18n` (`uiText`, `Lang`, `priorityCities`). When adding copy, edit the matching domain file and keep `es` + `en` in sync — avoid loading every domain for a one-key change.

## Neighborhood catalogs

Barrio JSON files live in `data/neighborhoods/`. The scraper reads the same path via `../web/data/neighborhoods`.

## Branding

Place logo assets in `public/branding/`:

- `claracasas-logo-horizontal.svg` (or `.png`) — header + Open Graph
- `claracasas-mark.svg` (or `.png`) — favicon + PWA icon

## Deal analysis (opportunities + listing detail)

**Intent:** Score asking prices vs neighborhood/city comps. This is **not** an appraisal or closed-sale index.

| Path | Entry | Comp pool + house floor |
|------|-------|-------------------------|
| Opportunities | `getTopOpportunities.ts` → `analyzeListingDeal` | Type-aware cached city pool + city house floor (`lib/dealCompPool.ts`) |
| Listing detail / analyze-url | `getListingDetail.ts` → `analyzeListingDeal` | Same shared pool + house floor |

Core scoring: `lib/dealEngine.ts` → `analyzeDeal()` via `analyzeListingDeal()`. Verdict bands: **≥ +12%** discount → good deal, **≤ −12%** → overpriced (`GOOD_DEAL_DISCOUNT_PCT` / `OVERPRICED_DISCOUNT_PCT`). Opportunities default `minDiscountPct` is **12%** so list cards match “Buena oportunidad”.

**Constraints:**

- Stored `dealScore` on `Listing` selects candidates; live analysis still runs for UI fields.
- Cache payloads must be JSON-safe — serialize `BigInt` / `Date` before `unstable_cache` (Next ~2MB cache limit).
- After scraper loads, run `python refresh_derived_data.py` so stored scores stay useful.

## Analyze URL pipeline

`POST /api/analyze-url` always **refetches** the portal page, upserts the listing, builds listing detail, and persists the deal score.

| Portal | Hosts | Path shape | Stored external id |
|--------|-------|------------|--------------------|
| Finca Raíz | `fincaraiz.com.co`, `www.` | `/<slug>/<numeric-id>` | portal numeric id |
| Metrocuadrado | `metrocuadrado.com`, `www.` | `/inmueble/<slug>/MC<digits>` | `mc:MC…` |

- Query strings and fragments are stripped during validation (`lib/analyzeListingUrl.ts`).
- Default fetch timeout: **15s**.
- Rate limit: **10 / 15 min / IP**.
- Common errors: `url_not_allowed`, `url_path_invalid` (400); `fetch_failed`, `next_data_missing`, `listing_payload_missing`, `price_missing`, `area_missing` (422).

## Nearby amenities

`GET /api/nearby-amenities?lat=&lng=&radiusM=` (optional radius).

- Default radius **1000 m**, clamped **200–3000 m**.
- Categories: education, health, groceries, parks, transit (OSM / Overpass).
- Returns nearest **5** places per category; counts include all matches.
- Coordinates must fall in a Colombia bounding box; a common lat/lng swap is auto-corrected.
- Overpass failure → HTTP 200 with `unavailable: true` and empty places (not a 5xx).
- Cache TTL **1 day**; unavailable results are **not** cached (`serverCache` throws then retries uncached).

## Caching and rate limits

Hot reads go through `lib/serverCache.ts` (`unstable_cache` + `Cache-Control` on API responses):

| Data | Typical revalidate |
|------|--------------------|
| Opportunities | 60s |
| Dashboard / trends | 90s |
| Heatmap, filters, price drops | 120s |
| Data freshness | 300s |
| Nearby amenities | 86400s |

`lib/rateLimit.ts` is **in-memory per process**. Limits do not coordinate across multiple instances and reset on restart. See roadmap for Redis/Upstash.

## Email digests

Operational runbook: [`docs/EMAIL_OPERATIONS.md`](../docs/EMAIL_OPERATIONS.md).

## Derived data refresh

Deal scores and zone aggregates are maintained by the scraper pipeline. Without scraping, run from `scraper/`:

```bash
python refresh_derived_data.py
python refresh_derived_data.py --city Pereira   # deals scoped; MV refresh still global
```

## Common pitfalls

| Pitfall | What to do |
|---------|------------|
| Soft nav feels frozen | Expected RSC wait on cold routes; `NavigationProgress` + `loading.tsx` should show progress |
| Opportunities cache crash | Do not put raw `BigInt` in `unstable_cache` |
| EN tool URL “missing” page | Middleware **rewrites** `/en/analyze-url` → `/analyze-url` with `x-locale: en` — do not strip `/en` in links via hard redirects |
| Analyze-url SSRF | Only allowlisted hosts; never generalize fetch to arbitrary URLs |
| Multi-instance 429 uneven | In-memory limiter is per instance — expected until Redis |
| Asking prices as “value” | Keep disclaimers; data is listing asks only |
