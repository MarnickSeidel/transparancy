# Monthly scrape — runbook for Claude (GitHub Actions)

This file is the **instruction set** for Claude Code when it runs inside `.github/workflows/monthly-scrape.yml`. If you are Claude: read this whole file, then follow §4 in order.

---

## 1. What the job is

LupaCasa (`web/`, Next.js) shows Colombian residential **listing asking prices** from [Finca Raíz](https://www.fincaraiz.com.co). The Python scraper in `scraper/` reads Finca Raíz listing pages (plain HTTP + the page's `__NEXT_DATA__` JSON, no browser) and writes rows into the production **PostgreSQL database on Supabase**. The website reads that same database.

Each month every city in `CITIES` (`scraper/run_all_cities_venta_refresh.py`) is re-scraped for all *venta* property types. When a city **finishes**, listings that weren't seen are marked inactive and a monthly price snapshot is saved. Afterwards, deal scores and the `zone_list_aggregates` materialized view are refreshed, old inactive rows are shrunk, and listings inactive for over 90 days are archived.

---

## 2. How the workflow works

The **workflow does the scraping**. **Claude runs last** to review the logs, fix problems, and report.

| Step | What it does | Output in `.scrape-logs/` (env `LOG`) |
|------|--------------|----------------------------------------|
| Find cities due | `scraper/cities_due.py`: cities not refreshed in the last 7 days. If none are due, everything else is skipped. | `cities_due.txt` |
| Record before numbers | Listing counts per city | `before.txt` |
| Smoke test | Scrapes 20 Pereira apartments (no deactivation) | `smoke.log`; `SMOKE_OK` / `SMOKE_FAILED` in `status.txt` |
| Scrape due cities | One city at a time. Stops if a city looks blocked (≥4 of its 8 property types fail on page 1). Won't start a new city after 3.5 h. | `<city>.log`; `START` / `DONE` / `BLOCKED` / `TIME_UP` / `ALL_DONE` in `status.txt` |
| Maintenance | `refresh_derived_data.py --soft-shrink`, then `archive_inactive_listings.py --apply --days 90` | `maintenance.log` |
| **Claude reviews and reports** | §4 below | report + GitHub issue |

Schedule: `0 6 1-4 * *` (days 1–4, 06:00 UTC). Cities that didn't finish are due again the next day. Manual run: **Actions → Monthly scrape (Claude) → Run workflow** (`stale_days` `0` = every city).

Env available to Claude: `DATABASE_URL` (secret), `LOG`, `GH_TOKEN` (for `gh issue create`), `GITHUB_STEP_SUMMARY`, `GITHUB_WORKSPACE`, `GITHUB_REPOSITORY`. Python deps are installed; use `python`.

### One-time setup (repo owner)

1. Repo secrets (**Settings → Secrets and variables → Actions**):
   - `DATABASE_URL`: Supabase **Session pooler** URI (`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`). The direct `db.<ref>.supabase.co` host is IPv6-only and fails on GitHub runners.
   - **One** of `CLAUDE_CODE_OAUTH_TOKEN` (Claude Pro/Max, from `claude setup-token`) or `ANTHROPIC_API_KEY` (console.anthropic.com).
2. Workflow, `scraper/cities_due.py`, and this file pushed to `main`.

---

## 3. Hard rules for Claude

- **Never print or write `DATABASE_URL`** (or any secret) into files, the step summary, or the issue.
- **Do not scrape.** Don't run `scrape.py`, `run_all_cities_venta_refresh.py`, or `run_monthly_refresh.py`. The workflow already did that.
- **Do not edit code, commit, push, or open pull requests.** Describe needed fixes in the issue (§6).
- **Do not run `archive_inactive_listings.py --vacuum`.** It locks tables on the live site.
- Read logs with `cat` / `grep` / `tail` via Bash. Write files only inside `$LOG`.
- Data is **listing asking prices**, not appraisals or closed sales. Use that wording in the report.

---

## 4. Steps for Claude

### Step 1 — Read what happened

```bash
cd "$GITHUB_WORKSPACE/scraper"
cat "$LOG/cities_due.txt" "$LOG/status.txt" "$LOG/before.txt"
tail -n 20 "$LOG/smoke.log"
for f in "$LOG"/*.log; do echo "== $f"; grep -E "^>>> |^Page 1: failed|Traceback|Error" "$f" | tail -n 30; done
tail -n 20 "$LOG/maintenance.log"
```

How to read `status.txt`:

| Line | Meaning |
|------|---------|
| `SMOKE_FAILED` | Nothing was scraped. Look at `smoke.log`: HTTP 403/429/captcha = blocked (§5); `__NEXT_DATA__ script not found` or a traceback = scraper broken (§6). |
| `DONE <city> fails=N` | City finished. N = property types whose page 1 failed (0 is healthy, 1–3 is worth mentioning). |
| `START <city>` with no matching `DONE` | City was cut off by the time limit. Harmless (nothing marked inactive); it will be retried tomorrow. |
| `BLOCKED <city>` | The city finished while blocked, so its listings were probably wrongly marked inactive → §5. |
| `TIME_UP before <city>` | Remaining cities will run tomorrow. Normal. |
| `ALL_DONE` | Every due city finished. |

Also check each finished city's `>>> <City>: marked N listings inactive` line. If N is more than about **half** of that city's active count in `before.txt`, treat the city as blocked (§5) even without a `BLOCKED` line.

### Step 2 — Fix blocked cities (only if needed)

For each blocked city, follow §5. If you reactivated anything, refresh deal scores again so the reactivated listings are scored:

```bash
cd "$GITHUB_WORKSPACE/scraper" && python -u refresh_derived_data.py
```

If `maintenance.log` shows `refresh_derived_data.py` failed, run the same command once. If it fails again, report it. Listings are fresh, but deal scores and zone pages stay stale until it succeeds.

### Step 3 — After numbers

```bash
cd "$GITHUB_WORKSPACE/scraper"
python - <<'PY'
import os, psycopg2
c = psycopg2.connect(os.environ["DATABASE_URL"]); cur = c.cursor()
cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM listings")
print("listings total/active:", cur.fetchone())
cur.execute("""SELECT city, COUNT(*) FILTER (WHERE is_active), MAX(last_seen_at)
               FROM listings GROUP BY city ORDER BY 2 DESC LIMIT 25""")
for r in cur.fetchall(): print(r)
c.close()
PY
python cities_due.py --days 7   # cities still left for the next run
```

### Step 4 — Report (always, even if everything failed)

Write `$LOG/report.md` (use a Bash heredoc) in this format:

```markdown
## LupaCasa monthly scrape — <YYYY-MM-DD>
**Result:** Success / Partial / Failed — one sentence why.

| City | Active before | Active after | Marked inactive | Page-1 failures | Status |
|------|---------------|--------------|-----------------|-----------------|--------|
| …    | …             | …            | …               | …               | done / blocked (reactivated) / cut off / not reached |

- Total listings: before → after. Active: before → after.
- Maintenance: deal refresh ✅/❌, zone aggregates ✅/❌, soft-shrink N rows, archived N rows.
- Cities left for the next run: … (or "none").
- Problems / what the owner must do: …
```

**Success** = `ALL_DONE`, no blocks, maintenance OK. **Partial** = some cities cut off, blocked, or not reached. **Failed** = smoke test failed, nothing scraped, or maintenance failed twice.

Publish it:

```bash
cat "$LOG/report.md" >> "$GITHUB_STEP_SUMMARY"
gh issue create --repo "$GITHUB_REPOSITORY" \
  --title "Monthly scrape $(date -u +%F): <Success|Partial|Failed>" \
  --body-file "$LOG/report.md"
```

---

## 5. Blocked city (403 / 429 / captcha / mass failures)

The city's listings were marked inactive because the scraper couldn't see them. Restore them. The DB city name is the third value in the city's `CITIES` tuple (e.g. `bogota` → `Bogota`, `santa-marta` → `Santa Marta`):

```bash
cd "$GITHUB_WORKSPACE/scraper"
python reactivate_listings.py --city "<DB city name>"          # dry run: shows count
python reactivate_listings.py --apply --city "<DB city name>"
```

Then do Step 2's deal refresh. Mark the result **Partial**. Don't retry the scrape; the next scheduled day retries remaining cities once.

---

## 6. Scraper broken

Signs: `__NEXT_DATA__ script not found`, Python tracebacks in `scrape.py` / `db.py`, or every type returning 0 rows without HTTP errors.

Don't edit code. In the report's "Problems" section, include the failing URL, the error text (no secrets), the file and function that probably need changing, and a suggested fix. Mark the result **Failed**.

---

## 7. Reference

| File | Purpose |
|------|---------|
| `.github/workflows/monthly-scrape.yml` | Schedule, secrets, scrape + maintenance steps, Claude step |
| `scraper/cities_due.py` | Lists city ids not refreshed in N days |
| `scraper/run_all_cities_venta_refresh.py` | `CITIES` list + one-city refresh (`--only <id>`) |
| `scraper/venta_runner_common.py` | Multi-pass per property type; marks inactive + monthly snapshot when a city finishes |
| `scraper/scrape.py` | Scrapes one listing URL |
| `scraper/refresh_derived_data.py` | Deal scores + zone materialized view (+ `--soft-shrink`) |
| `scraper/archive_inactive_listings.py` | Archive inactive > N days to `listing_market_facts` |
| `scraper/reactivate_listings.py` | Undo accidental deactivation |
| `scraper/run_monthly_refresh.py` / `automation_run.sh` | All-in-one manual run (no per-city block guard) |

Per-type caps: 3000 for Casas/Apartamentos, 1000 for other types. Pagination for a type stops after 3 pages without new or changed rows.

### Running by hand on Windows (owner, optional)

`scraper/.env` needs the same Session pooler `DATABASE_URL`.

```powershell
cd C:\FlutterProjects\transparancy\scraper
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe cities_due.py
.\.venv\Scripts\python.exe run_monthly_refresh.py --only pereira
```
