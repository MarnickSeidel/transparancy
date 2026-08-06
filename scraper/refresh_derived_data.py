#!/usr/bin/env python3
"""
Refresh derived DB state without scraping.

Recomputes deal scores and refreshes the zone_list_aggregates materialized view.
Optionally soft-shrinks aged inactive listing detail blobs.

Usage:
  python refresh_derived_data.py
  python refresh_derived_data.py --city Pereira
  python refresh_derived_data.py --soft-shrink
  python refresh_derived_data.py --soft-shrink --shrink-days 14
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from db import (
    connect,
    refresh_deals_after_scrape,
    refresh_zone_list_aggregates,
    soft_shrink_inactive,
)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Refresh deal scores and zone aggregates (no scraping)."
    )
    ap.add_argument(
        "--city",
        metavar="NAME",
        help="Limit deal refresh to one city (ILIKE match). MV refresh is always global.",
    )
    ap.add_argument(
        "--soft-shrink",
        action="store_true",
        help="Also null detail blobs on inactive listings older than --shrink-days.",
    )
    ap.add_argument(
        "--shrink-days",
        type=int,
        default=14,
        metavar="N",
        help="Min inactive age in days for --soft-shrink (default 14).",
    )
    args = ap.parse_args()

    city = (args.city or "").strip() or None
    if args.soft_shrink and args.shrink_days < 1:
        print("--shrink-days must be >= 1", file=sys.stderr)
        return 1

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

        if args.soft_shrink:
            print(
                f"Soft-shrinking inactive listings older than {args.shrink_days}d…",
                flush=True,
            )
            result = soft_shrink_inactive(
                conn,
                min_inactive_days=args.shrink_days,
                dry_run=False,
                city=city,
            )
            mb = result["approx_bytes"] / 1024 / 1024
            print(
                f"  Updated {result['updated']:,} rows "
                f"(~{mb:.1f} MB detail payload was eligible).",
                flush=True,
            )
    except Exception as exc:
        print(f"Refresh failed: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()

    print("Done.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
