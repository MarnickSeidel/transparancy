# Agent instructions — Habidata (`transparancy`)

This file helps Cursor and other AI agents work effectively in this repository.  
**Front-end coding style** (Tailwind, semicolons, commit format) lives in [`.cursor/rules/front-end-cursor-rules.mdc`](.cursor/rules/front-end-cursor-rules.mdc) — read that for UI implementation details. This document covers **project context, architecture, and workflow**.

**Improvement backlog:** [`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## What this project is

**Habidata** brings transparency to Colombia’s residential **listing** market (Finca Raíz asking prices — not closed sales or official appraisals).

| Audience | Primary needs |
|----------|----------------|
| Local buyers | Barrio dossiers, estrato context, Spanish UI |
| US / international investors | English locale (`/en`), methodology, deal scoring |
| Power users | Dashboard, heatmap, URL analyzer, listing explorer |

**Repo layout:**

| Path | Role |
|------|------|
| `web/` | Next.js 14 App Router, Prisma, Tailwind — **primary agent workspace** |
| `scraper/` | Python Finca Raíz scraper → same PostgreSQL |
| `web/data/neighborhoods/` | Barrio JSON catalogs (shared by web + scraper) |
| `docker-compose.yml` | Postgres 16 (+ optional web image) |

Product name in UI: **Habidata**. Folder name: `transparancy`.

---

## Tech stack (`web/`)

- **Next.js 14.2** (App Router), React 18, TypeScript 5
- **PostgreSQL 16** via **Prisma 5**
- **Tailwind 3.4** — custom design tokens in `app/globals.css`
- **Maps:** Leaflet + react-leaflet (code-split)
- **Hex grid:** h3-js
- **Charts:** Recharts (dynamic import)
- **Email:** Resend (`RESEND_API_KEY`, `EMAIL_FROM`)
- **i18n:** Custom — **not** next-intl (`lib/i18n.ts`, `lib/locale.ts`, `middleware.ts`)

---

## Folder structure (`web/`)

```
web/
├── app/
│   ├── [locale]/          # SEO pages (es/en via rewrite)
│   ├── api/               # REST handlers (~34 routes)
│   ├── components/        # UI (~40 components + ui/ primitives)
│   ├── analyze-url/       # noindex tools
│   ├── dashboard/
│   ├── estimate/
│   ├── explore/
│   ├── heatmap/
│   ├── opportunities/     # served at /oportunidades
│   ├── price-drops/
│   └── email/             # confirm, unsubscribe, preferences
├── lib/                   # Business logic (~70 modules)
│   ├── dealEngine.ts      # Core deal scoring (~980 lines)
│   ├── i18n.ts            # All UI strings (~1,100 lines)
│   ├── email/
│   └── seo.ts, hreflang.ts, serverCache.ts, …
├── prisma/schema.prisma
├── data/neighborhoods/
└── middleware.ts          # Locale rewrite, opportunities routing, x-document-lang
```

---

## Architectural decisions (do not fight these)

### SEO vs internal tools

- **Indexable:** home, zones/dossiers, opportunities (`/oportunidades`), trust pages (methodology, privacy, about)
- **noindex:** dashboard, explore, estimate, heatmap, analyze-url, price-drops (`noIndexMetadata` + `robots.txt`)
- **API routes:** `X-Robots-Tag: noindex` via middleware

### Locale routing

- **Spanish:** unprefixed public URLs (`/`, `/zones`, `/oportunidades`)
- **English:** `/en` prefix (`/en`, `/en/zones`, `/en/opportunities`)
- Middleware rewrites Spanish indexable paths to internal `/es/*`; `/es/*` redirects to unprefixed
- Tool URLs are **never** prefixed with `/en` (redirect to unprefixed)
- Copy: `uiText` in `lib/i18n.ts`; paths: `localePath()`, `opportunitiesPath()` in `lib/locale.ts`
- Document language: middleware sets `x-document-lang`; root `layout.tsx` reads it for `<html lang>`

### Deal engine

- **`lib/dealEngine.ts`** — shared by API, UI, and Python scraper mirror
- Stored `dealScore` on `Listing` used for candidate selection; opportunities API may still re-run `analyzeDeal` (performance hotspot — see roadmap)
- Zone publish threshold: ≥20 valid price/m² points (`DEFAULT_MIN_ZONE_DATA_POINTS`)

### Caching

- **`lib/serverCache.ts`** — `unstable_cache` + CDN `Cache-Control` on hot reads
- Opportunities, heatmap, price-drops, dashboard aggregates are cached (60–300s TTL)

### Scraper relationship

- Scraper writes listings; `refresh_derived_data.py` refreshes deal scores and zone aggregates
- Web app **reads** Postgres; scraping happens outside Next.js request cycle
- Do not assume real-time data — copy says periodic refresh

---

## Conventions when editing code

### Styling

- Prefer **semantic tokens** from `globals.css`: `background`, `foreground`, `surface`, `elevated`, `muted`, `accent`, `border-subtle`, `deal-good/fair/bad`
- Use surface tiers: `surface-hero`, `surface-panel`, `surface-inline`
- **Avoid** ad-hoc `slate-*`, `teal-*`, `emerald-*` on tool pages unless semantically intentional (tool pages still drift — unify when touching them)
- Typography: `text-display`, `text-data-hero`, `text-section-label`, `text-meta`
- **New TSX:** omit semicolons (workspace rule); match surrounding file if editing legacy code with semicolons

### Components

- UI primitives: `app/components/ui/` (`Button`, `Card`, `Badge`, `Field`, `Skeleton`)
- Tool pages: `SiteHeader` → `AppHeader variant="tool"`; marketing: `variant="marketing"`
- Heavy clients: code-split via `dynamic()` or `lib/loadToolPage.tsx`
- Event handlers: `handle` prefix (`handleClick`, `handleSubmit`)

### i18n

- Add strings to **`lib/i18n.ts`** for both `es` and `en`
- Do not hardcode user-visible copy in components unless page-specific (trust pages sometimes inline — prefer `uiText` keys)
- Footer/nav: use `localePath(lang, path)` and `opportunitiesPath(lang)` — not hardcoded `/explore`

### API routes

- Pattern: parse query/body manually (no Zod yet), bound numeric inputs, `try/catch` → JSON error
- Expensive routes: use `serverCache` + rate limiting via `lib/rateLimit.ts` (see `.cursor/rules/web-api.mdc`)
- SSRF: analyze-url only allows `fincaraiz.com.co` hosts

### Database

- Use Prisma or `Prisma.sql` with parameters — no string-concatenated user input
- Migrations in `web/prisma/migrations/` — run `npm run prisma:migrate` in dev

---

## Commands

From **`web/`**:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server → http://localhost:3000 |
| `npm run dev:clean` | Clear `.next` then dev |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npx tsc --noEmit` | Typecheck (also in CI) |
| `npm run build` | Production build |
| `npm run prisma:migrate` | Dev migrations |
| `npm run prisma:deploy` | Production migrations |

From **repo root**:

```bash
docker compose up -d postgres   # Postgres on port 5433
```

CI (`.github/workflows/ci.yml`): lint, tsc, build for `web/`; Python syntax check for `scraper/`.

---

## Testing

**There are no automated tests yet** (no Jest, Vitest, or Playwright in `package.json`).

When adding tests, prefer:

- Playwright smoke tests: home, zone dossier, opportunities, analyze-url
- axe-core for accessibility regressions
- Script-based sanity checks already exist: `web/scripts/dealEngineSanity.ts`, etc.

Always run **`npm run lint`** and **`npx tsc --noEmit`** before considering work done.

---

## What NOT to do

| Rule | Why |
|------|-----|
| **Do not commit** unless the user explicitly asks | User preference |
| **Do not push** unless asked | Same |
| **Do not install packages** without need or user approval | Keep deps minimal |
| **Do not force-push** to main | Safety |
| **Do not update git config** | Safety |
| **Do not skip hooks** (`--no-verify`) unless user requests | Safety |
| **Do not commit `.env`** or secrets | Security |
| **Do not index tool pages** or remove noindex without intent | SEO strategy |
| **Do not break locale routing** — test `/`, `/en`, `/oportunidades` | Core UX |
| **Do not treat asking prices as appraisals** — keep disclaimers | Legal/trust |

---

## Environment variables (web)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Prisma runtime |
| `DIRECT_URL` | Yes | Migrations |
| `NEXT_PUBLIC_SITE_URL` | Prod | Canonical URLs, OG, sitemap |
| `RESEND_API_KEY` | Prod email | Transactional email |
| `EMAIL_FROM` | Prod email | Sender address |
| `CRON_SECRET` | Prod cron | Digest endpoint auth |

See `web/.env.example`.

---

## Preferred workflow with the user

1. **Clarify scope** — analysis-only vs implementation; commit or no commit.
2. **Read before write** — match existing patterns in the file and neighbors.
3. **Minimize diff** — fix the root cause; avoid drive-by refactors.
4. **Check git status** before starting if user mentions “clean state”.
5. **Report what to test** — especially for locale, email, analyze-url, and opportunities flows.
6. **Use the roadmap** — [`docs/ROADMAP.md`](docs/ROADMAP.md) for prioritized backlog; update it when completing major items.
7. **Multitask mode** — user may delegate long work to background agents; synthesize results, don’t duplicate effort.

---

## Improving this repo over time

After any session, agents **should feel free** to leave the codebase easier for the next session. This is encouraged, not optional busywork — but keep changes **small, accurate, and focused**.

| What to update | When |
|----------------|------|
| **`.cursor/rules/*.mdc`** | You hit the same mistake twice, or discover a convention worth enforcing |
| **`AGENTS.md`** | Architecture, env vars, workflow, or “where to start” knowledge changed |
| **`docs/ROADMAP.md`** | You completed, deferred, or reprioritized roadmap items |

**Guidelines:**

- Prefer **one bullet or one short rule** over long prose.
- **Link** to existing docs instead of duplicating `AGENTS.md` inside rules.
- Split new rules by concern (project vs components vs API) — see existing files in `.cursor/rules/`.
- **Do not commit** doc/rule updates unless the user asks (same as code).
- If unsure whether a rule belongs globally or in a glob rule, use a glob (`web/**/*.tsx`, `web/app/api/**`).

### High-impact files (touch carefully)

| File | Why |
|------|-----|
| `lib/dealEngine.ts` | Scoring logic affects scraper + all deal UIs |
| `lib/getTopOpportunities.ts` | Hot API path |
| `middleware.ts` | Breaks all routing if wrong |
| `lib/i18n.ts` | Large; easy to miss EN/ES parity |
| `prisma/schema.prisma` | Requires migration |

### Common user requests

| Request | Where to start |
|---------|----------------|
| New SEO page | `app/[locale]/`, `lib/seo.ts`, `sitemap.ts` |
| New tool page | `app/<tool>/page.tsx`, `noIndexMetadata`, `navConfig.ts` |
| Deal scoring change | `dealEngine.ts` + scraper mirror + sanity script |
| Email digest | `lib/email/sendDigests.ts`, `templates.ts` |
| Zone dossier data | `lib/getZoneDossier.ts`, publish threshold in zones libs |

---

## Related docs

- [Root README](README.md) — setup, Docker, scraper
- [Web README](web/README.md) — scripts, branding, derived data
- [Improvement roadmap](docs/ROADMAP.md) — audit scores, done vs todo
- [Cursor rules](.cursor/rules/) — always-applied and scoped agent rules:
  - [`habidata-project.mdc`](.cursor/rules/habidata-project.mdc) — project context, workflow, session improvements
  - [`web-components.mdc`](.cursor/rules/web-components.mdc) — TSX / design tokens / a11y
  - [`web-api.mdc`](.cursor/rules/web-api.mdc) — API routes, rate limits, caching
  - [`front-end-cursor-rules.mdc`](.cursor/rules/front-end-cursor-rules.mdc) — Tailwind, a11y, commits
