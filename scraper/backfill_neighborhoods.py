#!/usr/bin/env python3
"""One-time backfill: recompute canonical neighborhood for active listings."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from db import connect
from neighborhood_catalog import load_all_catalogs
from neighborhood_resolver import (
    fetch_peer_counts,
    merge_quality_flags,
    normalize_neighborhood_key,
    resolve_neighborhood,
)
from parse_fields import normalize_neighborhood


def _rural_from_row(row: dict[str, Any]) -> bool:
    qf = row.get("quality_flags") or {}
    if isinstance(qf, str):
        try:
            qf = json.loads(qf)
        except json.JSONDecodeError:
            qf = {}
    dk = qf.get("dossier_key") if isinstance(qf, dict) else None
    if isinstance(dk, str) and dk.endswith("-rural"):
        return True
    raw = (row.get("neighborhood_raw") or "").casefold()
    return "rural" in raw or "vereda" in raw


def load_active_listings(conn, city: str) -> list[dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
          id::text,
          external_id,
          neighborhood,
          neighborhood_raw,
          neighborhood_source_id,
          zone_name,
          city,
          city_slug,
          quality_flags
        FROM listings
        WHERE is_active = true
          AND city ILIKE %s
        ORDER BY external_id
        """,
        (city.strip(),),
    )
    cols = [d[0] for d in cur.description]
    rows: list[dict[str, Any]] = []
    for rec in cur.fetchall():
        row = dict(zip(cols, rec))
        qf = row.get("quality_flags")
        if isinstance(qf, str):
            try:
                row["quality_flags"] = json.loads(qf)
            except json.JSONDecodeError:
                row["quality_flags"] = {}
        rows.append(row)
    return rows


def build_peer_counts_from_rows(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        label = row.get("neighborhood_raw") or row.get("neighborhood")
        if not label:
            continue
        cleaned = normalize_neighborhood(str(label))
        if not cleaned:
            continue
        rural = _rural_from_row(row)
        key = normalize_neighborhood_key(cleaned)
        if rural:
            key = f"{key}-rural"
        counts[key] = counts.get(key, 0) + 1
        sid = row.get("neighborhood_source_id")
        if sid:
            counts[f"uuid:{sid}"] = counts.get(f"uuid:{sid}", 0) + 1
    return counts


def backfill_city(conn, city: str, *, dry_run: bool) -> dict[str, int]:
    load_all_catalogs()
    rows = load_active_listings(conn, city)
    peer_counts = build_peer_counts_from_rows(rows)

    stats = {
        "total": len(rows),
        "updated": 0,
        "unchanged": 0,
        "catalog": 0,
        "source_id": 0,
        "provisional": 0,
        "weak": 0,
        "missing": 0,
    }

    cur = conn.cursor()
    for row in rows:
        raw = row.get("neighborhood_raw")
        candidates = [raw, row.get("neighborhood"), row.get("zone_name")]
        resolution = resolve_neighborhood(
            candidates=candidates,
            city=row.get("city"),
            city_slug=row.get("city_slug"),
            neighborhood_source_id=row.get("neighborhood_source_id"),
            source_location_name=raw,
            location_type=None,
            location_slug=None,
            zone_name=row.get("zone_name"),
            peer_counts=peer_counts,
        )
        stats[resolution.confidence] = stats.get(resolution.confidence, 0) + 1

        existing_qf = row.get("quality_flags") if isinstance(row.get("quality_flags"), dict) else {}
        new_qf = merge_quality_flags(existing_qf, resolution)
        old_nb = (row.get("neighborhood") or "").strip() or None
        new_nb = resolution.neighborhood

        old_conf = (existing_qf or {}).get("neighborhood_confidence")
        from neighborhood_resolver import confidence_rank

        changed = (
            old_nb != new_nb
            or old_conf != resolution.confidence
            or new_qf.get("dossier_key") != (existing_qf or {}).get("dossier_key")
        )
        if not changed:
            stats["unchanged"] += 1
            continue

        if dry_run:
            stats["updated"] += 1
            continue

        cur.execute(
            """
            UPDATE listings
            SET neighborhood = %s,
                quality_flags = %s::jsonb
            WHERE id = %s::uuid
            """,
            (
                new_nb,
                json.dumps(new_qf),
                row["id"],
            ),
        )
        stats["updated"] += 1

    if not dry_run:
        conn.commit()
    return stats


def main() -> int:
    ap = argparse.ArgumentParser(description="Backfill canonical neighborhoods.")
    ap.add_argument("--city", default="Pereira", help="City to backfill (default: Pereira)")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Report changes without writing to the database",
    )
    args = ap.parse_args()

    conn = connect()
    stats = backfill_city(conn, args.city, dry_run=args.dry_run)
    mode = "DRY RUN" if args.dry_run else "APPLIED"
    print(f"[{mode}] {args.city}: {stats}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
