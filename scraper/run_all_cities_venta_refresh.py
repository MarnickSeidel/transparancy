#!/usr/bin/env python3
"""
Full venta refresh for every city already in the database.

Uses venta_runner_common (multi-pass per property type until cap or exhaustion).

Usage:
  .\\.venv\\Scripts\\python.exe run_all_cities_venta_refresh.py
  .\\.venv\\Scripts\\python.exe run_all_cities_venta_refresh.py --only medellin
  .\\.venv\\Scripts\\python.exe run_all_cities_venta_refresh.py --skip pereira
"""

from __future__ import annotations

import argparse
import sys

from venta_runner_common import run_city_venta_types

# (id, slug, city_default, department_default, db_report_ilike)
CITIES: list[tuple[str, str, str, str, str]] = [
    ("bogota", "bogota/bogota-dc", "Bogota", "Bogota D.C.", "Bogota"),
    ("medellin", "medellin/antioquia", "Medellin", "Antioquia", "Medellin"),
    ("cali", "cali/valle-del-cauca", "Cali", "Valle del Cauca", "Cali"),
    ("barranquilla", "barranquilla/atlantico", "Barranquilla", "Atlantico", "Barranquilla"),
    ("cartagena", "cartagena/bolivar", "Cartagena", "Bolivar", "Cartagena"),
    ("manizales", "manizales/caldas", "Manizales", "Caldas", "Manizales"),
    ("bucaramanga", "bucaramanga/santander", "Bucaramanga", "Santander", "Bucaramanga"),
    ("santa-marta", "santa-marta/magdalena", "Santa Marta", "Magdalena", "Santa Marta"),
    ("bello", "bello/antioquia", "Bello", "Antioquia", "Bello"),
    ("ibague", "ibague/tolima", "Ibague", "Tolima", "Ibague"),
    ("cucuta", "cucuta/norte-de-santander", "Cucuta", "Norte de Santander", "Cucuta"),
    ("villavicencio", "villavicencio/meta", "Villavicencio", "Meta", "Villavicencio"),
    ("soacha", "soacha/cundinamarca", "Soacha", "Cundinamarca", "Soacha"),
    ("soledad", "soledad/atlantico", "Soledad", "Atlantico", "Soledad"),
    ("pereira", "pereira/risaralda", "Pereira", "Risaralda", "Pereira"),
]


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Full venta refresh for all cities in the database."
    )
    ap.add_argument("--only", metavar="ID", help="Run one city id (e.g. medellin)")
    ap.add_argument(
        "--skip",
        metavar="ID",
        action="append",
        default=[],
        help="Skip city id(s); repeatable (e.g. --skip pereira)",
    )
    ap.add_argument("--default-max", type=int, default=1000, metavar="N")
    ap.add_argument("--casas-apto-max", type=int, default=3000, metavar="N")
    ap.add_argument("--stale-pages", type=int, default=3, metavar="N")
    args = ap.parse_args()

    only = (args.only or "").strip().lower()
    skip = {s.strip().lower() for s in args.skip if s.strip()}

    ran = 0
    for cid, slug, cdef, ddef, dblike in CITIES:
        key = cid.lower()
        if only and key != only:
            continue
        if key in skip:
            print(f"\nSkipping {cid} (--skip).", flush=True)
            continue

        label = cid.replace("-", " ").title()
        print("\n" + "#" * 70, flush=True)
        print(f"# CITY {ran + 1}: {label}", flush=True)
        print("#" * 70 + "\n", flush=True)
        run_city_venta_types(
            city_slug=slug,
            city_default=cdef,
            department_default=ddef,
            city_label=label,
            db_report_ilike=dblike,
            default_max=args.default_max,
            casas_apto_max=args.casas_apto_max,
            stale_pages=args.stale_pages,
        )
        ran += 1

    if ran == 0:
        print("No cities ran. Check --only / --skip ids.", file=sys.stderr)
        return 1

    print(f"\nFinished full refresh: {ran} city/cities.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
