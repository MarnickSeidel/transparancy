"""
Canonical barrio resolution (shared rules with web/lib/neighborhoodResolver.ts).

Priority:
1. neighborhood_source_id + FR location name
2. Catalog match on candidates (exact + aliases only)
3. Normalized key with >= PROVISIONAL_MIN_PEERS active peers in same city
4. zone_name is kept for comps only — never copied into neighborhood
5. Else neighborhood = null; neighborhood_raw is preserved separately
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal, Optional

from neighborhood_catalog import (
    catalog_key_for_city,
    resolve_by_source_id,
    resolve_exact_in_catalog,
)
from parse_fields import normalize_neighborhood

Confidence = Literal["catalog", "source_id", "provisional", "weak", "missing"]

CONFIDENCE_RANK: dict[Confidence, int] = {
    "catalog": 5,
    "source_id": 4,
    "provisional": 3,
    "weak": 2,
    "missing": 1,
}

PROVISIONAL_MIN_PEERS = 20

_ADDRESS_TOKEN_RE = re.compile(
    r"\b(calle|carrera|cra|cr|cll|cl|apto|apt|apartamento)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class NeighborhoodResolution:
    neighborhood: str | None
    confidence: Confidence
    dossier_key: str | None
    comp_zone: str | None  # zone_name for comps when barrio is null


def confidence_rank(confidence: Confidence | str | None) -> int:
    if not confidence or confidence not in CONFIDENCE_RANK:
        return CONFIDENCE_RANK["missing"]
    return CONFIDENCE_RANK[confidence]  # type: ignore[index]


def normalize_neighborhood_key(raw: str) -> str:
    """Match web/lib/neighborhoods.ts normalizeNeighborhoodKey."""
    if not raw:
        return ""
    s = unicodedata.normalize("NFD", raw.strip())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = _ADDRESS_TOKEN_RE.sub(" ", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s.strip()


def _city_key(city: str | None, city_slug: str | None) -> str | None:
    return catalog_key_for_city(city, city_slug)


def is_rural_location(
    location_type: str | None,
    slug: str | None,
) -> bool:
    lt = (location_type or "").strip().lower()
    sl = (slug or "").strip().lower()
    if "rural" in lt or lt in {"rural_neighbourhood", "rural_neighborhood"}:
        return True
    if "rural" in sl:
        return True
    return False


def apply_rural_suffix(canonical: str, rural: bool) -> str:
    if not rural:
        return canonical
    low = canonical.casefold()
    if low.endswith(" rural") or low.endswith(" (rural)"):
        return canonical
    return f"{canonical} rural"


def build_dossier_key(
    *,
    city: str | None,
    city_slug: str | None,
    neighborhood: str | None,
    neighborhood_source_id: str | None,
    rural: bool = False,
) -> str | None:
    ck = _city_key(city, city_slug) or (city or "").strip().lower().replace(" ", "-")
    if not ck:
        return None
    if neighborhood_source_id and neighborhood_source_id.strip():
        return f"{ck}:uuid:{neighborhood_source_id.strip()}"
    if neighborhood and neighborhood.strip():
        nk = normalize_neighborhood_key(neighborhood)
        if not nk:
            return None
        if rural:
            nk = f"{nk}-rural"
        return f"{ck}:{nk}"
    return None


def _best_provisional_label(
    candidates: list[str],
    peer_counts: dict[str, int],
    rural: bool,
) -> tuple[str | None, int]:
    best_label: str | None = None
    best_count = 0
    for cand in candidates:
        cleaned = normalize_neighborhood(cand)
        if not cleaned:
            continue
        key = normalize_neighborhood_key(cleaned)
        if rural:
            key = f"{key}-rural"
        count = peer_counts.get(key, 0)
        if count >= PROVISIONAL_MIN_PEERS and count > best_count:
            best_count = count
            best_label = apply_rural_suffix(cleaned, rural)
    return best_label, best_count


def resolve_neighborhood(
    *,
    candidates: list[str | None],
    city: str | None,
    city_slug: str | None = None,
    neighborhood_source_id: str | None = None,
    source_location_name: str | None = None,
    location_type: str | None = None,
    location_slug: str | None = None,
    zone_name: str | None = None,
    peer_counts: dict[str, int] | None = None,
) -> NeighborhoodResolution:
    """
    Resolve canonical neighborhood and confidence for one listing.

    peer_counts: map of normalize_neighborhood_key(label) -> active listing count
    in the same city (include '-rural' suffix in keys when rural).
    """
    comp_zone = normalize_neighborhood(zone_name)

    rural = is_rural_location(location_type, location_slug)
    city_key = _city_key(city, city_slug)
    cleaned = [
        c
        for c in (normalize_neighborhood(x) for x in candidates)
        if c
    ]

    # 1. FR UUID + location name
    if neighborhood_source_id and neighborhood_source_id.strip():
        sid = neighborhood_source_id.strip()
        if city_key:
            catalog_from_id = resolve_by_source_id(sid, city_key)
            if catalog_from_id:
                canonical = apply_rural_suffix(catalog_from_id, rural)
                return NeighborhoodResolution(
                    neighborhood=canonical,
                    confidence="catalog",
                    dossier_key=build_dossier_key(
                        city=city,
                        city_slug=city_slug,
                        neighborhood=canonical,
                        neighborhood_source_id=sid,
                        rural=rural,
                    ),
                    comp_zone=comp_zone,
                )
        fr_name = normalize_neighborhood(source_location_name)
        if fr_name:
            canonical = fr_name
            confidence: Confidence = "source_id"
            if city_key:
                catalog_hit = resolve_exact_in_catalog(fr_name, city_key, rural=rural)
                if catalog_hit:
                    canonical = catalog_hit
                    confidence = "catalog"
            else:
                canonical = apply_rural_suffix(canonical, rural)
            return NeighborhoodResolution(
                neighborhood=canonical,
                confidence=confidence,
                dossier_key=build_dossier_key(
                    city=city,
                    city_slug=city_slug,
                    neighborhood=canonical,
                    neighborhood_source_id=neighborhood_source_id,
                    rural=rural,
                ),
                comp_zone=comp_zone,
            )

    # 2. Catalog exact + alias on candidates
    if city_key:
        for cand in cleaned:
            hit = resolve_exact_in_catalog(cand, city_key, rural=rural)
            if hit:
                return NeighborhoodResolution(
                    neighborhood=hit,
                    confidence="catalog",
                    dossier_key=build_dossier_key(
                        city=city,
                        city_slug=city_slug,
                        neighborhood=hit,
                        neighborhood_source_id=None,
                        rural=rural,
                    ),
                    comp_zone=comp_zone,
                )

    # 3. Provisional when enough peers share normalized key
    if peer_counts and cleaned:
        label, count = _best_provisional_label(cleaned, peer_counts, rural)
        if label and count >= PROVISIONAL_MIN_PEERS:
            return NeighborhoodResolution(
                neighborhood=label,
                confidence="provisional",
                dossier_key=build_dossier_key(
                    city=city,
                    city_slug=city_slug,
                    neighborhood=label,
                    neighborhood_source_id=None,
                    rural=rural,
                ),
                comp_zone=comp_zone,
            )

    # 4–5. No fake barrio from zone; leave null
    weak = bool(cleaned)
    return NeighborhoodResolution(
        neighborhood=None,
        confidence="weak" if weak else "missing",
        dossier_key=None,
        comp_zone=comp_zone,
    )


def merge_quality_flags(
    existing: dict | None,
    resolution: NeighborhoodResolution,
) -> dict:
    flags = dict(existing or {})
    flags["neighborhood_confidence"] = resolution.confidence
    flags["missing_neighborhood"] = resolution.neighborhood is None
    if resolution.dossier_key:
        flags["dossier_key"] = resolution.dossier_key
    return flags


def fetch_peer_counts(conn, city: str) -> dict[str, int]:
    """Active-listing counts by normalized neighborhood key for provisional resolution."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
          COALESCE(NULLIF(btrim(neighborhood_raw), ''), NULLIF(btrim(neighborhood), '')) AS label,
          neighborhood_source_id,
          quality_flags
        FROM listings
        WHERE is_active = true
          AND city ILIKE %s
          AND (
            (neighborhood_raw IS NOT NULL AND btrim(neighborhood_raw) <> '')
            OR (neighborhood IS NOT NULL AND btrim(neighborhood) <> '')
          )
        """,
        (city.strip(),),
    )
    counts: dict[str, int] = {}
    for label, source_id, qf in cur.fetchall():
        if not label:
            continue
        rural = False
        if isinstance(qf, dict):
            conf = qf.get("neighborhood_confidence")
            dk = qf.get("dossier_key")
            if isinstance(dk, str) and dk.endswith("-rural"):
                rural = True
            if conf == "source_id" and source_id:
                key = f"uuid:{source_id}"
                counts[key] = counts.get(key, 0) + 1
        cleaned = normalize_neighborhood(str(label))
        if not cleaned:
            continue
        key = normalize_neighborhood_key(cleaned)
        if rural:
            key = f"{key}-rural"
        counts[key] = counts.get(key, 0) + 1
    return counts
