#!/usr/bin/env python3
"""
Archive aged inactive listings into thin market facts, then delete full rows.

Keeps per-listing ppm2 + barrio/estrato + market window for trends.
Optionally VACUUM FULL to reclaim disk (needed for Supabase size meter).

Usage:
  python archive_inactive_listings.py                     # dry-run
  python archive_inactive_listings.py --apply             # archive + delete
  python archive_inactive_listings.py --apply --vacuum    # + VACUUM FULL
  python archive_inactive_listings.py --apply --days 90

Periodic: runs automatically at the end of run_monthly_refresh.py (archive only;
  vacuum is manual / optional because it locks listings briefly).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from db import archive_inactive_to_facts, connect, vacuum_listings_full


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Archive aged inactive listings to listing_market_facts."
    )
    ap.add_argument(
        "--apply",
        action="store_true",
        help="Write facts and delete full listing rows (default dry-run).",
    )
    ap.add_argument(
        "--days",
        type=int,
        default=90,
        metavar="N",
        help="Archive inactive listings with last_seen older than N days (default 90).",
    )
    ap.add_argument("--city", metavar="NAME", help="Limit to one city (ILIKE).")
    ap.add_argument(
        "--batch-size",
        type=int,
        default=2000,
        metavar="N",
        help="Rows per batch (default 2000).",
    )
    ap.add_argument(
        "--vacuum",
        action="store_true",
        help="After apply, VACUUM FULL listings + facts (locks tables; reclaim disk).",
    )
    args = ap.parse_args()

    if args.days < 1:
        print("--days must be >= 1", file=sys.stderr)
        return 1
    if args.vacuum and not args.apply:
        print("--vacuum requires --apply", file=sys.stderr)
        return 1

    try:
        conn = connect()
    except Exception as exc:
        print(f"Cannot connect to database: {exc}", file=sys.stderr)
        return 1

    try:
        result = archive_inactive_to_facts(
            conn,
            min_inactive_days=args.days,
            dry_run=not args.apply,
            batch_size=args.batch_size,
            city=args.city,
        )
    except Exception as exc:
        print(f"Archive failed: {exc}", file=sys.stderr)
        conn.close()
        return 1

    mode = "APPLIED" if args.apply else "DRY-RUN"
    scope = f"city ILIKE {args.city!r}" if args.city else "all cities"
    print(f"[{mode}] Archive inactive > {result['min_inactive_days']}d ({scope})")
    print(f"  Candidates: {result['candidates']:,}")
    if args.apply:
        print(f"  Facts upserted: {result['archived']:,}")
        print(f"  Listings deleted: {result['deleted']:,}")
    else:
        print("  Run with --apply to archive + delete.")

    if args.vacuum:
        print("  Running VACUUM FULL listings + listing_market_facts…", flush=True)
        try:
            vacuum_listings_full(conn)
            print("  VACUUM FULL done.", flush=True)
        except Exception as exc:
            print(f"VACUUM FULL failed: {exc}", file=sys.stderr)
            conn.close()
            return 1

    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
