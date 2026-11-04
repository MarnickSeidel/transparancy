# Monthly scrape — runbook for Claude (GitHub Actions)

This file is the **complete instruction set** for Claude Code when it runs the monthly LupaCasa data refresh from `.github/workflows/monthly-scrape.yml`. If you are Claude: read this whole file before running anything, then follow §4 in order.

---

## 1. What the job is

LupaCasa (`web/`, Next.js) shows Colombian residential **listing asking prices** from [Finca Raíz](https://www.fincaraiz.com.co). The Python scraper in `scraper/` reads Finca Raíz listing pages (plain HTTP + the page's `__NEXT_DATA__` JSON, no browser) and writes rows into the production **PostgreSQL database on Supabase**. The website reads that same database.

Every month the job must:

1. Re-scrape every city in `CITIES` (`scraper/run_all_cities_venta_refresh.py`) for all *venta* property types.
2. After each city: mark listings that were not seen as inactive and save a monthly price snapshot (both happen automatically at the **end** of each city run).
3. After the cities: recompute deal scores, refresh the `zone_list_aggregates` materialized view, shrink old inactive rows, and archive listings inactive for over 90 days.
4. Report the result.

**No code changes and no git commits.** All output goes to the database. The workflow token is read-only for code.

---

## 2. How the workflow works

| Piece | Detail |
|-------|--------|
| Workflow | `.github/workflows/monthly-scrape.yml` |
| Schedule | `0 6 1-4 * *`: days 1–4 of each month, 06:00 UTC (01:00 Colombia). Can also be started manually: **Actions → Monthly scrape (Claude) → Run workflow**. |
| Before Claude starts | Checks out `main`, installs Python 3.11 + `scraper/requirements.txt`, then runs `scraper/cities_due.py` to list cities **not refreshed in the last 7 days**. If none are due, Claude does not run (no cost). |
| Env available to Claude | `DATABASE_URL` (secret), `CITIES_DUE` (space-separated city ids), `SCRAPE_DEADLINE` (Unix time; don't start a new city after it), `GH_TOKEN` (for `gh issue create`), `GITHUB_STEP_SUMMARY`, `GITHUB_WORKSPACE` (repo root). |
| Limits | The job is killed at 350 minutes (GitHub's hard cap is 6 h). Any city that isn't finished is picked up by the next day's run. |

### One-time setup (repo owner)

1. **Repo secrets:** on GitHub, open the repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `DATABASE_URL`: the Supabase **Session pooler** URI (see below).
   - **One** of:
     - `ANTHROPIC_API_KEY`: from [console.anthropic.com](https://console.anthropic.com) → API Keys (pay per use), **or**
     - `CLAUDE_CODE_OAUTH_TOKEN`: uses your Claude Pro/Max subscription. Run `claude setup-token` in a terminal where Claude Code is installed and paste the token it prints.
2. **Actions enabled:** repo → **Settings → Actions → General** → allow actions (including the third-party `anthropics/claude-code-action`).
3. **Push** this file, `scraper/cities_due.py`, and the workflow to `main`. Scheduled workflows only run from the default branch.
4. **Test:** **Actions → Monthly scrape (Claude) → Run workflow** (leave `stale_days` at 7, or use `0` to force every city).

No Claude GitHub App, SSH key, or personal access token is needed. The workflow uses its own short-lived `GITHUB_TOKEN`.

### `DATABASE_URL` format

Supabase dashboard → project → **Connect** → **Session pooler**. GitHub runners only have IPv4, and the direct `db.<ref>.supabase.co` host is often IPv6-only, so use the pooler.

```text
postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
```

URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, `/` → `%2F`).

---

## 3. Hard rules for Claude

- **Never print, echo, or write `DATABASE_URL`** (or any secret) into files, the step summary, or the issue.
- **Do not edit code, commit, push, or open pull requests.** If code is broken, describe the fix in the issue (§8).
- **Do not install anything.** Dependencies are already installed; use `python`.
- **Do not run `run_monthly_refresh.py --test`.** It scrapes 50 rows per type for Pereira and then marks every other Pereira listing inactive.
- **Do not run `archive_inactive_listings.py --vacuum`.** It locks tables on the live site.
- **Be polite to Finca Raíz.** Do not lower `MIN_DELAY_SEC` / `MAX_DELAY_SEC` and do not run cities in parallel.
- If blocked (HTTP 403/429, captcha, mass page failures), **stop scraping** and follow §6. Do not try to get around the block.
- Data is **listing asking prices**, not appraisals or closed sales. Use that wording in the report.
- Long commands run in the **background**. Poll with `sleep 540` followed by a status check. Each Bash call has a 10-minute limit.

---

## 4. Step-by-step run

### Step 1 — Preflight and "before" numbers

```bash
cd "$GITHUB_WORKSPACE/scraper"
echo "Cities due: $CITIES_DUE"
mkdir -p /tmp/lupacasa-scrape
python - <<'PY' | tee /tmp/lupacasa-scrape/before.txt
import os, psycopg2
c = psycopg2.connect(os.environ["DATABASE_URL"]); cur = c.cursor()
cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM listings")
print("listings total/active:", cur.fetchone())
cur.execute("""SELECT city, COUNT(*) FILTER (WHERE is_active), MAX(last_seen_at)
               FROM listings GROUP BY city ORDER BY 2 DESC LIMIT 25""")
for r in cur.fetchall(): print(r)
c.close()
PY
```

If the connection fails, skip to Step 5 and report the error, **with the password redacted**.

### Step 2 — Safe smoke test (no deactivation)

This scrapes 20 Pereira apartments and upserts them. It does **not** mark anything inactive.

```bash
cd "$GITHUB_WORKSPACE/scraper"
SKIP_DEAL_REFRESH=1 \
LISTING_URL=https://www.fincaraiz.com.co/venta/apartamentos/pereira/risaralda \
CITY_DEFAULT=Pereira DEPARTMENT_DEFAULT=Risaralda \
MAX_LISTINGS_PER_RUN=20 MAX_NO_ACTION_PAGES=2 \
python -u scrape.py
```

**Healthy:** `Page 1: +N actionable rows, M unchanged skipped`, then `Upserted …` and/or `Touched last_seen for …`.
**Blocked / broken:** `Page 1: failed to fetch/parse (...)`. Do not start Step 3. Go to §6 if it's HTTP 403/429/captcha, or §8 if it's `__NEXT_DATA__ script not found`, then go to Step 5.

### Step 3 — Scrape the due cities, one at a time (background)

The loop runs each city separately, stops if a city looks blocked (so inactive-marking can't wipe a city), and won't start a new city after `SCRAPE_DEADLINE`.

```bash
cd "$GITHUB_WORKSPACE/scraper"
export SKIP_DEAL_REFRESH=1 LOG=/tmp/lupacasa-scrape
cat > "$LOG/loop.sh" <<'SH'
for c in $CITIES_DUE; do
  if [ "$(date +%s)" -ge "${SCRAPE_DEADLINE:-9999999999}" ]; then
    echo "TIME_UP before $c" >> "$LOG/status.txt"; exit 0
  fi
  echo "START $c $(date -u +%FT%TZ)" >> "$LOG/status.txt"
  python -u run_all_cities_venta_refresh.py --only "$c" > "$LOG/$c.log" 2>&1
  fails=$(grep -c "^Page 1: failed to fetch/parse" "$LOG/$c.log" || true)
  if [ "$fails" -ge 4 ]; then echo "BLOCKED $c fails=$fails" >> "$LOG/status.txt"; exit 1; fi
  echo "DONE $c fails=$fails $(date -u +%FT%TZ)" >> "$LOG/status.txt"
done
echo "ALL_DONE $(date -u +%FT%TZ)" >> "$LOG/status.txt"
SH
nohup bash "$LOG/loop.sh" > "$LOG/loop.out" 2>&1 &
echo "started"
```

**Poll** (repeat until `status.txt` has `ALL_DONE`, `TIME_UP`, or `BLOCKED`):

```bash
sleep 540; cat /tmp/lupacasa-scrape/status.txt; tail -n 5 /tmp/lupacasa-scrape/loop.out
```

Each city scrapes 8 property types (Casas, Apartaestudios, Lotes, Fincas, Oficinas, Bodegas, Locales, Apartamentos). When a city is `DONE`, read its key lines:

```bash
grep -E "^>>> |^Page 1: failed" /tmp/lupacasa-scrape/<city>.log
```

- `>>> <City> / <Type>: collected N actionable`: new or changed rows. Low numbers are normal because unchanged listings are only "touched".
- `>>> <City>: marked N listings inactive`: normal monthly churn. If N is more than about **half** of that city's active count in `before.txt`, treat it as a partial block (§6).

When the loop ends:

- `ALL_DONE` or `TIME_UP` → Step 4. Cities not reached are retried automatically by tomorrow's run.
- `BLOCKED` → §6, then Step 4.

### Step 4 — Global maintenance

```bash
cd "$GITHUB_WORKSPACE/scraper"
python -u refresh_derived_data.py --soft-shrink --shrink-days 14
python -u archive_inactive_listings.py --apply --days 90
```

This recomputes deal scores (`is_deal`, `deal_score`), refreshes the `zone_list_aggregates` materialized view, shrinks old inactive detail data, and moves listings inactive for over 90 days into `listing_market_facts`. Skip the archive command if §6 happened or if the active count dropped more than 30% versus `before.txt`.

If `refresh_derived_data.py` fails, retry once. If it fails again, report it. Listings are fresh, but deal scores and zone pages stay stale until it succeeds.

### Step 5 — Report (always, even on failure)

Re-run the Step 1 query (without `tee`) for the "after" numbers. Write the report to `/tmp/lupacasa-scrape/report.md` in this format:

```markdown
## LupaCasa monthly scrape — <YYYY-MM-DD>
**Result:** Success / Partial / Failed — one sentence why.

| City | Active before | Active after | Marked inactive | Page-1 failures | Status |
|------|---------------|--------------|-----------------|-----------------|--------|
| …    | …             | …            | …               | …               | done / blocked / not reached |

- Total listings: before → after. Active: before → after.
- Maintenance: deal refresh ✅/❌, zone aggregates ✅/❌, soft-shrink N rows, archived N rows.
- Cities left for the next run: … (or "none").
- Problems / what the owner must do: …
```

Then publish it:

```bash
cat /tmp/lupacasa-scrape/report.md >> "$GITHUB_STEP_SUMMARY"
gh issue create --repo "$GITHUB_REPOSITORY" \
  --title "Monthly scrape $(date -u +%F): <Success|Partial|Failed>" \
  --body-file /tmp/lupacasa-scrape/report.md
```

---

## 5. Health thresholds (quick reference)

| Signal | Meaning | Action |
|--------|---------|--------|
| `Page 1: failed …` 0 per city | Healthy | Continue |
| 1–3 per city | Some property types failed (timeouts, empty types) | Continue, mention in report |
| ≥4 per city | Blocked or the site changed | Loop stops automatically → §6 / §8 |
| `marked N inactive` > 50% of the city's active count | Probably a partial block | Reactivate that city (§6) |
| Global active count drops > 30% | Something went wrong | Skip archive; report as Failed |

---

## 6. If Finca Raíz blocks the run (403 / 429 / captcha / mass failures)

1. Make sure nothing is still scraping: `pkill -f run_all_cities_venta_refresh; pkill -f scrape.py`.
2. Restore the city that was wrongly deactivated. The city id is in the `BLOCKED` line; the DB city name is the third value in its `CITIES` tuple (e.g. `Bogota`, `Santa Marta`):

   ```bash
   cd "$GITHUB_WORKSPACE/scraper"
   python reactivate_listings.py --city "<DB city name>"          # dry run: shows count
   python reactivate_listings.py --apply --city "<DB city name>"
   ```

3. Run Step 4 **without** the archive command, then Step 5 with Result **Partial** or **Failed**.
4. Do not retry, rotate user agents, or change delays. The next scheduled day retries the remaining cities once, which is enough.

Note: stopping a city **halfway** is harmless. Inactive-marking and the snapshot only run after all 8 property types finish. Only a city that *finished* while blocked does damage.

---

## 7. Partial runs and manual reruns

- Cities not finished today are still "due" tomorrow (days 1–4), because `cities_due.py` checks `MAX(last_seen_at)` per city.
- Manual rerun: **Actions → Monthly scrape (Claude) → Run workflow**. `stale_days` = `7` (default) continues where it stopped; `0` re-scrapes every city.
- If all four days fail, the owner reruns manually after fixing the cause.

---

## 8. If the scraper itself is broken

Signs: `__NEXT_DATA__ script not found`, Python tracebacks in `scrape.py` / `db.py`, or every type returning 0 rows without HTTP errors.

Do not mass-retry and do not edit code. In the report's "Problems" section, include the failing URL, the error text (no secrets), the file and function that probably need changing, and a suggested fix. Mark the result **Failed**.

---

## 9. Reference

| File | Purpose |
|------|---------|
| `.github/workflows/monthly-scrape.yml` | Schedule, secrets, Claude step |
| `scraper/cities_due.py` | Lists city ids not refreshed in N days |
| `scraper/run_all_cities_venta_refresh.py` | `CITIES` list + one-city refresh (`--only <id>`) |
| `scraper/venta_runner_common.py` | Multi-pass per property type; marks inactive + monthly snapshot per city |
| `scraper/scrape.py` | Scrapes one listing URL (env: `LISTING_URL`, `CITY_DEFAULT`, `MAX_LISTINGS_PER_RUN`, `START_PAGE`, `MAX_NO_ACTION_PAGES`) |
| `scraper/refresh_derived_data.py` | Deal scores + zone materialized view (+ `--soft-shrink`) |
| `scraper/archive_inactive_listings.py` | Archive inactive > N days to `listing_market_facts` |
| `scraper/reactivate_listings.py` | Undo accidental deactivation |
| `scraper/run_monthly_refresh.py` / `automation_run.sh` | All-in-one manual run (all cities + maintenance, no per-city block guard) |
| `scraper/config.py` | Env defaults (delays, caps); requires `DATABASE_URL` |

Per-type caps: 3000 for Casas/Apartamentos, 1000 for other types. Pagination for a type stops after 3 pages without new or changed rows.

### Running by hand on Windows (owner, optional)

```powershell
cd C:\FlutterProjects\transparancy\scraper
copy .env.example .env      # put DATABASE_URL in .env (git-ignored)
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe cities_due.py
.\.venv\Scripts\python.exe run_monthly_refresh.py --only pereira
```
