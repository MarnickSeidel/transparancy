# Agent instructions — LupaCasa (`transparancy`)

Short architecture map for agents. **Open this file only when the task needs it** (routing, deal engine, SEO, caching, env). Everyday hard rules live in [`.cursor/rules/habidata-project.mdc`](.cursor/rules/habidata-project.mdc).

**UI style:** [`.cursor/rules/front-end-cursor-rules.mdc`](.cursor/rules/front-end-cursor-rules.mdc) (glob: `web/**/*.{tsx,ts,css}`) · **Backlog:** [`docs/ROADMAP.md`](docs/ROADMAP.md) · **Web details:** [`web/README.md`](web/README.md)

---

## What this is

**LupaCasa** — transparency for Colombia residential **listing** asking prices (Finca Raíz + Metrocuadrado analyze-url). Not closed sales or appraisals.

| Path | Role |
|------|------|
| `web/` | Next.js 14 App Router, Prisma, Tailwind — **primary workspace** |
| `scraper/` | Python Finca Raíz → same PostgreSQL |
| `web/data/neighborhoods/` | Barrio JSON (web + scraper) |
| `docker-compose.yml` | Postgres 16 |

Product name: **LupaCasa** (`lib/brand.ts`). Folder name: `transparancy`.

**Stack:** Next 14.2, React 18, TS 5, Prisma 5, Tailwind 3.4, Leaflet, h3-js, Recharts, Resend. i18n is custom (`lib/i18n/`, `lib/locale.ts`, `middleware.ts`) — not next-intl.

---

## Do not fight these

### SEO

- **Indexable:** home, zones/dossiers, opportunities (`/oportunidades`), trust pages
- **noindex:** dashboard, explore, estimate, heatmap, analyze-url, price-drops, listing detail
- API: `X-Robots-Tag: noindex` via middleware

### Locale routing

- **Spanish only.** Unprefixed public URLs. `/en` and `/en/*` **301** to the Spanish path (`/en/opportunities` → `/oportunidades`, `/en/listing/:id` → `/anuncio/:id`, `/en/estimate` → `/cuanto-vale-mi-casa`).
- **Spanish slugs:** `PUBLIC_ROUTES` in `lib/locale.ts` maps public ↔ internal (`/barrios`↔`/zones`, `/metodologia`, `/privacidad`, `/acerca-de`, `/explorar`, `/mapa-de-precios`, `/bajadas-de-precio`, `/mercado-en-cifras`, `/oportunidades`, `/cuanto-vale-mi-casa`, `/analizar-anuncio`, `/correo/{confirmado,preferencias,cancelado}`). Middleware rewrites Spanish → internal (`app/[locale]` routes via `/es/*`) and **301**s English internal paths and `/es/*` → Spanish. Add new public pages to that table; always build hrefs with `localePath()` (internal path in, Spanish out, query kept)
- Listing: `/anuncio/<id>`; `/es/opengraph-image` is the only `/es/*` path served directly (home OG image)
- Headers: `x-locale` and `x-document-lang` are `es`

### Deal engine

- `lib/dealEngine.ts` — shared with scraper mirror (`analyzeDeal`)
- `lib/dealCompPool.ts` — `analyzeListingDeal` (opportunities, `/anuncio`, analyze-url)
- Good-deal floor: `GOOD_DEAL_DISCOUNT_PCT = 12` (opportunities `minDiscountPct` aligns)
- Zone publish: ≥20 valid price/m² (`DEFAULT_MIN_ZONE_DATA_POINTS`)
- Web-only post-processing in `analyzeListingDeal` (scraper untouched): portal placeholder coords (≥8 listings, ≥3 barrios on one point) are stripped before geo comps; discount ≥40% or approximate location caps confidence at medium; >35% discount subtracts up to 15 from score (`priceSanityPenalty`)
- Detail: [`web/README.md`](web/README.md) § Deal analysis

### Caching / scraper

- Hot reads: `lib/serverCache.ts` (JSON-serializable only — no bare `BigInt`)
- Scraper writes; web reads; copy assumes periodic refresh

---

## Edit conventions (summary)

- Tokens: `background`, `foreground`, `surface-*`, `muted`, `accent`, `border-subtle`, `deal-*`
- Strings: domain files under `lib/i18n/` (`common`, `opportunities`, `listing`, …); public import `@/lib/i18n`
- API: bound inputs, `serverCache` + `rateLimit` on expensive routes; analyze-url host allowlist only
- DB: Prisma / parameterized `Prisma.sql` only

Commands, env vars, testing: [`web/README.md`](web/README.md) + `web/.env.example`. Email ops: [`docs/EMAIL_OPERATIONS.md`](docs/EMAIL_OPERATIONS.md). Monthly scrape (Claude via `.github/workflows/monthly-scrape.yml`): [`docs/SCRAPER_AUTOMATION.md`](docs/SCRAPER_AUTOMATION.md).

---

## What NOT to do

| Rule | Why |
|------|-----|
| Commit / push / install without ask | User preference |
| Force-push main / skip hooks / edit git config | Safety |
| Commit `.env` | Security |
| Index tool pages without intent | SEO |
| Break locale routing | Core UX |
| Treat asking prices as appraisals | Trust |

---

## High-impact files

| File | Why |
|------|-----|
| `lib/dealEngine.ts` | Scoring + scraper parity |
| `lib/dealCompPool.ts` | Live analysis entry |
| `lib/getTopOpportunities.ts` | Hot API path |
| `lib/analyzeListingUrl.ts` | Portal allowlist |
| `middleware.ts` | All routing |
| `lib/i18n/` | EN/ES parity (edit the domain file, not the whole pack) |
| `prisma/schema.prisma` | Needs migration |

### Where to start

| Request | Start |
|---------|--------|
| SEO page | `app/[locale]/`, `lib/seo.ts` |
| Tool page | `app/<tool>/page.tsx`, `noIndexMetadata` |
| Deal scoring | `dealEngine.ts` + `dealCompPool.ts` + scraper + sanity script |
| Email digest | `lib/email/sendDigests.ts` |
| Analyze-url portal | `analyzeListingUrl.ts` + portal parsers |

---

## Keeping docs cheap for agents

- Prefer short always-on rules; put detail in glob rules or this file
- After sessions: update rules / this file / roadmap only when reusable — one bullet beats a paragraph
- Do not commit doc updates unless asked
