"""Postgres upsert and deal recomputation (aligned with Prisma schema in /web)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import psycopg2
from psycopg2.extras import Json, execute_batch, execute_values

from config import DATABASE_URL, DEAL_THRESHOLD_PCT


def connect():
    return psycopg2.connect(DATABASE_URL)


def get_existing_listing_meta(
    conn, external_ids: list[str]
) -> dict[str, tuple[str | None, str | None, str | None]]:
    if not external_ids:
        return {}
    cur = conn.cursor()
    cur.execute(
        """
        SELECT external_id, source_fingerprint, neighborhood, conjunto
        FROM listings
        WHERE external_id = ANY(%s)
        """,
        (external_ids,),
    )
    return {str(eid): (fp, nb, cj) for eid, fp, nb, cj in cur.fetchall()}


def upsert_listings(conn, rows: list[dict[str, Any]]) -> dict[str, int]:
    """Insert or update by external_id with change tracking."""
    if not rows:
        return {"written": 0, "new": 0, "changed": 0, "unchanged": 0}

    now = datetime.now(timezone.utc)
    cur = conn.cursor()
    external_ids = [str(r["external_id"]) for r in rows]
    cur.execute(
        """
        SELECT external_id, source_fingerprint
        FROM listings
        WHERE external_id = ANY(%s)
        """,
        (external_ids,),
    )
    existing = {eid: fp for eid, fp in cur.fetchall()}

    new_count = 0
    changed_count = 0
    unchanged_count = 0
    prepared = []
    for r in rows:
        area = r.get("area_m2") or 0.0
        price = int(r["price_cop"])
        ppm2 = float(price) / float(area) if area and area > 0 else None
        area_built = r.get("area_built_m2")
        area_terrain = r.get("area_terrain_m2")
        ppm2_built = (
            float(price) / float(area_built)
            if area_built and float(area_built) > 0
            else None
        )
        ppm2_terrain = (
            float(price) / float(area_terrain)
            if area_terrain and float(area_terrain) > 0
            else None
        )
        fp = r.get("source_fingerprint")
        prev_fp = existing.get(r["external_id"])
        if prev_fp is None:
            new_count += 1
        elif prev_fp == fp:
            unchanged_count += 1
        else:
            changed_count += 1

        nraw = r.get("neighborhood_raw")
        if isinstance(nraw, str) and nraw.strip():
            nraw = nraw.strip()[:200]
        else:
            nraw = None

        prepared.append(
            (
                str(uuid.uuid4()),
                r["external_id"],
                r["title"][:2000],
                price,
                float(area) if area else 0.0,
                r.get("estrato"),
                r.get("neighborhood"),
                nraw,
                r.get("conjunto"),
                r.get("city", "Pereira"),
                r.get("city_id"),
                r.get("city_slug"),
                r.get("department", "Risaralda"),
                r.get("department_slug"),
                ppm2,
                ppm2_built,
                ppm2_terrain,
                None,
                r["url"][:2000],
                r.get("image_url"),
                now,
                False,
                r.get("property_type"),
                r.get("operation_type"),
                float(area_built) if area_built else None,
                float(area_terrain) if area_terrain else None,
                float(r.get("area_terrace_m2")) if r.get("area_terrace_m2") else None,
                r.get("bedrooms"),
                r.get("bathrooms"),
                r.get("rooms"),
                int(r["admin_fee_cop"]) if r.get("admin_fee_cop") is not None else None,
                r.get("currency_symbol"),
                float(r["latitude"]) if r.get("latitude") is not None else None,
                float(r["longitude"]) if r.get("longitude") is not None else None,
                Json(r.get("location_path")) if r.get("location_path") is not None else None,
                r.get("source_created_at"),
                r.get("source_updated_at"),
                Json(r.get("quality_flags", {})),
                float(r.get("data_completeness_score"))
                if r.get("data_completeness_score") is not None
                else None,
                fp,
                now,
                now,
                now,
                1,
            )
        )

    execute_values(
        cur,
        """
        INSERT INTO listings (
          id, external_id, title, price_cop, area_m2, estrato,
          neighborhood, neighborhood_raw, conjunto, city, city_id, city_slug, department, department_slug,
          price_per_m2, price_per_m2_built,
          price_per_m2_terrain, deal_score, url, image_url, date_scraped, is_deal,
          property_type, operation_type, area_built_m2, area_terrain_m2, area_terrace_m2,
          bedrooms, bathrooms, rooms,
          admin_fee_cop, currency_symbol, latitude, longitude, location_path,
          source_created_at, source_updated_at, quality_flags, data_completeness_score,
          source_fingerprint, first_seen_at, last_seen_at, last_changed_at, times_seen
        ) VALUES %s
        ON CONFLICT (external_id) DO UPDATE SET
          title = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.title
            ELSE listings.title
          END,
          price_cop = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.price_cop
            ELSE listings.price_cop
          END,
          area_m2 = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.area_m2
            ELSE listings.area_m2
          END,
          estrato = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.estrato
            ELSE listings.estrato
          END,
          neighborhood = CASE
            WHEN listings.neighborhood IS NOT NULL
              AND btrim(listings.neighborhood) <> ''
              AND lower(btrim(listings.neighborhood)) <> 'unknown'
            THEN listings.neighborhood
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.neighborhood
            ELSE COALESCE(listings.neighborhood, EXCLUDED.neighborhood)
          END,
          neighborhood_raw = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.neighborhood_raw
            ELSE COALESCE(listings.neighborhood_raw, EXCLUDED.neighborhood_raw)
          END,
          conjunto = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.conjunto
            ELSE COALESCE(listings.conjunto, EXCLUDED.conjunto)
          END,
          city = EXCLUDED.city,
          city_id = EXCLUDED.city_id,
          city_slug = EXCLUDED.city_slug,
          department = EXCLUDED.department,
          department_slug = EXCLUDED.department_slug,
          price_per_m2 = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.price_per_m2
            ELSE listings.price_per_m2
          END,
          price_per_m2_built = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.price_per_m2_built
            ELSE listings.price_per_m2_built
          END,
          price_per_m2_terrain = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.price_per_m2_terrain
            ELSE listings.price_per_m2_terrain
          END,
          url = EXCLUDED.url,
          image_url = EXCLUDED.image_url,
          date_scraped = EXCLUDED.date_scraped,
          property_type = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.property_type
            ELSE listings.property_type
          END,
          operation_type = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.operation_type
            ELSE listings.operation_type
          END,
          area_built_m2 = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.area_built_m2
            ELSE listings.area_built_m2
          END,
          area_terrain_m2 = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.area_terrain_m2
            ELSE listings.area_terrain_m2
          END,
          area_terrace_m2 = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.area_terrace_m2
            ELSE listings.area_terrace_m2
          END,
          bedrooms = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.bedrooms
            ELSE COALESCE(listings.bedrooms, EXCLUDED.bedrooms)
          END,
          bathrooms = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.bathrooms
            ELSE COALESCE(listings.bathrooms, EXCLUDED.bathrooms)
          END,
          rooms = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.rooms
            ELSE COALESCE(listings.rooms, EXCLUDED.rooms)
          END,
          admin_fee_cop = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.admin_fee_cop
            ELSE listings.admin_fee_cop
          END,
          currency_symbol = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.currency_symbol
            ELSE listings.currency_symbol
          END,
          latitude = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.latitude
            ELSE listings.latitude
          END,
          longitude = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.longitude
            ELSE listings.longitude
          END,
          location_path = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.location_path
            ELSE listings.location_path
          END,
          source_created_at = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.source_created_at
            ELSE listings.source_created_at
          END,
          source_updated_at = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.source_updated_at
            ELSE listings.source_updated_at
          END,
          quality_flags = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.quality_flags
            ELSE listings.quality_flags
          END,
          data_completeness_score = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.data_completeness_score
            ELSE listings.data_completeness_score
          END,
          source_fingerprint = EXCLUDED.source_fingerprint,
          last_seen_at = EXCLUDED.last_seen_at,
          last_changed_at = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.last_seen_at
            ELSE listings.last_changed_at
          END,
          times_seen = listings.times_seen + 1
        """,
        prepared,
    )
    conn.commit()
    return {
        "written": len(prepared),
        "new": new_count,
        "changed": changed_count,
        "unchanged": unchanged_count,
    }


def refresh_deals_after_scrape(
    conn,
    threshold_pct: Optional[float] = None,
    *,
    city: Optional[str] = None,
) -> None:
    """Mark is_deal when price_per_m2 is at least threshold_pct below ref average."""
    t = threshold_pct if threshold_pct is not None else DEAL_THRESHOLD_PCT
    factor = 1.0 - (t / 100.0)
    cur = conn.cursor()
    city_clause = ""
    city_params: list[Any] = []
    if city and str(city).strip():
        city_clause = " AND city ILIKE %s"
        city_params = [str(city).strip()]

    cur.execute(
        f"""
        SELECT city, neighborhood, AVG(price_per_m2)::float
        FROM listings
        WHERE price_per_m2 IS NOT NULL{city_clause}
        GROUP BY city, neighborhood
        """,
        city_params,
    )
    neigh_avg: dict[tuple[str, Optional[str]], float] = {}
    for cty, nb, avg in cur.fetchall():
        key = (str(cty or ""), nb)
        neigh_avg[key] = float(avg) if avg is not None else 0.0

    cur.execute(
        f"""
        SELECT city, AVG(price_per_m2)::float
        FROM listings
        WHERE price_per_m2 IS NOT NULL{city_clause}
        GROUP BY city
        """,
        city_params,
    )
    city_avg: dict[str, float] = {}
    for cty, avg in cur.fetchall():
        city_avg[str(cty or "")] = float(avg) if avg is not None else 0.0

    cur.execute(
        f"""
        SELECT id, city, neighborhood, price_per_m2, source_updated_at, date_scraped, data_completeness_score
        FROM listings
        WHERE price_per_m2 IS NOT NULL{city_clause}
        """,
        city_params,
    )
    updates: list[tuple[bool, Optional[float], str]] = []
    now = datetime.now(timezone.utc)
    for lid, cty, nb, ppm2, source_updated_at, date_scraped, completeness in cur.fetchall():
        city_key = str(cty or "")
        ref = neigh_avg.get((city_key, nb)) if nb else None
        if not ref or ref <= 0:
            ref = city_avg.get(city_key)
        is_deal = bool(ref and ref > 0 and float(ppm2) <= ref * factor)
        if ref and ref > 0:
            rel_discount = (float(ref) - float(ppm2)) / float(ref)
        else:
            rel_discount = 0.0
        rel_discount = max(-1.0, min(1.0, rel_discount))
        freshness_base = source_updated_at or date_scraped
        if freshness_base and freshness_base.tzinfo is None:
            freshness_base = freshness_base.replace(tzinfo=timezone.utc)
        age_days = (now - freshness_base).total_seconds() / 86400.0 if freshness_base else 30
        freshness_component = max(0.0, 1.0 - min(age_days / 30.0, 1.0))
        completeness_component = float(completeness) if completeness is not None else 0.0
        score = (rel_discount * 80.0) + (freshness_component * 12.0) + (completeness_component * 8.0)
        updates.append((is_deal, round(score, 4), str(lid)))

    execute_batch(
        cur,
        "UPDATE listings SET is_deal = %s, deal_score = %s WHERE id = %s::uuid",
        updates,
        page_size=200,
    )
    conn.commit()
