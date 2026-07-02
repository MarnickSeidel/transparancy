#!/usr/bin/env python3
"""
Run +1000 actionable rows for Bogotá property types that did not previously
reach the requested cap. Starts at page 1 so unchanged rows are skipped and
any newly visible listings can still be captured.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

TARGETS: list[tuple[str, str]] = [
    ("Apartaestudios", "venta/apartaestudios"),
    ("Lotes", "venta/lotes"),
    ("Fincas", "venta/fincas"),
    ("Oficinas", "venta/oficinas"),
    ("Bodegas", "venta/bodegas"),
    ("Locales", "venta/locales"),
]


def main() -> int:
    py = sys.executable
    scrape_py = ROOT / "scrape.py"
    cap = max(0, int(os.environ.get("EXTRA_CAP", "1000")))
    stale = max(1, int(os.environ.get("MAX_NO_ACTION_PAGES", "3")))

    for label, path in TARGETS:
        listing_url = f"https://www.fincaraiz.com.co/{path}/bogota/bogota-dc"
        print(f"\n{'=' * 60}\n+{cap} {label} — {listing_url}\n{'=' * 60}\n", flush=True)
        env = os.environ.copy()
        env["LISTING_URL"] = listing_url
        env["CITY_DEFAULT"] = "Bogota"
        env["DEPARTMENT_DEFAULT"] = "Bogota D.C."
        env["MAX_LISTINGS_PER_RUN"] = str(cap)
        env["START_PAGE"] = "1"
        env["MAX_NO_ACTION_PAGES"] = str(stale)
        code = subprocess.run([py, str(scrape_py)], cwd=str(ROOT), env=env).returncode
        if code != 0:
            print(f"Warning: {label} exited with code {code}; continuing.", file=sys.stderr)

    print("\nDone Bogotá non-capped +1000 batch.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
