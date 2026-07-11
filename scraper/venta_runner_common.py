"""
Shared helpers for venta multi-type city scrapes: keep paging until per-type cap
or catalog exhaustion, then optionally advance to the next city.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent

VENTA_PATHS: list[tuple[str, str]] = [
    ("Casas", "venta/casas"),
    ("Apartaestudios", "venta/apartaestudios"),
    ("Lotes", "venta/lotes"),
    ("Fincas", "venta/fincas"),
    ("Oficinas", "venta/oficinas"),
    ("Bodegas", "venta/bodegas"),
    ("Locales", "venta/locales"),
    ("Apartamentos", "venta/apartamentos"),
]

_HEAVY_PATHS = frozenset({"venta/casas", "venta/apartamentos"})

RE_PREPARED = re.compile(
    r"Prepared\s+(\d+)\s+actionable rows from listing-page",
    re.I,
)
RE_PAGE_LINE = re.compile(r"^Page\s+(\d+):", re.M)


def parse_scrape_output(stdout: str) -> tuple[int, int]:
    """Return (prepared_count, max_page_seen). max_page_seen is 0 if unknown."""
    m = RE_PREPARED.search(stdout)
    prepared = int(m.group(1)) if m else 0
    pages = [int(x) for x in RE_PAGE_LINE.findall(stdout)]
    max_page = max(pages) if pages else 0
    return prepared, max_page


def scrape_until_cap(
    *,
    listing_url: str,
    city_default: str,
    department_default: str,
    cap: int,
    start_page: int = 1,
    max_stale_pages: int = 3,
    max_passes: int = 500,
) -> tuple[int, list[str]]:
    """
    Run scrape.py in a loop until total prepared >= cap, or a pass adds nothing,
    or max_passes. Each pass uses MAX_LISTINGS_PER_RUN = remaining cap and
    START_PAGE = last_max_page + 1 from the previous pass.

    Returns (total_prepared_across_passes, log_lines).
    """
    if cap <= 0:
        return 0, []

    py = sys.executable
    scrape_py = ROOT / "scrape.py"
    total = 0
    next_start = max(1, start_page)
    logs: list[str] = []

    for _ in range(max_passes):
        remaining = cap - total
        if remaining <= 0:
            break

        env = os.environ.copy()
        env["LISTING_URL"] = listing_url
        env["CITY_DEFAULT"] = city_default
        env["DEPARTMENT_DEFAULT"] = department_default
        env["MAX_LISTINGS_PER_RUN"] = str(remaining)
        env["START_PAGE"] = str(next_start)
        env["MAX_NO_ACTION_PAGES"] = str(max(1, max_stale_pages))

        proc = subprocess.run(
            [py, str(scrape_py)],
            cwd=str(ROOT),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        sys.stdout.write(out)
        sys.stdout.flush()

        prepared, max_page = parse_scrape_output(out)
        logs.append(
            f"pass start={next_start} prepared={prepared} max_page={max_page} exit={proc.returncode}"
        )

        if proc.returncode != 0:
            logs.append("scrape.py non-zero exit; stopping this type.")
            break

        total += prepared

        if prepared == 0:
            break
        if total >= cap:
            break

        if max_page <= 0:
            logs.append(
                "warning: no Page lines parsed; stopping to avoid a tight loop."
            )
            break
        next_start = max_page + 1

    return total, logs


def print_city_db_report(city_where_ilike: str) -> None:
    """Print rows by property_type for listings.city ILIKE pattern."""
    from dotenv import load_dotenv
    import psycopg2

    load_dotenv(ROOT / ".env")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COALESCE(property_type, '(null)'), COUNT(*)
        FROM listings
        WHERE city ILIKE %s
        GROUP BY 1
        ORDER BY 2 DESC
        """,
        (city_where_ilike,),
    )
    rows = cur.fetchall()
    cur.execute(
        "SELECT COUNT(*) FROM listings WHERE city ILIKE %s",
        (city_where_ilike,),
    )
    total = cur.fetchone()[0]
    conn.close()

    print("\n" + "=" * 60)
    print(f"DB — rows by property_type (city ILIKE {city_where_ilike!r})")
    print("=" * 60)
    for pt, n in rows:
        print(f"  {pt}: {n}")
    print(f"  TOTAL: {total}")
    print("=" * 60)


def run_city_venta_types(
    *,
    city_slug: str,
    city_default: str,
    department_default: str,
    city_label: str,
    db_report_ilike: str,
    default_max: int = 1000,
    casas_apto_max: int = 3000,
    stale_pages: int = 3,
) -> None:
    """
    For each venta path, scrape until per-type cap or exhaustion (multi-pass).
    """
    run_started_at = datetime.now(timezone.utc)
    base = "https://www.fincaraiz.com.co"
    for plabel, path in VENTA_PATHS:
        cap = casas_apto_max if path in _HEAVY_PATHS else default_max
        listing_url = f"{base}/{path.strip('/')}/{city_slug.strip('/')}"
        print(
            f"\n{'=' * 60}\n{city_label} — {plabel} — {listing_url}\n"
            f"(target cap {cap}, multi-pass until cap or exhaustion)\n{'=' * 60}\n",
            flush=True,
        )
        total, _logs = scrape_until_cap(
            listing_url=listing_url,
            city_default=city_default,
            department_default=department_default,
            cap=cap,
            start_page=1,
            max_stale_pages=stale_pages,
        )
        print(
            f"\n>>> {city_label} / {plabel}: collected {total} actionable (target {cap})\n",
            flush=True,
        )

    from db import connect, mark_inactive_listings

    conn = connect()
    try:
        marked = mark_inactive_listings(
            conn,
            run_started_at=run_started_at,
            city=city_default,
        )
        print(
            f"\n>>> {city_label}: marked {marked} listings inactive "
            f"(not seen during this city refresh).\n",
            flush=True,
        )
    finally:
        conn.close()

    print_city_db_report(db_report_ilike)
    print(f"\nDone all venta property types for {city_label}.")
