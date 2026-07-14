# Habidata — Website Audit Roadmap

Last updated: July 2026  
Audit scope: full read-only review of `web/` (UI, UX, SEO, performance, accessibility, security, product)  
Status: **uncommitted improvements on `main`** — ready for review and commit

**Agent context:** [`AGENTS.md`](../AGENTS.md) · **Cursor rules:** [`.cursor/rules/`](../.cursor/rules/) (agents may update rules/docs after sessions)

---

## Executive summary

**Habidata** is a Colombian real-estate transparency platform: Finca Raíz listings → neighborhood dossiers, deal scoring, estimates, heatmaps, and URL diagnostics for local buyers and international investors.

A **July 2026 audit batch** landed security, SEO/a11y, performance, and agent-documentation improvements (see [Completed](#completed-improvements-uncommitted)). Remaining gaps: **design consistency** on tool pages, **OG/social previews**, **automated tests**, **production-grade rate limiting** (Redis), and **heatmap/opportunities scale** work.

### Audit scores

| Area | Before | Now | Notes |
|------|--------|-----|-------|
| UI | 7.0 | 7.0 | Unchanged; token migration still pending |
| UX | 6.5 | 6.5 | Home “3 journeys” not yet shipped |
| SEO | 8.0 | **8.5** | Dynamic `lang`, email `noindex`; OG images still missing on child pages |
| Performance | 6.0 | **6.5** | Explore code-split; opportunities analyze cap; heatmap still full-city load |
| Accessibility | 6.0 | **7.0** | Skip link, `main-content`, alts, table scope, focus rings |
| Code quality | 7.0 | 7.0 | Still no automated tests |
| Security | 5.5 | **6.5** | Rate limits + headers + email escape; in-memory limits only |
| Product | 7.0 | **7.5** | MVP copy removed; agent docs + rules added |

---

## Completed improvements (uncommitted)

Verify with `git status` and `git diff --stat` (~37 modified files + new modules/docs).

### Security & reliability

| Item | Files |
|------|-------|
| HTML escape utility | `web/lib/htmlEscape.ts` |
| Escape user/scraped strings in all digest emails | `web/lib/email/templates.ts` |
| Fail email send in production without `RESEND_API_KEY` | `web/lib/email/sendEmail.ts` |
| Shared report slug entropy (6 → 12 bytes) | `web/lib/shareReport.ts` |
| Security response headers | `web/next.config.mjs` |
| **Rate limiting wired to API routes** | `web/lib/rateLimit.ts` → `analyze-url` (10/15 min), `subscribe` (5/hr), `reports/share` (20/hr), `nearby-amenities` (30/min) |

### SEO & i18n

| Item | Files |
|------|-------|
| Dynamic `<html lang>` via middleware | `web/middleware.ts`, `web/app/layout.tsx` |
| Remove “MVP” from subtitles | `web/lib/i18n.ts` |
| `noindex` on email utility pages | `web/app/email/confirmed`, `unsubscribed`, `preferences` |

### Accessibility

| Item | Files |
|------|-------|
| Skip-to-content link + styles | `web/app/layout.tsx`, `web/app/globals.css` |
| `id="main-content"` on **17** page `<main>` elements | All major components + email flows + city hub |
| Listing thumbnail `alt` from title | `ListingThumbnail.tsx`, `OpportunitiesTop`, `OpportunityMobileCard` |
| Home featured card alts | `HomePage.tsx` |
| Table `scope="col"` | `OpportunitiesTop.tsx`, `ListingExplorer.tsx` |
| Focus rings on language/theme toggles | `LanguageToggle.tsx`, `ThemeToggle.tsx` |
| `link-focus` on footer links | `PageFooter.tsx` |

### UX & performance

| Item | Files |
|------|-------|
| Footer locale paths for `/explore`, `/price-drops` | `PageFooter.tsx` |
| Explore code-split via `loadToolPage` | `web/app/explore/page.tsx` |
| Opportunities: sort by stored `dealScore`, cap analysis at 200 rows | `web/lib/getTopOpportunities.ts` |
| Middleware cleanup (dead `/en && false` branch) | `web/middleware.ts` |

### Documentation & agent workflow

| Item | Files |
|------|-------|
| Agent onboarding guide | `AGENTS.md` |
| Cursor rules (project + scoped) | `.cursor/rules/habidata-project.mdc`, `web-components.mdc`, `web-api.mdc` |
| This roadmap | `docs/ROADMAP.md` |
| “Improve docs after sessions” guidance | `AGENTS.md`, `habidata-project.mdc` |

---

## Remaining work

### Quick wins (1–2 hours each)

| Priority | Task | Key files |
|----------|------|-----------|
| Medium | Remove extra `pb-28` on PriceDrops (no fixed bottom bar) | `PriceDropsFeed.tsx` |
| Medium | try/catch on email confirm/unsubscribe API routes | `app/api/email/confirm`, `unsubscribe` |
| Low | Require `CRON_SECRET` in production cron route | `app/api/cron/send-digests/route.ts` |

### Short-term (1–2 days)

| Priority | Task | Impact | Key files |
|----------|------|--------|-----------|
| **High** | OG image templates per zone/opportunity | Social preview quality | `web/lib/seo.ts`, `zoneSeo.ts`, `citySeo.ts` |
| **High** | Unify design tokens on tool pages | Premium cohesive feel | Replace `slate-*` / `teal-*` with semantic tokens |
| **High** | First-time user “3 journeys” on home | Lower bounce | `HomePage.tsx` |
| **High** | Fix `/api/freshness` build warning | Cleaner builds | `web/lib/getDataFreshness.ts` or route |
| High | Extract shared UI: ErrorBanner, PromoCard, Pagination | Less duplication | `app/components/ui/` |
| High | **Redis/Upstash rate limits** (replace in-memory) | Multi-instance prod | `web/lib/rateLimit.ts` |
| Medium | `RealEstateListing` JSON-LD on opportunities | Rich results | Opportunities page + `lib/seo.ts` |
| Medium | PNG/WebP OG assets (replace SVG) | Platform compatibility | `public/branding/` |
| Medium | Deeper opportunities perf — trust stored scores for output, MV precompute | API cost at scale | `getTopOpportunities.ts` |

### Medium-term (1–2 weeks)

| Task | Impact |
|------|--------|
| SQL-aggregate heatmap (stop full-city `findMany`) | Scales Bogotá/Medellín |
| Playwright + axe-core smoke tests on key routes | Regression safety |
| Zod validation on POST APIs | Input safety + clearer errors |
| Split `web/lib/i18n.ts` (~1,100 lines) | Maintainability |
| Saved listings (localStorage → optional accounts) | Retention |
| Listing comparison (2 URLs) | Power-user feature |
| Premium listing cards with signal overlay | UX polish |
| Second data source (beyond Finca Raíz) | Market coverage |

### Long-term vision

| Initiative | Why |
|------------|-----|
| Closed-sale / registry data | Trust ceiling vs asking prices only |
| User accounts + saved searches/alerts | Retention moat |
| Investment scoring product (dashboard gate exists) | Monetization / differentiation |
| B2B API for agents | Revenue |
| LATAM expansion | Growth |
| ML price model with explainability | Beyond rule-based engine |

---

## Top priority next steps

1. **Review and commit** the uncommitted batch (code + `AGENTS.md` + `docs/` + `.cursor/rules/`).
2. **OG image templates** for zones and opportunities (highest SEO/social ROI left).
3. **Design token migration** on tool pages — one visual language everywhere.
4. **Fix freshness API** build warning.
5. **Playwright smoke tests** — home, zones, opportunities, analyze-url.
6. **Redis rate limits** before scaling to multiple server instances.

---

## Manual testing checklist

Run locally: `cd web && npm run dev`

### SEO & i18n

- [ ] View source on `/` → `<html lang="es">`
- [ ] View source on `/en` → `<html lang="en">`
- [ ] Tool page subtitles no longer say “MVP”

### Accessibility

- [ ] Tab on load — skip link appears, jumps to `#main-content` on **any** page (not just email)
- [ ] Tab through footer links and language/theme toggles — visible focus rings
- [ ] `/oportunidades` — table headers have `scope="col"`; thumbnails have meaningful `alt`

### Security & rate limits

- [ ] Response headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- [ ] Rapid `POST /api/analyze-url` → 429 with `rate_limit_exceeded`
- [ ] Rapid `POST /api/subscribe` → 429
- [ ] Production without `RESEND_API_KEY` — subscribe fails (not silent success)

### UX & performance

- [ ] English footer — Explore and Price drops links use correct locale paths
- [ ] `/explore` — skeleton first, then content (code-split)
- [ ] `/oportunidades` — loads; compare feel vs pre-change if possible

### Email & share

- [ ] `/email/confirmed?status=ok` — `noindex` in metadata
- [ ] Dev digest email — HTML-escaped listing titles
- [ ] Share report — longer slug (12-byte entropy)

### Regression

- [ ] `/oportunidades` and `/en/opportunities` load
- [ ] Language toggle + zone dossiers work
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` pass in `web/`

---

## Reference

The original audit covered project understanding, UI/UX, performance, SEO, accessibility, code quality, security, product, competitive analysis, design inspiration, and a ranked top-25 list.

For implementation context, see [`AGENTS.md`](../AGENTS.md).
