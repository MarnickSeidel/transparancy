"""
Canonical neighborhood lists per city (see data/neighborhoods/*.json).

When a catalog exists for the scrape city, we only accept a neighborhood string
if it matches the list (exact, alias, or fuzzy). Otherwise we try the next
candidate source (structured → zone → locations → title → address).
"""

from __future__ import annotations

import json
import re
import unicodedata
from difflib import get_close_matches
from pathlib import Path

from parse_fields import normalize_neighborhood

# Single source of truth: shared with web/app (web/data/neighborhoods).
_DATA_DIR = Path(__file__).resolve().parent.parent / "web" / "data" / "neighborhoods"

# Folded prefixes stripped before matching (accents already stripped in _fold).
_STRIP_PREFIXES: tuple[str, ...] = (
    "belen ",
    "barrio ",
    "sector ",
    "urbanizacion ",
    "conjunto ",
    "zona ",
    "comuna ",
    "vereda ",
    "ciudadela ",
)

# Minimum folded length for suffix-only match (avoids "la", "el", "oso").
_MIN_SUFFIX_LEN = 5

# fold_key -> canonical display name
_fold_to_canonical: dict[str, dict[str, str]] = {}
# city_key -> source_id -> canonical display name
_source_id_to_canonical: dict[str, dict[str, str]] = {}
# city_key -> folded canonical names whose dossier is keyed by name, not FR location id
# (FR splits these barrios across several location ids that also cover other barrios).
_dossier_by_name: dict[str, set[str]] = {}
# city_key -> True if loaded
_loaded: set[str] = set()


def _fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s.strip())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = s.replace("nº", "no").replace("n°", "no").replace("°", "")
    s = re.sub(r"[^\w\s\-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _load_city_file(path: Path) -> None:
    raw = json.loads(path.read_text(encoding="utf-8"))
    city_key = str(raw.get("city_key") or path.stem).strip().lower()
    names = raw.get("neighborhoods") or raw.get("names") or []
    if not isinstance(names, list):
        return
    aliases = raw.get("aliases") or {}
    if not isinstance(aliases, dict):
        aliases = {}

    bucket: dict[str, str] = {}
    for n in names:
        if not isinstance(n, str):
            continue
        c = " ".join(n.split())
        if not c:
            continue
        bucket[_fold(c)] = c

    for alias, target in aliases.items():
        if isinstance(alias, str) and isinstance(target, str):
            ta = " ".join(target.split())
            if ta:
                bucket[_fold(alias)] = ta

    source_ids = raw.get("source_ids") or {}
    id_bucket: dict[str, str] = {}
    if isinstance(source_ids, dict):
        for sid, target in source_ids.items():
            if isinstance(sid, str) and isinstance(target, str):
                ta = " ".join(target.split())
                if ta:
                    id_bucket[sid.strip()] = ta

    by_name = raw.get("dossier_by_name") or []
    _dossier_by_name[city_key] = (
        {_fold(n) for n in by_name if isinstance(n, str) and n.strip()}
        if isinstance(by_name, list)
        else set()
    )

    _fold_to_canonical[city_key] = bucket
    _source_id_to_canonical[city_key] = id_bucket
    _loaded.add(city_key)


def load_all_catalogs() -> None:
    _fold_to_canonical.clear()
    _source_id_to_canonical.clear()
    _dossier_by_name.clear()
    _loaded.clear()
    if not _DATA_DIR.is_dir():
        return
    for path in sorted(_DATA_DIR.glob("*.json")):
        try:
            _load_city_file(path)
        except (OSError, json.JSONDecodeError, TypeError):
            continue


def catalog_key_for_city(city: str | None, city_slug: str | None) -> str | None:
    if city_slug:
        sk = _fold(city_slug.replace("city-colombia-", "").replace("_", "-"))
        if sk in _fold_to_canonical:
            return sk
        # slug like "05-001" — skip
    if city:
        ck = _fold(city)
        if ck in _fold_to_canonical:
            return ck
        if ck.replace(" ", "") == "medellin" and "medellin" in _fold_to_canonical:
            return "medellin"
    return None


def _resolve_fold(
    fp: str, bucket: dict[str, str], keys: list[str], fuzzy_cutoff: float
) -> str | None:
    if len(fp) < 2:
        return None
    if fp in bucket:
        return bucket[fp]
    m = get_close_matches(fp, keys, n=1, cutoff=fuzzy_cutoff)
    if m:
        return bucket[m[0]]
    return None


def _suffix_catalog_match(f: str, bucket: dict[str, str]) -> str | None:
    """Match trailing catalog name: 'belen rosales' → Rosales."""
    canon_values = sorted(set(bucket.values()), key=lambda x: len(_fold(x)), reverse=True)
    for canon in canon_values:
        tf = _fold(canon)
        if len(tf) < _MIN_SUFFIX_LEN:
            continue
        if f == tf:
            continue
        if not f.endswith(tf):
            continue
        if len(f) > len(tf) and f[-len(tf) - 1] != " ":
            continue
        return canon
    return None


def dossier_keyed_by_name(city_key: str | None, canonical: str | None) -> bool:
    if not city_key or not canonical or not canonical.strip():
        return False
    return _fold(canonical) in _dossier_by_name.get(city_key, set())


def resolve_by_source_id(source_id: str | None, city_key: str) -> str | None:
    if not source_id or not source_id.strip():
        return None
    bucket = _source_id_to_canonical.get(city_key)
    if not bucket:
        return None
    return bucket.get(source_id.strip())


def resolve_exact_in_catalog(
    raw: str | None,
    city_key: str,
    *,
    rural: bool = False,
) -> str | None:
    """Exact fold match + aliases only (no fuzzy or substring merge)."""
    if not raw or not str(raw).strip():
        return None
    bucket = _fold_to_canonical.get(city_key)
    if not bucket:
        return None
    text = " ".join(str(raw).split())
    f = _fold(text)
    if len(f) < 2:
        return None
    hit = bucket.get(f)
    if not hit:
        return None
    if rural:
        low = hit.casefold()
        if not low.endswith(" rural"):
            rural_hit = bucket.get(f"{f} rural") or bucket.get(_fold(f"{hit} rural"))
            if rural_hit:
                return rural_hit
            return f"{hit} rural"
    return hit


def resolve_in_catalog(raw: str | None, city_key: str) -> str | None:
    if not raw or not str(raw).strip():
        return None
    bucket = _fold_to_canonical.get(city_key)
    if not bucket:
        return None
    text = " ".join(str(raw).split())
    f = _fold(text)
    keys = list(bucket.keys())

    hit = _resolve_fold(f, bucket, keys, 0.82)
    if hit:
        return hit

    for part in re.split(r"[,;]", text):
        part = " ".join(part.split())
        if len(part) < 4:
            continue
        fp = _fold(part)
        hit = _resolve_fold(fp, bucket, keys, 0.85)
        if hit:
            return hit

    for part in re.split(r"\s*[-–/|]\s*", text):
        part = " ".join(part.split())
        if len(part) < 4:
            continue
        fp = _fold(part)
        hit = _resolve_fold(fp, bucket, keys, 0.85)
        if hit:
            return hit

    for pfx in _STRIP_PREFIXES:
        if f.startswith(pfx) and len(f) > len(pfx) + 2:
            tail = f[len(pfx) :].strip()
            hit = _resolve_fold(tail, bucket, keys, 0.88)
            if hit:
                return hit

    hit = _suffix_catalog_match(f, bucket)
    if hit:
        return hit

    return None


def pick_neighborhood_with_catalog(
    candidates: list[str | None],
    city_key: str | None,
) -> str | None:
    """
    Try candidates in order. If city_key has a catalog, return the first
    candidate that resolves to a canonical name; else None.
    If no catalog for city, return first non-empty candidate (normalized).
    """
    cleaned = [normalize_neighborhood(c) for c in candidates]
    cleaned = [c for c in cleaned if c]

    if not city_key or city_key not in _fold_to_canonical:
        return cleaned[0] if cleaned else None

    for c in cleaned:
        hit = resolve_in_catalog(c, city_key)
        if hit:
            return hit
    return None


load_all_catalogs()
