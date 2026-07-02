#!/usr/bin/env python3
"""
Continue Bogotá venta scrapes by +1000 actionable rows per type that previously
hit the cap. Uses START_PAGE from the last full run (update if you re-ran caps).

Usage:
  .\\.venv\\Scripts\\python.exe run_bogota_continue_1000.py
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# (label, venta path segment, start_page) — skip types that did not hit cap last time.
# After first bogota batch (2000 casas/apto, 1000 others), next pages are roughly:
# casas 107, apartamentos 110, apartaestudios 56, locales 56 (not 49 — 49 overlaps prior tail).
# oficinas/bodegas: ~49 if first pass ended ~48; verify logs if you re-run caps.
CONTINUE: list[tuple[str, str, int]] = [
    ("Casas", "venta/casas", 107),
    ("Apartaestudios", "venta/apartaestudios", 56),
    ("Oficinas", "venta/oficinas", 49),
    ("Bodegas", "venta/bodegas", 49),
    ("Locales", "venta/locales", 56),
    ("Apartamentos", "venta/apartamentos", 110),
]


def main() -> int:
    py = sys.executable
    scrape_py = ROOT / "scrape.py"
    extra = int(os.environ.get("EXTRA_CAP", "1000"))

    for label, path, start_page in CONTINUE:
        listing_url = f"https://www.fincaraiz.com.co/{path.strip('/')}/bogota/bogota-dc"
        print(f"\n{'=' * 60}\n+{extra} {label} — p{start_page}+ — {listing_url}\n{'=' * 60}\n", flush=True)
        env = os.environ.copy()
        env["LISTING_URL"] = listing_url
        env["CITY_DEFAULT"] = "Bogota"
        env["DEPARTMENT_DEFAULT"] = "Bogota D.C."
        env["MAX_LISTINGS_PER_RUN"] = str(max(0, extra))
        env["START_PAGE"] = str(max(1, start_page))
        env["MAX_NO_ACTION_PAGES"] = str(
            max(1, int(os.environ.get("MAX_NO_ACTION_PAGES", "3")))
        )

        code = subprocess.run([py, str(scrape_py)], cwd=str(ROOT), env=env).returncode
        if code != 0:
            print(f"Warning: {label} exited with code {code}; continuing.", file=sys.stderr)

    print("\nDone Bogotá +1000 continuation batch.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
