#!/usr/bin/env python3
"""
Print city ids (from CITIES) not refreshed within the last N days.

Used by the monthly GitHub Actions scrape to resume partial runs.

Usage:
  python cities_due.py              # cities not seen in the last 7 days
  python cities_due.py --days 0     # every city
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from run_all_cities_venta_refresh import CITIES


def main() -> int:
    ap = argparse.ArgumentParser(description="List cities due for a refresh.")
    ap.add_argument("--days", type=int, default=7, metavar="N")
    args = ap.parse_args()

    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("DATABASE_URL is not set.", file=sys.stderr)
        return 1

    conn = psycopg2.connect(url)
    try:
        cur = conn.cursor()
        due: list[str] = []
        for cid, _slug, _cdef, _ddef, dblike in CITIES:
            cur.execute(
                """
                SELECT COALESCE(
                  MAX(last_seen_at) > NOW() - (%s * interval '1 day'), false
                )
                FROM listings
                WHERE city ILIKE %s
                """,
                (max(0, args.days), dblike),
            )
            if not cur.fetchone()[0]:
                due.append(cid)
    finally:
        conn.close()

    print(" ".join(due))
    return 0


if __name__ == "__main__":
    sys.exit(main())
