#!/usr/bin/env python3
"""
Monthly refresh entry point for Cursor Automations / cron.

Requires DATABASE_URL (Supabase direct connection, port 5432).

Usage:
  python run_monthly_refresh.py              # full all-cities refresh
  python run_monthly_refresh.py --test       # Pereira only, low caps (smoke test)
  python run_monthly_refresh.py --only cali  # single city
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from run_all_cities_venta_refresh import CITIES
from venta_runner_common import run_city_venta_types

TEST_DEFAULT_MAX = 50
TEST_CASAS_APTO_MAX = 50


def require_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print(
            "DATABASE_URL is not set. Configure it as an automation secret "
            "or in scraper/.env.",
            file=sys.stderr,
        )
        sys.exit(1)
    return url


def verify_db_connection(url: str) -> None:
    try:
        conn = psycopg2.connect(url)
        conn.close()
    except psycopg2.Error as exc:
        print(f"Cannot connect to database: {exc}", file=sys.stderr)
        sys.exit(1)


def print_global_summary(url: str) -> None:
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM listings")
    total = cur.fetchone()[0]
    cur.execute(
        """
        SELECT COUNT(*) FROM listings
        WHERE last_seen_at >= NOW() - INTERVAL '24 hours'
        """
    )
    seen_24h = cur.fetchone()[0]
    cur.execute(
        """
        SELECT city, COUNT(*) AS n
        FROM listings
        GROUP BY city
        ORDER BY n DESC
        LIMIT 10
        """
    )
    top = cur.fetchall()
    conn.close()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    print("\n" + "=" * 60)
    print(f"MONTHLY REFRESH SUMMARY ({now})")
    print("=" * 60)
    print(f"  Total listings in DB:     {total:,}")
    print(f"  Listings seen last 24h:   {seen_24h:,}")
    print("  Top cities:")
    for city, n in top:
        print(f"    {city}: {n:,}")
    print("=" * 60)


def main() -> int:
    ap = argparse.ArgumentParser(description="Monthly venta refresh for all cities.")
    ap.add_argument(
        "--test",
        action="store_true",
        help="Smoke test: Pereira only with low per-type caps.",
    )
    ap.add_argument("--only", metavar="ID", help="Run one city id (e.g. pereira)")
    ap.add_argument(
        "--skip",
        metavar="ID",
        action="append",
        default=[],
        help="Skip city id(s); repeatable",
    )
    ap.add_argument("--default-max", type=int, default=1000, metavar="N")
    ap.add_argument("--casas-apto-max", type=int, default=3000, metavar="N")
    ap.add_argument("--stale-pages", type=int, default=3, metavar="N")
    args = ap.parse_args()

    if args.test:
        args.only = "pereira"
        args.default_max = TEST_DEFAULT_MAX
        args.casas_apto_max = TEST_CASAS_APTO_MAX
        print(
            f"TEST MODE: Pereira only, caps {TEST_DEFAULT_MAX}/{TEST_CASAS_APTO_MAX}\n",
            flush=True,
        )

    url = require_database_url()
    verify_db_connection(url)

    only = (args.only or "").strip().lower()
    skip = {s.strip().lower() for s in args.skip if s.strip()}

    ran = 0
    for cid, slug, cdef, ddef, dblike in CITIES:
        key = cid.lower()
        if only and key != only:
            continue
        if key in skip:
            print(f"\nSkipping {cid} (--skip).", flush=True)
            continue

        label = cid.replace("-", " ").title()
        print("\n" + "#" * 70, flush=True)
        print(f"# CITY {ran + 1}: {label}", flush=True)
        print("#" * 70 + "\n", flush=True)
        run_city_venta_types(
            city_slug=slug,
            city_default=cdef,
            department_default=ddef,
            city_label=label,
            db_report_ilike=dblike,
            default_max=args.default_max,
            casas_apto_max=args.casas_apto_max,
            stale_pages=args.stale_pages,
        )
        ran += 1

    if ran == 0:
        print("No cities ran. Check --only / --skip ids.", file=sys.stderr)
        return 1

    print(f"\nFinished refresh: {ran} city/cities.", flush=True)
    print_global_summary(url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
