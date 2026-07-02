#!/usr/bin/env python3
"""
Run scrape.py per Bogotá (D.C.) venta property path.

Caps:
  - casas + apartamentos: 2000 actionable rows each (override with --casas-apto-max)
  - all other types: 1000 each (override with --default-max)

Stops after MAX_NO_ACTION_PAGES (default 3) with no new actionable rows per type.

Usage:
  .\\.venv\\Scripts\\python.exe run_bogota_venta_types.py
  .\\.venv\\Scripts\\python.exe run_bogota_venta_types.py --default-max 500 --casas-apto-max 1000
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

BASE = "https://www.fincaraiz.com.co"
CITY_SLUG = "bogota/bogota-dc"

# Order: casas first, apartamentos last.
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


def main() -> int:
    ap = argparse.ArgumentParser(description="Scrape Bogotá venta by property type.")
    ap.add_argument(
        "--default-max",
        type=int,
        default=1000,
        metavar="N",
        help="Max actionable rows for types other than casas/apartamentos (default 1000)",
    )
    ap.add_argument(
        "--casas-apto-max",
        type=int,
        default=2000,
        metavar="N",
        help="Max actionable rows for casas and apartamentos (default 2000)",
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
        cap = (
            max(0, args.casas_apto_max)
            if path in _HEAVY_PATHS
            else max(0, args.default_max)
        )

        listing_url = f"{BASE}/{path.strip('/')}/{CITY_SLUG}"
        print(
            f"\n{'=' * 60}\n{label} — {listing_url}\n(cap {cap})\n{'=' * 60}\n",
            flush=True,
        )

        env = os.environ.copy()
        env["LISTING_URL"] = listing_url
        env["CITY_DEFAULT"] = "Bogota"
        env["DEPARTMENT_DEFAULT"] = "Bogota D.C."
        env["MAX_LISTINGS_PER_RUN"] = str(cap)
        env["START_PAGE"] = "1"
        env["MAX_NO_ACTION_PAGES"] = str(max(1, args.stale_pages))

        code = subprocess.run([py, str(scrape_py)], cwd=str(ROOT), env=env).returncode
        if code != 0:
            print(f"Warning: {label} exited with code {code}; continuing.", file=sys.stderr)

    print("\nDone all Bogotá venta property types in this runner.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
