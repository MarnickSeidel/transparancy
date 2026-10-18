# CasasClaras (Transparancy)

Real estate listing transparency for Colombia: a Python scraper loads listings from [Finca Raíz](https://www.fincaraiz.com.co) (and on-demand Metrocuadrado via analyze-url) into PostgreSQL, and a **Next.js** app surfaces filters, zone dossiers, and deal hints based on price per square meter versus neighborhood averages.

**Docs map:** [AGENTS.md](AGENTS.md) (architecture) · [web/README.md](web/README.md) (web developer guide) · [docs/EMAIL_OPERATIONS.md](docs/EMAIL_OPERATIONS.md) (email cron) · [docs/ROADMAP.md](docs/ROADMAP.md) (backlog)

## What's in the repo

| Path | Role |
|------|------|
| `web/` | Next.js 14 app (App Router), Prisma, Tailwind — public SEO pages + internal tools |
| `scraper/` | urllib + `__NEXT_DATA__` scraper; writes `Listing` rows with polite delays |
| `web/data/neighborhoods/` | **Single source of truth** for barrio catalogs (used by web + scraper) |
| `docker-compose.yml` | PostgreSQL 16 and optional production-style `web` service |

## Prerequisites

- **Docker** (for Postgres, and optionally the web image)
- **Node.js 20+** and npm — for local `web/` development
- **Python 3.11+** — for `scraper/`
- Playwright is only used by `scraper/debug_page.py` (optional debugging)

## Database (Docker)

From the project root:

```bash
docker compose up -d postgres
```

Default DB: `pereira_realestate`, user/password `postgres` / `postgres`, host port **5433**.

## Web app (`web/`)

1. Copy env and point at your Postgres (local Docker or Supabase):

   ```bash
   cp web/.env.example web/.env
   ```

2. Install and migrate:

   ```bash
   cd web
   npm install
   npm run prisma:migrate
   ```

3. Dev server ([http://localhost:3000](http://localhost:3000)):

   ```bash
   npm run dev
   ```

With **Docker Compose** including `web`, the app is exposed on **port 3001**.

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Prisma runtime connection (pooled URL on Supabase) |
| `DIRECT_URL` | Yes | Direct Postgres URL for migrations |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical URLs, sitemap, Open Graph |
| `RESEND_API_KEY` / `EMAIL_FROM` | Prod email | Transactional mail (optional in dev) |
| `CRON_SECRET` | Prod cron | Auth for `/api/cron/send-digests` |

See `web/.env.example` for Supabase and local Docker examples. Email digests: [docs/EMAIL_OPERATIONS.md](docs/EMAIL_OPERATIONS.md).

## Scraper (`scraper/`)

1. Copy and edit environment:

   ```bash
   cp scraper/.env.example scraper/.env
   ```

   `DATABASE_URL` must match your Postgres.

2. Virtualenv and dependencies:

   ```bash
   cd scraper
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Full monthly refresh (all cities, multi-pass):

   ```bash
   python run_monthly_refresh.py
   python run_monthly_refresh.py --test    # Pereira smoke test
   python run_monthly_refresh.py --only cali
   python run_monthly_refresh.py --skip bogota --default-max 500
   ```

   Useful flags: `--only`, `--skip`, `--default-max`, `--casas-apto-max`, `--stale-pages`.

   Or via automation entry point:

   ```bash
   ./automation_run.sh
   ```

### Refresh derived data (no scraping)

After listing data changes — or without running a scrape at all — recompute deal scores and refresh zone aggregates:

```bash
cd scraper
python refresh_derived_data.py
python refresh_derived_data.py --city Pereira
```

This updates `is_deal`, `deal_score`, and `REFRESH MATERIALIZED VIEW CONCURRENTLY zone_list_aggregates`. The monthly refresh runs this automatically at the end.

**Notes:**

- `--city` limits **deal** recomputation (ILIKE); the materialized-view refresh is **always global**.
- Concurrent MV refresh requires the expected unique indexes from migrations.
- If scrape succeeds but the final maintenance step fails, listings may be fresh while deal scores / zone aggregates stay stale — re-run `refresh_derived_data.py`.
- Per-page scrapes skip deal refresh for speed (`SKIP_DEAL_REFRESH=1` in automation); the global refresh at the end covers all cities.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs web lint, typecheck, build, and scraper syntax checks on push/PR.

## License / usage

Use responsibly: scraping is subject to the target site's rules and applicable law. This project is for learning and local analysis unless you have explicit permission for broader use.
