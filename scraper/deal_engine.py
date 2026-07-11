"""Deal scoring aligned with web/lib/dealEngine.ts."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, Optional

MetricType = Literal["private", "built", "terrain", "generic"]
ConfidenceLevel = Literal["high", "medium", "low"]

GEO_RADIUS_M = 1000
MIN_RELAXED_SAMPLE = 4
MIN_SAMPLE_SIZE = 8
WINSOR_PCT = 0.05


def median(values: list[float]) -> Optional[float]:
    if not values:
        return None
    arr = sorted(values)
    mid = len(arr) // 2
    if len(arr) % 2 == 1:
        return arr[mid]
    return (arr[mid - 1] + arr[mid]) / 2.0


def percentile(values: list[float], p: float) -> Optional[float]:
    if not values:
        return None
    arr = sorted(values)
    idx = (len(arr) - 1) * p
    low = int(math.floor(idx))
    high = int(math.ceil(idx))
    if low == high:
        return arr[low]
    w = idx - low
    return arr[low] * (1 - w) + arr[high] * w


def winsorize_by_percentile(values: list[float], pct: float = WINSOR_PCT) -> list[float]:
    if len(values) < 2:
        return values
    low = percentile(values, pct)
    high = percentile(values, 1 - pct)
    if low is None or high is None:
        return values
    return [min(high, max(low, v)) for v in values]


def has_min_sample(n: int) -> bool:
    return n >= MIN_SAMPLE_SIZE


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    to_rad = math.radians
    d_lat = to_rad(lat2 - lat1)
    d_lon = to_rad(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass
class DealListingInput:
    id: str
    city: str
    neighborhood: Optional[str] = None
    zone_name: Optional[str] = None
    property_type: Optional[str] = None
    construction_state: Optional[str] = None
    estrato: Optional[int] = None
    operation_type: Optional[str] = None
    area_m2: float = 0.0
    area_built_m2: Optional[float] = None
    area_private_m2: Optional[float] = None
    area_terrain_m2: Optional[float] = None
    area_terrace_m2: Optional[float] = None
    price_cop: int = 0
    price_per_m2: Optional[float] = None
    price_per_m2_built: Optional[float] = None
    price_per_m2_private: Optional[float] = None
    price_per_m2_terrain: Optional[float] = None
    admin_fee_cop: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_updated_at: Optional[datetime] = None
    first_seen_at: Optional[datetime] = None
    data_completeness_score: Optional[float] = None
    accepts_barter: bool = False
    terrace_heavy_flag: bool = False
    area_mismatch_flag: bool = False
    is_project: bool = False
    paid_quota: Optional[bool] = None
    highlight: Optional[int] = None


@dataclass
class PriceEventInput:
    price_cop: int
    recorded_at: datetime


@dataclass
class DealScoreBreakdown:
    discount_component: float
    freshness_component: float
    completeness_component: float
    price_drop_bonus: float
    dom_bonus: float
    barter_penalty: float
    project_penalty: float
    promoted_penalty: float
    low_sample_penalty: float
    high_admin_penalty: float


@dataclass
class DealAnalysis:
    excluded: bool
    exclusion_reasons: list[str] = field(default_factory=list)
    metric_type: MetricType = "generic"
    subject_ppm2: Optional[float] = None
    ref_ppm2: Optional[float] = None
    comp_sample_size: int = 0
    comp_method: str = "none"
    discount_vs_ref_pct: Optional[float] = None
    deal_score: Optional[float] = None
    breakdown: Optional[DealScoreBreakdown] = None
    confidence: ConfidenceLevel = "low"
    confidence_reasons: list[str] = field(default_factory=list)
    price_drop_pct: Optional[float] = None
    dom_days: Optional[float] = None


def _property_type_key(property_type: Optional[str]) -> str:
    return (property_type or "").strip().lower() or "unknown"


def _is_apartment(property_type: Optional[str]) -> bool:
    t = _property_type_key(property_type)
    return "apartamento" in t or "apto" in t


def _is_house(property_type: Optional[str]) -> bool:
    return "casa" in _property_type_key(property_type)


def _is_terrain_like(property_type: Optional[str]) -> bool:
    t = _property_type_key(property_type)
    return any(x in t for x in ("lote", "terreno", "finca", "parcela"))


def _is_venta(operation_type: Optional[str]) -> bool:
    if not operation_type:
        return True
    return "venta" in operation_type.lower()


def _estrato_matches(a: Optional[int], b: Optional[int]) -> bool:
    if a is None or b is None:
        return True
    return abs(a - b) <= 1


def _construction_matches(a: Optional[str], b: Optional[str]) -> bool:
    if not a or not b:
        return True
    return a.strip().lower() == b.strip().lower()


def _area_band(area: float, tolerance_pct: float) -> tuple[float, float]:
    delta = area * tolerance_pct
    return max(5.0, area - delta), area + delta


def pick_subject_metric(
    listing: DealListingInput,
) -> tuple[MetricType, Optional[float], Optional[float]]:
    if (
        _is_apartment(listing.property_type)
        and listing.price_per_m2_private is not None
        and listing.area_private_m2 is not None
        and listing.area_private_m2 >= 20
    ):
        return "private", listing.price_per_m2_private, listing.area_private_m2

    if (
        _is_terrain_like(listing.property_type)
        and listing.price_per_m2_terrain is not None
        and listing.area_terrain_m2 is not None
        and listing.area_terrain_m2 >= 50
    ):
        return "terrain", listing.price_per_m2_terrain, listing.area_terrain_m2

    if (
        listing.price_per_m2_built is not None
        and listing.area_built_m2 is not None
        and listing.area_built_m2 >= 20
    ):
        return "built", listing.price_per_m2_built, listing.area_built_m2

    if (
        listing.price_per_m2_terrain is not None
        and listing.area_terrain_m2 is not None
        and listing.area_terrain_m2 >= 80
    ):
        return "terrain", listing.price_per_m2_terrain, listing.area_terrain_m2

    return "generic", listing.price_per_m2, listing.area_m2


def _comp_ppm2(listing: DealListingInput, metric_type: MetricType) -> Optional[float]:
    if metric_type == "private":
        return listing.price_per_m2_private
    if metric_type == "built":
        return listing.price_per_m2_built if listing.price_per_m2_built is not None else listing.price_per_m2
    if metric_type == "terrain":
        return listing.price_per_m2_terrain
    return listing.price_per_m2


def _comp_scoring_area(listing: DealListingInput, metric_type: MetricType) -> Optional[float]:
    if metric_type == "private":
        return listing.area_private_m2
    if metric_type == "built":
        return listing.area_built_m2 if listing.area_built_m2 is not None else listing.area_m2
    if metric_type == "terrain":
        return listing.area_terrain_m2
    return listing.area_m2


def area_sanity_exclude(
    listing: DealListingInput,
    min_built_ppm2_for_house: float = 900_000,
) -> list[str]:
    reasons: list[str] = []
    t = _property_type_key(listing.property_type)
    area = listing.area_m2

    if _is_apartment(listing.property_type):
        if area > 500:
            reasons.append("apartment_area_too_large")
        if area < 12:
            reasons.append("apartment_area_too_small")
        private_m2 = listing.area_private_m2 if listing.area_private_m2 is not None else listing.area_built_m2
        if private_m2 is not None and area > private_m2 * 1.15:
            reasons.append("apartment_inflated_total_area")
        if (
            private_m2 is None
            and (listing.terrace_heavy_flag or listing.area_mismatch_flag)
            and area >= 120
        ):
            reasons.append("apartment_terrace_legacy_mismatch")
        if (
            listing.area_terrace_m2 is not None
            and private_m2 is not None
            and listing.area_terrace_m2 >= private_m2 * 0.9
        ):
            reasons.append("apartment_terrace_dominant")
    elif _is_house(listing.property_type):
        if area >= 600 and (listing.area_built_m2 is None or listing.area_built_m2 < 220):
            reasons.append("house_terrain_built_mixup")
        if (
            area < 25
            and (listing.area_built_m2 is None or listing.area_built_m2 < 25)
            and (listing.area_terrain_m2 is None or listing.area_terrain_m2 < 100)
        ):
            reasons.append("house_area_too_small")
        if (
            listing.area_built_m2 is not None
            and listing.area_terrain_m2 is not None
            and listing.area_built_m2 > listing.area_terrain_m2 * 1.5
        ):
            reasons.append("house_contradictory_areas")
        if (
            area >= 900
            and (listing.bedrooms or 0) <= 6
            and (listing.bathrooms or 0) <= 8
            and listing.price_per_m2_built is not None
            and listing.price_per_m2_built < min_built_ppm2_for_house
            and (
                listing.price_per_m2_terrain is None
                or listing.price_per_m2_terrain <= listing.price_per_m2_built * 1.4
            )
        ):
            reasons.append("house_low_built_density")
    elif _is_terrain_like(listing.property_type):
        if area < 50:
            reasons.append("terrain_area_too_small")
        if area > 500_000:
            reasons.append("terrain_area_implausible")
    elif "oficina" in t or "local" in t:
        if area > 10_000:
            reasons.append("commercial_area_implausible")
    elif area > 20_000:
        reasons.append("area_implausible")

    if listing.is_project:
        reasons.append("project_not_resale")
    return reasons


def _comp_compatible(
    subject: DealListingInput,
    candidate: DealListingInput,
    metric_type: MetricType,
) -> bool:
    if candidate.id == subject.id:
        return False
    if subject.city != candidate.city:
        return False
    if not _is_venta(candidate.operation_type):
        return False
    if (
        subject.property_type
        and candidate.property_type
        and _property_type_key(subject.property_type) != _property_type_key(candidate.property_type)
    ):
        return False
    if not _estrato_matches(subject.estrato, candidate.estrato):
        return False
    if not _construction_matches(subject.construction_state, candidate.construction_state):
        return False

    ppm2 = _comp_ppm2(candidate, metric_type)
    if ppm2 is None or not math.isfinite(ppm2) or ppm2 <= 0:
        return False

    subject_area = _comp_scoring_area(subject, metric_type)
    candidate_area = _comp_scoring_area(candidate, metric_type)
    if subject_area is not None and candidate_area is not None and subject_area > 0:
        band_min, band_max = _area_band(subject_area, 0.35)
        if candidate_area < band_min or candidate_area > band_max:
            return False

    return len(area_sanity_exclude(candidate)) == 0


def _location_tier(subject: DealListingInput, candidate: DealListingInput) -> int:
    if (
        subject.zone_name
        and candidate.zone_name
        and subject.zone_name.strip().lower() == candidate.zone_name.strip().lower()
    ):
        return 0
    if (
        subject.neighborhood
        and candidate.neighborhood
        and subject.neighborhood.strip().lower() == candidate.neighborhood.strip().lower()
    ):
        return 1
    return 2


def select_comps(
    subject: DealListingInput,
    pool: list[DealListingInput],
    metric_type: MetricType,
) -> tuple[list[DealListingInput], str]:
    compatible = [c for c in pool if _comp_compatible(subject, c, metric_type)]
    if not compatible:
        return [], "none"

    if subject.latitude is not None and subject.longitude is not None:
        geo_ordered = sorted(
            compatible,
            key=lambda c: (
                haversine_meters(
                    subject.latitude,
                    subject.longitude,
                    c.latitude,
                    c.longitude,
                )
                if c.latitude is not None and c.longitude is not None
                else float("inf")
            ),
        )
        near = [
            c
            for c in geo_ordered
            if c.latitude is not None
            and c.longitude is not None
            and haversine_meters(
                subject.latitude,
                subject.longitude,
                c.latitude,
                c.longitude,
            )
            <= GEO_RADIUS_M
        ]
        if len(near) >= MIN_RELAXED_SAMPLE:
            return near[:24], "geo_1km"

    by_location = sorted(compatible, key=lambda c: _location_tier(subject, c))
    zone = [c for c in by_location if _location_tier(subject, c) == 0]
    if len(zone) >= MIN_RELAXED_SAMPLE:
        return zone[:24], "zone"

    nb = [c for c in by_location if _location_tier(subject, c) <= 1]
    if len(nb) >= MIN_RELAXED_SAMPLE:
        return nb[:24], "neighborhood"

    return by_location[:24], "city"


def reference_ppm2_from_comps(
    comps: list[DealListingInput],
    metric_type: MetricType,
) -> Optional[float]:
    values = [
        v
        for c in comps
        for v in [_comp_ppm2(c, metric_type)]
        if v is not None and math.isfinite(v) and v > 0
    ]
    if len(values) < MIN_RELAXED_SAMPLE:
        return None
    clipped = winsorize_by_percentile(values, WINSOR_PCT)
    return median(clipped)


def recent_price_drop_pct(
    events: list[PriceEventInput],
    current_price: int,
    within_days: int = 60,
) -> Optional[float]:
    if not events or current_price <= 0:
        return None
    cutoff = datetime.now(timezone.utc).timestamp() - within_days * 86400
    in_window = [
        e
        for e in events
        if _aware_ts(e.recorded_at) >= cutoff
    ]
    if not in_window:
        return None
    prior_prices = [e.price_cop for e in in_window if e.price_cop > current_price]
    if not prior_prices:
        return None
    max_prior = max(prior_prices)
    if max_prior <= current_price:
        return None
    return ((max_prior - current_price) / max_prior) * 100.0


def _aware_ts(dt: datetime) -> float:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _dom_days(first_seen_at: Optional[datetime]) -> Optional[float]:
    if not first_seen_at:
        return None
    now = datetime.now(timezone.utc)
    if first_seen_at.tzinfo is None:
        first_seen_at = first_seen_at.replace(tzinfo=timezone.utc)
    return max(0.0, (now - first_seen_at).total_seconds() / 86400.0)


def _compute_confidence(
    listing: DealListingInput,
    sample_size: int,
    comp_method: str,
    extra_reasons: list[str],
) -> tuple[ConfidenceLevel, list[str]]:
    reasons = list(extra_reasons)
    score = 100

    if not listing.property_type:
        score -= 20
        reasons.append("missing_property_type")
    if not listing.neighborhood and not listing.zone_name:
        score -= 15
        reasons.append("missing_location")
    if not listing.source_updated_at:
        score -= 10
        reasons.append("missing_update_time")
    else:
        updated = listing.source_updated_at
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - updated).total_seconds() / 86400.0
        if age_days > 45:
            score -= 20
            reasons.append("stale_listing")
        elif age_days > 20:
            score -= 10
            reasons.append("aging_listing")
    if listing.accepts_barter:
        score -= 12
        reasons.append("accepts_barter_soft_price")
    if not has_min_sample(sample_size):
        score -= 18
        reasons.append("low_comp_sample")
    elif sample_size < 12:
        score -= 8
        reasons.append("moderate_comp_sample")
    if comp_method == "city":
        score -= 10
        reasons.append("city_wide_comps")

    if score >= 80:
        return "high", reasons
    if score >= 55:
        return "medium", reasons
    return "low", reasons


def analyze_deal(
    subject: DealListingInput,
    pool: list[DealListingInput],
    *,
    price_events: Optional[list[PriceEventInput]] = None,
    min_built_ppm2_for_house: float = 900_000,
    require_positive_discount: bool = False,
) -> DealAnalysis:
    exclusion_reasons = area_sanity_exclude(subject, min_built_ppm2_for_house)
    if exclusion_reasons:
        return DealAnalysis(
            excluded=True,
            exclusion_reasons=exclusion_reasons,
            comp_method="excluded",
            confidence_reasons=exclusion_reasons,
            dom_days=_dom_days(subject.first_seen_at),
        )

    metric_type, subject_ppm2, _ = pick_subject_metric(subject)
    comps, method = select_comps(subject, pool, metric_type)
    ref_ppm2 = reference_ppm2_from_comps(comps, metric_type)
    sample_size = len(comps)

    discount_vs_ref_pct: Optional[float] = None
    if subject_ppm2 is not None and ref_ppm2 is not None and ref_ppm2 > 0:
        discount_vs_ref_pct = ((ref_ppm2 - subject_ppm2) / ref_ppm2) * 100.0

    if require_positive_discount and (
        discount_vs_ref_pct is None or discount_vs_ref_pct <= 0
    ):
        return DealAnalysis(
            excluded=True,
            exclusion_reasons=["not_below_reference"],
            metric_type=metric_type,
            subject_ppm2=subject_ppm2,
            ref_ppm2=ref_ppm2,
            comp_sample_size=sample_size,
            comp_method=method,
            discount_vs_ref_pct=discount_vs_ref_pct,
            confidence="low",
            confidence_reasons=["not_below_reference"],
            dom_days=_dom_days(subject.first_seen_at),
        )

    current_price = int(subject.price_cop)
    price_drop_pct = (
        recent_price_drop_pct(price_events or [], current_price)
        if price_events
        else None
    )
    dom = _dom_days(subject.first_seen_at)

    rel_discount = 0.0
    if subject_ppm2 is not None and ref_ppm2 is not None and ref_ppm2 > 0:
        rel_discount = max(-1.0, min(1.0, (ref_ppm2 - subject_ppm2) / ref_ppm2))

    if subject.source_updated_at:
        updated = subject.source_updated_at
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        age_days = max(0.0, (datetime.now(timezone.utc) - updated).total_seconds() / 86400.0)
    else:
        age_days = 30.0

    freshness_component = max(0.0, 1.0 - min(age_days / 30.0, 1.0)) * 12.0
    completeness_component = max(0.0, min(1.0, subject.data_completeness_score or 0.0)) * 8.0
    discount_component = rel_discount * 80.0

    price_drop_bonus = 0.0
    if price_drop_pct is not None:
        if price_drop_pct >= 10:
            price_drop_bonus = 5.0
        elif price_drop_pct >= 5:
            price_drop_bonus = 3.0
        elif price_drop_pct >= 2:
            price_drop_bonus = 1.0

    dom_bonus = 0.0
    if dom is not None and (discount_vs_ref_pct or 0) > 0:
        if dom >= 90:
            dom_bonus = 2.0
        elif dom >= 60:
            dom_bonus = 1.0

    barter_penalty = 12.0 if subject.accepts_barter else 0.0
    project_penalty = 8.0 if subject.is_project else 0.0
    promoted_penalty = (
        5.0
        if subject.paid_quota or (subject.highlight is not None and subject.highlight > 0)
        else 0.0
    )
    low_sample_penalty = 0.0 if has_min_sample(sample_size) else 6.0
    high_admin_penalty = 0.0
    if subject.admin_fee_cop is not None and subject.admin_fee_cop >= 2_500_000:
        high_admin_penalty = 2.0

    breakdown = DealScoreBreakdown(
        discount_component=round(discount_component, 4),
        freshness_component=round(freshness_component, 4),
        completeness_component=round(completeness_component, 4),
        price_drop_bonus=price_drop_bonus,
        dom_bonus=dom_bonus,
        barter_penalty=barter_penalty,
        project_penalty=project_penalty,
        promoted_penalty=promoted_penalty,
        low_sample_penalty=low_sample_penalty,
        high_admin_penalty=high_admin_penalty,
    )

    if subject_ppm2 is None or ref_ppm2 is None or ref_ppm2 <= 0:
        raw_score = None
    else:
        raw_score = (
            discount_component
            + freshness_component
            + completeness_component
            + price_drop_bonus
            + dom_bonus
            - barter_penalty
            - project_penalty
            - promoted_penalty
            - low_sample_penalty
            - high_admin_penalty
        )

    deal_score_value = (
        None if raw_score is None else round(max(0.0, raw_score), 4)
    )

    confidence, reasons = _compute_confidence(subject, sample_size, method, [])

    return DealAnalysis(
        excluded=False,
        metric_type=metric_type,
        subject_ppm2=subject_ppm2,
        ref_ppm2=ref_ppm2,
        comp_sample_size=sample_size,
        comp_method=method,
        discount_vs_ref_pct=discount_vs_ref_pct,
        deal_score=deal_score_value,
        breakdown=breakdown,
        confidence=confidence,
        confidence_reasons=reasons,
        price_drop_pct=price_drop_pct,
        dom_days=dom,
    )


def min_built_ppm2_for_house(pool: list[DealListingInput]) -> float:
    built_house = [
        l.price_per_m2_built
        for l in pool
        if "casa" in (l.property_type or "").lower()
        and l.price_per_m2_built is not None
        and math.isfinite(l.price_per_m2_built)
        and l.price_per_m2_built > 0
    ]
    p15 = percentile(built_house, 0.15)
    if p15 is None:
        return 900_000.0
    return max(900_000.0, p15 * 0.75)


def listing_from_row(row: tuple[Any, ...], columns: list[str]) -> DealListingInput:
    data = dict(zip(columns, row))
    return DealListingInput(
        id=str(data["id"]),
        city=str(data.get("city") or ""),
        neighborhood=data.get("neighborhood"),
        zone_name=data.get("zone_name"),
        property_type=data.get("property_type"),
        construction_state=data.get("construction_state"),
        estrato=data.get("estrato"),
        operation_type=data.get("operation_type"),
        area_m2=float(data.get("area_m2") or 0),
        area_built_m2=data.get("area_built_m2"),
        area_private_m2=data.get("area_private_m2"),
        area_terrain_m2=data.get("area_terrain_m2"),
        area_terrace_m2=data.get("area_terrace_m2"),
        price_cop=int(data.get("price_cop") or 0),
        price_per_m2=data.get("price_per_m2"),
        price_per_m2_built=data.get("price_per_m2_built"),
        price_per_m2_private=data.get("price_per_m2_private"),
        price_per_m2_terrain=data.get("price_per_m2_terrain"),
        admin_fee_cop=int(data["admin_fee_cop"]) if data.get("admin_fee_cop") is not None else None,
        bedrooms=data.get("bedrooms"),
        bathrooms=data.get("bathrooms"),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        source_updated_at=data.get("source_updated_at"),
        first_seen_at=data.get("first_seen_at"),
        data_completeness_score=data.get("data_completeness_score"),
        accepts_barter=bool(data.get("accepts_barter")),
        terrace_heavy_flag=bool(data.get("terrace_heavy_flag")),
        area_mismatch_flag=bool(data.get("area_mismatch_flag")),
        is_project=bool(data.get("is_project")),
        paid_quota=data.get("paid_quota"),
        highlight=data.get("highlight"),
    )
