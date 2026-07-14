# Habidata — Website Audit Roadmap

Last updated: July 2026  
Status: **committed on `main`** — audit batch + follow-up improvements shipped

**Agent context:** [`AGENTS.md`](../AGENTS.md) · **Cursor rules:** [`.cursor/rules/`](../.cursor/rules/)

---

## Executive summary

July 2026 audit improvements are largely **done**. Remaining work focuses on **scale** (Redis rate limits, heatmap SQL), **full design-token migration**, and **deeper product features**.

### Audit scores (current)

| Area | Score | Notes |
|------|-------|-------|
| UI | 7.5 | Token migration started; Dashboard/Estimate still slate-heavy |
| UX | 8.0 | 3-item nav + More dropdown; intent-first labels (ES/EN) |
| SEO | 9.0 | Dynamic `lang`, PNG OG routes, opportunities JSON-LD |
| Performance | 6.5 | Explore split; opportunities cap; heatmap still full-city |
| Accessibility | 7.0 | Skip link, alts, focus, table scope |
| Code quality | 7.5 | Playwright smoke tests added; no unit tests yet |
| Security | 6.5 | Rate limits + headers; in-memory limits only |
| Product | 7.5 | Listing detail pages; agent docs |

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
- Nav restructure: **Barrios · ¿Buen precio? · Oportunidades** + **Más** dropdown (Explore, Estimate, Heatmap, Price drops, Dashboard)
- Shared `ErrorBanner`, `PromoCard` components
- Design tokens: OpportunitiesTop, ListingExplorer, PriceDrops (partial)
- Playwright smoke tests (`tests/e2e/smoke.spec.ts`)

---

## Remaining work

### Short-term
| Task | Why |
|------|-----|
| Redis/Upstash rate limits | Multi-instance production |
| Full design-token migration | Dashboard, Estimate, AnalyzeUrl still use `slate-*` |
| Extract Pagination component | Opportunities vs Explore duplication |
| Deeper opportunities perf | Trust stored scores / materialized rankings |

### Medium-term
| Task | Why |
|------|-----|
| SQL-aggregate heatmap | Bogotá/Medellín scale |
| Zod on POST APIs | Input validation |
| Split `i18n.ts` | Maintainability |
| Saved listings | Retention |
| Second data source | Market coverage |

### Long-term
Closed-sale data, user accounts, investment scoring product, B2B API, LATAM expansion

---

## Top priorities

1. Redis rate limits before multi-instance deploy
2. Finish design-token migration on remaining tool pages
3. Run `npm run test:e2e` in CI (after `npx playwright install`)
4. Heatmap SQL aggregation

---

## Manual testing

```bash
cd web && npm run dev
# Optional: npx playwright install && npm run test:e2e
```

See checklist in git history or prior audit notes for skip link, `/en` lang, rate limits, opportunities load.
