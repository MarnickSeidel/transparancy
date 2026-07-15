# ClaraCasas Web App

Next.js 14 app for the ClaraCasas platform. See the [root README](../README.md) for full stack setup.

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
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run prisma:migrate` | Apply migrations (dev) |
| `npm run prisma:deploy` | Apply migrations (production) |

## Neighborhood catalogs

Barrio JSON files live in `data/neighborhoods/`. The scraper reads the same path via `../web/data/neighborhoods`.

## Branding

Place logo assets in `public/branding/`:

- `ClaraCasas-logo-horizontal.svg` (or `.png`) — header + Open Graph
- `ClaraCasas-mark.svg` (or `.png`) — favicon + PWA icon

Placeholder SVGs are included until final brand assets are added.

## Derived data refresh

Deal scores and zone aggregates are maintained by the scraper pipeline. Without scraping, run from `scraper/`:

```bash
python refresh_derived_data.py
```
