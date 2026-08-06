#!/usr/bin/env python3
"""
Soft-shrink aged inactive listings: drop detail blobs, keep market facts.

Nulls description, facilities, technical_sheet, quality_flags, address,
owner_name, image_url, and location_path on inactive rows older than N days.
Preserves external_id, prices, areas, barrio/estrato, and first/last seen so
trends and reactivation still work.

Usage:
  python soft_shrink_inactive.py                  # dry-run
  python soft_shrink_inactive.py --apply          # write
  python soft_shrink_inactive.py --apply --days 14
  python soft_shrink_inactive.py --apply --city Pereira

Periodic:
  - Runs automatically at the end of run_monthly_refresh.py
  - Or schedule this script weekly, e.g. Windows Task Scheduler / cron:
      cd /path/to/scraper && python soft_shrink_inactive.py --apply
  - Or with derived refresh:
      python refresh_derived_data.py --soft-shrink
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from db import connect, soft_shrink_inactive


def _fmt_mb(n: int) -> str:
    return f"{n / 1024 / 1024:.1f} MB"


def main() -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Null heavy detail fields on aged inactive listings "
            "(keeps trend/reactivation columns)."
        )
    )
    ap.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates (default is dry-run).",
    )
    ap.add_argument(
        "--days",
        type=int,
        default=14,
        metavar="N",
        help="Only shrink inactive listings with last_seen older than N days (default 14).",
    )
    ap.add_argument("--city", metavar="NAME", help="Limit to one city (ILIKE).")
    ap.add_argument(
        "--batch-size",
        type=int,
        default=5000,
        metavar="N",
        help="Rows per UPDATE batch (default 5000).",
    )
    args = ap.parse_args()

    if args.days < 1:
        print("--days must be >= 1", file=sys.stderr)
        return 1

    try:
        conn = connect()
    except Exception as exc:
        print(f"Cannot connect to database: {exc}", file=sys.stderr)
        return 1

    try:
        result = soft_shrink_inactive(
            conn,
            min_inactive_days=args.days,
            dry_run=not args.apply,
            batch_size=args.batch_size,
            city=args.city,
        )
    except Exception as exc:
        print(f"Soft-shrink failed: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()

    mode = "APPLIED" if args.apply else "DRY-RUN"
    scope = f"city ILIKE {args.city!r}" if args.city else "all cities"
    print(f"[{mode}] Soft-shrink inactive > {result['min_inactive_days']}d ({scope})")
    print(f"  Candidates (still have detail blobs): {result['candidates']:,}")
    print(f"  Approx reclaimable detail payload:    {_fmt_mb(result['approx_bytes'])}")
    if args.apply:
        print(f"  Rows updated:                         {result['updated']:,}")
        print("  Note: Postgres may need VACUUM later to reclaim disk files.")
    else:
        print("  Run with --apply to null those fields.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
