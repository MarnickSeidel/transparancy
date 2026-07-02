#!/usr/bin/env python3
"""
Run scrape.py once per enabled target in scrape_manifest.json.

Uses a subprocess per target so LISTING_URL / CITY_DEFAULT / DEPARTMENT_DEFAULT
are applied cleanly (config is read at import time).

Usage:
  python run_scrape_manifest.py
  python run_scrape_manifest.py --only apartamentos_medellin
  python run_scrape_manifest.py --manifest path/to/custom.json

Manifest: optional base_url + property_types[] x cities[] builds listing URLs
  {base}/{path}/{city.slug} (e.g. .../venta/apartamentos/medellin/antioquia).
  Target id = {property.id}_{city.id}. Rows in targets[] are appended after the matrix.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_MANIFEST = ROOT / "scrape_manifest.json"


def _expand_matrix_targets(data: dict) -> list[dict]:
    """
    Build targets from base_url + property_types[] x cities[].

    Each listing URL is: {base}/{property.path}/{city.slug}
    e.g. https://www.fincaraiz.com.co/venta/apartamentos/medellin/antioquia

    Target id: {property.id}_{city.id} (e.g. apartamentos_medellin).
    """
    base = (data.get("base_url") or "https://www.fincaraiz.com.co").rstrip("/")
    defaults = data.get("defaults") or {}
    def_max = int(defaults.get("max_listings_per_run", 100))
    def_start = max(1, int(defaults.get("start_page", 1)))
    props = data.get("property_types") or []
    cities = data.get("cities") or []
    if not props or not cities:
        return []

    out: list[dict] = []
    for pt in props:
        if not pt.get("enabled", False):
            continue
        pid = str(pt.get("id") or "").strip()
        path = str(pt.get("path") or "").strip().strip("/")
        if not pid or not path:
            continue
        plabel = str(pt.get("label") or pid)
        pt_max = int(pt.get("max_listings_per_run", def_max))
        pt_start = max(1, int(pt.get("start_page", def_start)))

        for c in cities:
            cid = str(c.get("id") or "").strip()
            slug = str(c.get("slug") or "").strip().strip("/")
            if not cid or not slug:
                continue
            listing_url = f"{base}/{path}/{slug}"
            tid = f"{pid}_{cid}"
            clabel = str(c.get("label") or "").strip() or cid.replace("_", " ").title()
            label = f"{clabel} – {plabel}"
            out.append(
                {
                    "id": tid,
                    "label": label,
                    "listing_url": listing_url,
                    "city_default": str(c.get("city_default") or "").strip(),
                    "department_default": str(c.get("department_default") or "").strip(),
                    "max_listings_per_run": int(c.get("max_listings_per_run", pt_max)),
                    "start_page": max(1, int(c.get("start_page", pt_start))),
                    "enabled": bool(c.get("enabled", False)),
                }
            )
    return out


def _load_targets(data: dict) -> list[dict]:
    matrix = _expand_matrix_targets(data)
    manual = list(data.get("targets") or [])
    return matrix + manual


def main() -> int:
    ap = argparse.ArgumentParser(description="Run scrape targets from manifest JSON.")
    ap.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help="Path to manifest JSON (default: scraper/scrape_manifest.json)",
    )
    ap.add_argument(
        "--only",
        action="append",
        dest="only_ids",
        metavar="ID",
        help="Run only target(s) with this id (repeatable)",
    )
    args = ap.parse_args()
    manifest_path = args.manifest.resolve()
    if not manifest_path.is_file():
        print(f"Manifest not found: {manifest_path}", file=sys.stderr)
        return 1

    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    targets = _load_targets(data)
    only = set(args.only_ids) if args.only_ids else None

    ran = 0
    for t in targets:
        tid = str(t.get("id") or "")
        if only is not None and tid not in only:
            continue
        forced = only is not None and tid in only
        if not forced and not t.get("enabled", False):
            continue

        label = t.get("label") or tid or "?"
        listing_url = str(t.get("listing_url") or "").strip()
        if not listing_url:
            print(f"Skip {tid}: missing listing_url", file=sys.stderr)
            continue

        print(f"\n{'=' * 60}\n{label}\n{listing_url}\n{'=' * 60}\n")

        env = os.environ.copy()
        env["LISTING_URL"] = listing_url
        if t.get("city_default"):
            env["CITY_DEFAULT"] = str(t["city_default"]).strip()
        if t.get("department_default"):
            env["DEPARTMENT_DEFAULT"] = str(t["department_default"]).strip()
        env["MAX_LISTINGS_PER_RUN"] = str(int(t.get("max_listings_per_run", 100)))
        env["START_PAGE"] = str(max(1, int(t.get("start_page", 1))))

        code = subprocess.run(
            [sys.executable, str(ROOT / "scrape.py")],
            cwd=str(ROOT),
            env=env,
        ).returncode
        ran += 1
        if code != 0:
            print(f"Target {tid} exited with code {code}", file=sys.stderr)
            return code

    if ran == 0:
        print(
            "No enabled targets ran. Enable targets in the manifest or use --only ID "
            "with an enabled target.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
