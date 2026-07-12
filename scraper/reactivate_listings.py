#!/usr/bin/env python3
"""
Reactivate listings likely marked inactive by the skip-without-touch scraper bug.

Usage:
  python reactivate_listings.py              # dry-run (count only)
  python reactivate_listings.py --apply      # reactivate in DB
  python reactivate_listings.py --apply --city Pereira
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from db import connect, reactivate_accidental_inactive


def main() -> int:
    ap = argparse.ArgumentParser(description="Reactivate accidentally deactivated listings.")
    ap.add_argument("--apply", action="store_true", help="Apply updates (default is dry-run).")
    ap.add_argument("--city", metavar="NAME", help="Limit to one city (e.g. Pereira).")
    ap.add_argument("--lookback-days", type=int, default=90, metavar="N")
    args = ap.parse_args()

    conn = connect()
    try:
        result = reactivate_accidental_inactive(
            conn,
            city=args.city,
            lookback_days=args.lookback_days,
            dry_run=not args.apply,
        )
    finally:
        conn.close()

    mode = "APPLIED" if args.apply else "DRY-RUN"
    print(f"[{mode}] Candidates: {result['candidates']:,}")
    if args.apply:
        print(f"Reactivated: {result['reactivated']:,}")
    else:
        print("Run with --apply to reactivate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
