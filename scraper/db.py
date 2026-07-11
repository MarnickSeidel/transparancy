"""Postgres upsert and deal recomputation (aligned with Prisma schema in /web)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import psycopg2
from psycopg2.extras import Json, execute_batch, execute_values

from config import DATABASE_URL
from deal_engine import (
    DealListingInput,
    PriceEventInput,
    analyze_deal,
    listing_from_row,
    min_built_ppm2_for_house,
)


def _nb_confidence_rank_sql(expr: str) -> str:
    """SQL CASE mapping quality_flags.neighborhood_confidence to rank."""
    return f"""CASE COALESCE({expr}->>'neighborhood_confidence', 'missing')
      WHEN 'catalog' THEN 5
      WHEN 'source_id' THEN 4
      WHEN 'provisional' THEN 3
      WHEN 'weak' THEN 2
      ELSE 1
    END"""


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
        SELECT external_id, id, price_cop, source_fingerprint
        FROM listings
        WHERE external_id = ANY(%s)
        """,
        (external_ids,),
    )
    existing: dict[str, tuple[str, int, str | None]] = {}
    for eid, lid, price_cop, fp in cur.fetchall():
        existing[str(eid)] = (str(lid), int(price_cop), fp)

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
        area_private = r.get("area_private_m2")
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
        ppm2_private = (
            float(price) / float(area_private)
            if area_private and float(area_private) > 0
            else None
        )
        fp = r.get("source_fingerprint")
        prev = existing.get(str(r["external_id"]))
        prev_fp = prev[2] if prev else None
        if prev is None:
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
                True,
                r.get("property_type"),
                r.get("operation_type"),
                float(area_built) if area_built else None,
                float(area_terrain) if area_terrain else None,
                float(r.get("area_terrace_m2")) if r.get("area_terrace_m2") else None,
                float(area_private) if area_private else None,
                ppm2_private,
                r.get("description"),
                r.get("garage"),
                r.get("floor"),
                r.get("antiquity"),
                bool(r.get("accepts_barter")),
                r.get("construction_state"),
                int(r["owner_id"]) if r.get("owner_id") is not None else None,
                r.get("owner_name"),
                r.get("owner_type"),
                r.get("owner_particular"),
                r.get("neighborhood_source_id"),
                r.get("zone_name"),
                r.get("commune_name"),
                Json(r.get("facilities")) if r.get("facilities") is not None else None,
                r.get("image_count"),
                int(r["price_admin_included"])
                if r.get("price_admin_included") is not None
                else None,
                r.get("highlight"),
                float(r["relevance"]) if r.get("relevance") is not None else None,
                r.get("paid_quota"),
                bool(r.get("is_project")),
                bool(r.get("area_mismatch_flag")),
                bool(r.get("terrace_heavy_flag")),
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
        f"""
        INSERT INTO listings (
          id, external_id, title, price_cop, area_m2, estrato,
          neighborhood, neighborhood_raw, conjunto, city, city_id, city_slug, department, department_slug,
          price_per_m2, price_per_m2_built,
          price_per_m2_terrain, deal_score, url, image_url, date_scraped, is_deal, is_active,
          property_type, operation_type, area_built_m2, area_terrain_m2, area_terrace_m2,
          area_private_m2, price_per_m2_private, description, garage, floor, antiquity,
          accepts_barter, construction_state, owner_id, owner_name, owner_type, owner_particular,
          neighborhood_source_id, zone_name, commune_name, facilities, image_count,
          price_admin_included, highlight, relevance, paid_quota, is_project,
          area_mismatch_flag, terrace_heavy_flag,
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
            WHEN listings.neighborhood IS NULL
              OR btrim(listings.neighborhood) = ''
              OR lower(btrim(listings.neighborhood)) = 'unknown'
            THEN EXCLUDED.neighborhood
            WHEN {_nb_confidence_rank_sql("EXCLUDED.quality_flags")} >
                 {_nb_confidence_rank_sql("listings.quality_flags")}
            THEN EXCLUDED.neighborhood
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint
              AND {_nb_confidence_rank_sql("EXCLUDED.quality_flags")} >=
                  {_nb_confidence_rank_sql("listings.quality_flags")}
            THEN EXCLUDED.neighborhood
            ELSE listings.neighborhood
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
          is_active = true,
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
          area_private_m2 = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.area_private_m2
            ELSE COALESCE(listings.area_private_m2, EXCLUDED.area_private_m2)
          END,
          price_per_m2_private = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.price_per_m2_private
            ELSE listings.price_per_m2_private
          END,
          description = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.description
            ELSE COALESCE(listings.description, EXCLUDED.description)
          END,
          garage = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.garage
            ELSE COALESCE(listings.garage, EXCLUDED.garage)
          END,
          floor = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.floor
            ELSE COALESCE(listings.floor, EXCLUDED.floor)
          END,
          antiquity = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.antiquity
            ELSE COALESCE(listings.antiquity, EXCLUDED.antiquity)
          END,
          accepts_barter = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.accepts_barter
            ELSE listings.accepts_barter
          END,
          construction_state = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.construction_state
            ELSE COALESCE(listings.construction_state, EXCLUDED.construction_state)
          END,
          owner_id = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.owner_id
            ELSE COALESCE(listings.owner_id, EXCLUDED.owner_id)
          END,
          owner_name = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.owner_name
            ELSE COALESCE(listings.owner_name, EXCLUDED.owner_name)
          END,
          owner_type = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.owner_type
            ELSE COALESCE(listings.owner_type, EXCLUDED.owner_type)
          END,
          owner_particular = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.owner_particular
            ELSE COALESCE(listings.owner_particular, EXCLUDED.owner_particular)
          END,
          neighborhood_source_id = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.neighborhood_source_id
            ELSE COALESCE(listings.neighborhood_source_id, EXCLUDED.neighborhood_source_id)
          END,
          zone_name = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.zone_name
            ELSE COALESCE(listings.zone_name, EXCLUDED.zone_name)
          END,
          commune_name = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.commune_name
            ELSE COALESCE(listings.commune_name, EXCLUDED.commune_name)
          END,
          facilities = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.facilities
            ELSE COALESCE(listings.facilities, EXCLUDED.facilities)
          END,
          image_count = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.image_count
            ELSE COALESCE(listings.image_count, EXCLUDED.image_count)
          END,
          price_admin_included = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.price_admin_included
            ELSE listings.price_admin_included
          END,
          highlight = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.highlight
            ELSE listings.highlight
          END,
          relevance = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.relevance
            ELSE listings.relevance
          END,
          paid_quota = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.paid_quota
            ELSE listings.paid_quota
          END,
          is_project = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.is_project
            ELSE listings.is_project
          END,
          area_mismatch_flag = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.area_mismatch_flag
            ELSE listings.area_mismatch_flag
          END,
          terrace_heavy_flag = CASE
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN EXCLUDED.terrace_heavy_flag
            ELSE listings.terrace_heavy_flag
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
            WHEN {_nb_confidence_rank_sql("EXCLUDED.quality_flags")} >
                 {_nb_confidence_rank_sql("listings.quality_flags")}
            THEN EXCLUDED.quality_flags
            WHEN listings.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint
            THEN EXCLUDED.quality_flags
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

    price_events: list[tuple[str, str, str, int, datetime]] = []
    for r in rows:
        eid = str(r["external_id"])
        new_price = int(r["price_cop"])
        prev = existing.get(eid)
        if prev is None:
            continue
        listing_id, old_price, _ = prev
        if old_price != new_price:
            price_events.append(
                (str(uuid.uuid4()), listing_id, eid, new_price, now)
            )

    if price_events:
        execute_values(
            cur,
            """
            INSERT INTO listing_price_events (id, listing_id, external_id, price_cop, recorded_at)
            VALUES %s
            """,
            price_events,
        )

    conn.commit()
    return {
        "written": len(prepared),
        "new": new_count,
        "changed": changed_count,
        "unchanged": unchanged_count,
        "price_events": len(price_events),
    }


def mark_inactive_listings(
    conn,
    *,
    run_started_at: datetime,
    city: Optional[str] = None,
) -> int:
    """
    After a city refresh, mark listings in that city inactive when they were not
    seen during this run (last_seen_at before run_started_at).
    """
    cur = conn.cursor()
    if city and str(city).strip():
        cur.execute(
            """
            UPDATE listings
            SET is_active = false
            WHERE city ILIKE %s
              AND last_seen_at < %s
              AND is_active IS DISTINCT FROM false
            """,
            (str(city).strip(), run_started_at),
        )
    else:
        cur.execute(
            """
            UPDATE listings
            SET is_active = false
            WHERE last_seen_at < %s
              AND is_active IS DISTINCT FROM false
            """,
            (run_started_at,),
        )
    updated = cur.rowcount
    conn.commit()
    return updated


def refresh_deals_after_scrape(
    conn,
    threshold_pct: Optional[float] = None,
    *,
    city: Optional[str] = None,
) -> None:
    """Recompute is_deal and deal_score using dealEngine-aligned comp pools."""
    del threshold_pct  # legacy param; positive discount is required instead
    cur = conn.cursor()
    city_clause = ""
    city_params: list[Any] = []
    if city and str(city).strip():
        city_clause = " AND city ILIKE %s"
        city_params = [str(city).strip()]

    listing_cols = [
        "id",
        "city",
        "neighborhood",
        "zone_name",
        "property_type",
        "construction_state",
        "estrato",
        "operation_type",
        "area_m2",
        "area_built_m2",
        "area_private_m2",
        "area_terrain_m2",
        "area_terrace_m2",
        "price_cop",
        "price_per_m2",
        "price_per_m2_built",
        "price_per_m2_private",
        "price_per_m2_terrain",
        "admin_fee_cop",
        "bedrooms",
        "bathrooms",
        "latitude",
        "longitude",
        "source_updated_at",
        "first_seen_at",
        "data_completeness_score",
        "accepts_barter",
        "terrace_heavy_flag",
        "area_mismatch_flag",
        "is_project",
        "paid_quota",
        "highlight",
    ]
    col_sql = ", ".join(listing_cols)

    cur.execute(
        f"""
        SELECT {col_sql}
        FROM listings
        WHERE is_active = true
          AND price_per_m2 IS NOT NULL
          AND area_m2 >= 5
          AND operation_type ILIKE '%venta%'{city_clause}
        """,
        city_params,
    )
    rows = cur.fetchall()
    if not rows:
        return

    pool: list[DealListingInput] = [
        listing_from_row(row, listing_cols) for row in rows
    ]
    house_floor = min_built_ppm2_for_house(pool)
    listing_ids = [p.id for p in pool]

    cur.execute(
        """
        SELECT listing_id, price_cop, recorded_at
        FROM listing_price_events
        WHERE listing_id = ANY(%s::uuid[])
          AND recorded_at >= NOW() - INTERVAL '90 days'
        ORDER BY recorded_at DESC
        """,
        (listing_ids,),
    )
    events_by_listing: dict[str, list[PriceEventInput]] = {}
    for listing_id, price_cop, recorded_at in cur.fetchall():
        lid = str(listing_id)
        events_by_listing.setdefault(lid, []).append(
            PriceEventInput(price_cop=int(price_cop), recorded_at=recorded_at)
        )

    updates: list[tuple[bool, Optional[float], str]] = []
    for subject in pool:
        analysis = analyze_deal(
            subject,
            pool,
            price_events=events_by_listing.get(subject.id),
            min_built_ppm2_for_house=house_floor,
            require_positive_discount=True,
        )
        is_deal = (
            not analysis.excluded
            and analysis.discount_vs_ref_pct is not None
            and analysis.discount_vs_ref_pct > 0
        )
        updates.append((is_deal, analysis.deal_score, subject.id))

    execute_batch(
        cur,
        "UPDATE listings SET is_deal = %s, deal_score = %s WHERE id = %s::uuid",
        updates,
        page_size=200,
    )
    conn.commit()
