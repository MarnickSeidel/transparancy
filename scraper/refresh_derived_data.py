#!/usr/bin/env python3
"""
Refresh derived DB state without scraping.

Recomputes deal scores and refreshes the zone_list_aggregates materialized view.
Run after a monthly refresh, or any time listing data changed outside scrape.py.

Usage:
  python refresh_derived_data.py
  python refresh_derived_data.py --city Pereira
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from db import connect, refresh_deals_after_scrape, refresh_zone_list_aggregates


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Refresh deal scores and zone aggregates (no scraping)."
    )
    ap.add_argument(
        "--city",
        metavar="NAME",
        help="Limit deal refresh to one city (ILIKE match). MV refresh is always global.",
    )
    args = ap.parse_args()

    city = (args.city or "").strip() or None

    try:
        conn = connect()
    except Exception as exc:
        print(f"Cannot connect to database: {exc}", file=sys.stderr)
        return 1

    try:
        scope = f"city ILIKE {city!r}" if city else "all active listings"
        print(f"Refreshing deal scores for {scope}…", flush=True)
        refresh_deals_after_scrape(conn, city=city)
        print("Deal scores updated.", flush=True)

        print("Refreshing zone_list_aggregates materialized view…", flush=True)
        refresh_zone_list_aggregates(conn)
        print("Zone aggregates refreshed.", flush=True)
    except Exception as exc:
        print(f"Refresh failed: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()

    print("Done.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
