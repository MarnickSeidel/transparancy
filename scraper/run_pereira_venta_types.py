#!/usr/bin/env python3
"""
Run scrape.py per Pereira (Risaralda) venta property path.

Caps (per type, multi-pass until reached or index ends):
  - casas + apartamentos: 3000 actionable rows each (override with --casas-apto-max)
  - all other types: 1000 each (override with --default-max)

Usage:
  .\\.venv\\Scripts\\python.exe run_pereira_venta_types.py
"""

from __future__ import annotations

import argparse
import sys

from venta_runner_common import run_city_venta_types


def main() -> int:
    ap = argparse.ArgumentParser(description="Scrape Pereira venta by property type.")
    ap.add_argument("--default-max", type=int, default=1000, metavar="N")
    ap.add_argument("--casas-apto-max", type=int, default=3000, metavar="N")
    ap.add_argument("--stale-pages", type=int, default=3, metavar="N")
    args = ap.parse_args()

    run_city_venta_types(
        city_slug="pereira/risaralda",
        city_default="Pereira",
        department_default="Risaralda",
        city_label="Pereira",
        db_report_ilike="Pereira",
        default_max=args.default_max,
        casas_apto_max=args.casas_apto_max,
        stale_pages=args.stale_pages,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
