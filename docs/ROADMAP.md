# ClaraCasas — Website Audit Roadmap

Last updated: August 2026  
Status: **in progress** — brand/perf/token batches applied; deal consistency shipped; scale work remains

**Agent context:** [`AGENTS.md`](../AGENTS.md) · **Cursor rules:** [`.cursor/rules/`](../.cursor/rules/)

---

## Executive summary

July 2026 audit improvements are largely **done**. Remaining work focuses on **scale** (Redis rate limits, heatmap SQL), observability, and **deeper product features**.

### Audit scores (current)

| Area | Score | Notes |
|------|-------|-------|
| UI | 8.0 | Tool pages on design tokens (Dashboard/Estimate/Analyze) |
| UX | 8.0 | 3-item nav + More dropdown; intent-first labels (ES/EN) |
| SEO | 9.0 | Dynamic `lang`, PNG OG, sitemap hreflang, brand-consistent metadata |
| Performance | 8.0 | Nav progress + locale skeletons; BigInt cache fix; tool code-split; heatmap still full-city |
| Accessibility | 7.5 | Skip link, live regions, reduced-motion, select ARIA i18n |
| Code quality | 7.5 | Playwright smoke tests added; no unit tests yet |
| Security | 7.0 | Rate limits on more heavy routes; still in-memory only |
| Product | 7.5 | Listing detail pages; ClaraCasas brand unified |

---

## Completed

### Audit batch (July 2026)
- Rate limiting, security headers, email HTML escape, dynamic `lang`, skip link
- Accessibility: `main-content`, alts, table scope, focus rings
- Explore code-split, opportunities analyze cap, MVP copy removed
- `AGENTS.md`, `.cursor/rules/`, listing detail pages

### Follow-up batch (same sprint)
- Price Drops padding fix
- Email confirm/unsubscribe try/catch
- CRON_SECRET explicit prod denial + logging
- Freshness API date normalization (build warning fixed)
- PNG OG images: opportunities route + metadata on home/zones/cities/opportunities
- Opportunities `CollectionPage` JSON-LD
- Home “Start here” 3 journeys section (above the fold)
- Home featured deals link to internal listing detail pages
- `ToolNextSteps` + `listingContextLinks` — contextual cross-links on analyze, listing detail, opportunities, explore, heatmap, dashboard
- Nav restructure: **Barrios · ¿Buen precio? · Oportunidades** + **Más** dropdown
- Shared `ErrorBanner`, `PromoCard` components
- Design tokens: OpportunitiesTop, ListingExplorer, PriceDrops (partial)
- Playwright smoke tests (`tests/e2e/smoke.spec.ts`)

### Brand + polish batch (July 2026)
- Unify **ClaraCasas** across metadata, OG, JSON-LD, email, trust pages, share copy
- Scope Leaflet CSS to map components only
- `robots.txt` disallow `/anuncio/`, `/en/listing/`, `/email/`, `/r/`
- Sitemap `alternates.languages` (hreflang pairs)
- Rate limits on estimate, listings, heatmap, opportunities, dashboard bundle
- Email signup `role="alert"` / `aria-live`; `prefers-reduced-motion`
- SearchableSelect open/close ARIA i18n
- Footer email signup SSR (no late `ssr: false` hydrate)

### Perf + tokens batch (July 2026)
- Opportunities: prefer stored `dealScore` pool; cached city comp pool (90s); leaner comp select; price events only for analyze slice; lower analyze/comp caps
- Design tokens: Dashboard, Estimate, AnalyzeUrl, EmailSignupForm — `slate-*` → semantic tokens
- Analyze-url: Metrocuadrado listing URLs (`mc:` external ids) alongside Finca Raíz

### Nav perceived-latency batch (July 2026)
- Profiled soft nav: click→busy ~12ms; frozen UI caused by RSC wait (2–7s cold) + subtle pending styles + missing `[locale]`/`anuncio` `loading.tsx`
- Fixed opportunities `unstable_cache` BigInt crash + slimmed comp pool (dropped descriptions) so cache fits under Next 2MB cap
- Global `NavigationProgress` top bar + `#main-content` dim on pointerdown
- Stronger pending nav styles; `loadToolPage` code-split for opportunities/analyze/dashboard/heatmap/estimate/price-drops

### Deal analysis consistency (July 2026)
- Unified opportunities + `/anuncio` via `lib/dealCompPool.ts` (`analyzeListingDeal`)
- Property-type-aware cached city pools (fixes opp −35% vs detail +8% median flips)
- Listing detail uses same house-floor calibration as opportunities
- Default opportunities min discount = 12% (`GOOD_DEAL_DISCOUNT_PCT`) so list cards match “Buena oportunidad”; busted opportunities cache key to v2

---

## Remaining work

### Short-term
| Task | Why |
|------|-----|
| Redis/Upstash rate limits | Multi-instance production |
| Extract Pagination component | Opportunities vs Explore duplication |
| Wire Playwright into CI | After `npx playwright install` + test DB |

### Medium-term
| Task | Why |
|------|-----|
| SQL-aggregate heatmap | Bogotá/Medellín scale |
| Zod on POST APIs | Input validation |
| Split `i18n.ts` | Maintainability |
| Privacy-respecting analytics + Sentry | Measure usage / catch errors |
| CSP (+ HSTS at edge) | Hardening |
| Saved listings | Retention |
| Second data source | Market coverage |

### Long-term
Closed-sale data, user accounts, investment scoring product, B2B API, LATAM expansion

---

## Top priorities

1. Redis rate limits before multi-instance deploy
2. Heatmap SQL aggregation
3. Analytics + error tracking
4. Run `npm run test:e2e` in CI

---

## Manual testing

```bash
cd web && npm run dev
# Optional: npx playwright install && npm run test:e2e
```

Check: brand name ClaraCasas on home/about/OG; maps still style correctly; `/robots.txt` disallows tools + anuncio/email; email signup errors announced; heavy API returns 429 when hammered.
