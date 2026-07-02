#!/usr/bin/env python3
"""
Run scrape.py once per Cali (Valle del Cauca) venta property path: up to 1000
actionable rows each, stopping after MAX_NO_ACTION_PAGES (default 3) with no
new actionable rows.

Starts with casas, then other types; apartamentos last.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

BASE = "https://www.fincaraiz.com.co"
CITY_SLUG = "cali/valle-del-cauca"

# (label, path under host, no trailing slash) — order matters: casas first.
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


def main() -> int:
    ap = argparse.ArgumentParser(description="Scrape Cali venta by property type.")
    ap.add_argument(
        "--max",
        type=int,
        default=1000,
        metavar="N",
        help="Max actionable listings per property type (default 1000)",
    )
    ap.add_argument(
        "--stale-pages",
        type=int,
        default=3,
        metavar="N",
        help="Consecutive pages with no actionable rows before stopping (default 3)",
    )
    args = ap.parse_args()

    py = sys.executable
    scrape_py = ROOT / "scrape.py"

    for label, path in VENTA_PATHS:
        listing_url = f"{BASE}/{path.strip('/')}/{CITY_SLUG}"
        print(f"\n{'=' * 60}\n{label} — {listing_url}\n{'=' * 60}\n", flush=True)

        env = os.environ.copy()
        env["LISTING_URL"] = listing_url
        env["CITY_DEFAULT"] = "Cali"
        env["DEPARTMENT_DEFAULT"] = "Valle del Cauca"
        env["MAX_LISTINGS_PER_RUN"] = str(max(0, args.max))
        env["START_PAGE"] = "1"
        env["MAX_NO_ACTION_PAGES"] = str(max(1, args.stale_pages))

        code = subprocess.run([py, str(scrape_py)], cwd=str(ROOT), env=env).returncode
        if code != 0:
            print(f"Warning: {label} exited with code {code}; continuing.", file=sys.stderr)

    print("\nDone all Cali venta property types in this runner.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
