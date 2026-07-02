#!/usr/bin/env python3
"""
Run venta scrapes for cities not yet covered, in manifest order.

For each city: each property type runs until its cap (3000 casas/apto, 1000 others)
or the listing index is exhausted (multi-pass via venta_runner_common).

Order: Santa Marta → Soacha → Cúcuta → Soledad (edit QUEUE to change).

Usage:
  .\\.venv\\Scripts\\python.exe run_remaining_cities_venta.py
  .\\.venv\\Scripts\\python.exe run_remaining_cities_venta.py --only santa-marta
"""

from __future__ import annotations

import argparse
import sys

from venta_runner_common import run_city_venta_types

# (id, slug, city_default, department_default, db_report_ilike)
QUEUE: list[tuple[str, str, str, str, str]] = [
    ("santa-marta", "santa-marta/magdalena", "Santa Marta", "Magdalena", "Santa Marta"),
    ("soacha", "soacha/cundinamarca", "Soacha", "Cundinamarca", "Soacha"),
    ("cucuta", "cucuta/norte-de-santander", "Cucuta", "Norte de Santander", "Cucuta"),
    ("soledad", "soledad/atlantico", "Soledad", "Atlantico", "Soledad"),
]


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Scrape remaining manifest cities (multi-pass per type until caps)."
    )
    ap.add_argument(
        "--only",
        metavar="ID",
        help="Run a single city id from the queue (e.g. santa-marta)",
    )
    ap.add_argument(
        "--default-max",
        type=int,
        default=1000,
        metavar="N",
        help="Cap for non-casas/apartamentos types (default 1000)",
    )
    ap.add_argument(
        "--casas-apto-max",
        type=int,
        default=3000,
        metavar="N",
        help="Cap for casas and apartamentos (default 3000)",
    )
    ap.add_argument(
        "--stale-pages",
        type=int,
        default=3,
        metavar="N",
        help="MAX_NO_ACTION_PAGES per scrape.py pass (default 3)",
    )
    args = ap.parse_args()

    only = (args.only or "").strip().lower()
    ran = 0
    for cid, slug, cdef, ddef, dblike in QUEUE:
        if only and cid.lower() != only:
            continue
        title = cid.replace("-", " ").title()
        print("\n" + "#" * 70, flush=True)
        print(f"# CITY {ran + 1}: {title}", flush=True)
        print("#" * 70 + "\n", flush=True)
        run_city_venta_types(
            city_slug=slug,
            city_default=cdef,
            department_default=ddef,
            city_label=title,
            db_report_ilike=dblike,
            default_max=args.default_max,
            casas_apto_max=args.casas_apto_max,
            stale_pages=args.stale_pages,
        )
        ran += 1

    if ran == 0:
        print(
            "No cities ran. Check --only id matches QUEUE ids.",
            file=sys.stderr,
        )
        return 1
    print(f"\nFinished queue: {ran} city/cities.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
