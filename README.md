# Transparancy

A small stack for exploring **real estate listing transparency** in Pereira, Colombia: a Python scraper loads listings from [Finca Raíz](https://www.fincaraiz.com.co) into PostgreSQL, and a **Next.js** app surfaces filters, summaries, and “deal” hints based on price per square meter versus neighborhood (or city) averages.

## What’s in the repo

| Path | Role |
|------|------|
| `web/` | Next.js 14 app (App Router), Prisma, Tailwind — dashboard and API routes |
| `scraper/` | Playwright-based scraper; writes `Listing` rows and respects configured delays |
| `docker-compose.yml` | PostgreSQL 16 and optional production-style `web` service |

## Prerequisites

- **Docker** (for Postgres, and optionally the web image)
- **Node.js 20+** and npm — for local `web/` development
- **Python 3.11+** — for `scraper/`
- **Playwright browsers** — install after `pip install -r scraper/requirements.txt` with `playwright install` (Chromium)

## Database (Docker)

From the project root:

```bash
docker compose up -d postgres
```

Default DB: `pereira_realestate`, user/password `postgres` / `postgres`, host port **5433** (inside Docker the service still listens on 5432; 5433 avoids conflicts with another Postgres on your machine).

## Web app (`web/`)

1. Copy env and point at local Postgres:

   ```bash
   cp web/.env.example web/.env
   ```

2. Install and migrate:

   ```bash
   cd web
   npm install
   npm run prisma:migrate
   ```

3. Dev server (default [http://localhost:3000](http://localhost:3000)):

   ```bash
   npm run dev
   ```

With **Docker Compose** including `web`, the app is exposed on **port 3001** (see `docker-compose.yml`).

## Scraper (`scraper/`)

1. Copy and edit environment:

   ```bash
   cp scraper/.env.example scraper/.env
   ```

   Ensure `DATABASE_URL` matches your Postgres (see `scraper/.env.example` for the local URL shape).

2. Create a virtualenv, install deps, install Playwright browsers:

   ```bash
   cd scraper
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   playwright install chromium
   ```

3. With Postgres running and migrations applied, from `scraper/`:

   ```bash
   python scrape.py
   ```

Configurable knobs include `LISTING_URL`, `DEAL_THRESHOLD_PCT`, and delay bounds (`MIN_DELAY_SEC` / `MAX_DELAY_SEC`). The scraper is written to be polite; keep delays reasonable and follow the site’s terms and `robots.txt`.

## License / usage

Use responsibly: scraping is subject to the target site’s rules and applicable law. This project is for learning and local analysis unless you have explicit permission for broader use.
