"""
Scrape Fincaraiz Pereira listings from embedded __NEXT_DATA__ JSON.

This avoids opening individual listing pages and avoids API endpoint calls.
"""

from __future__ import annotations

import hashlib
import http.client
import json
from datetime import datetime, timezone
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from config import (
    CITY_DEFAULT,
    SKIP_DEAL_REFRESH,
    DEPARTMENT_DEFAULT,
    LISTING_URL,
    MAX_LISTINGS_PER_RUN,
    MAX_NO_ACTION_PAGES,
    START_PAGE,
)
from db import connect, get_existing_listing_meta, refresh_deals_after_scrape, touch_listings_last_seen, upsert_listings
from human_behavior import pause_action, pause_short, pick_user_agent
from neighborhood_catalog import catalog_key_for_city, load_all_catalogs
from neighborhood_resolver import (
    fetch_peer_counts,
    merge_quality_flags,
    resolve_neighborhood,
)
from parse_fields import (
    clean_area_m2,
    clean_price_cop,
    neighborhood_from_title,
    normalize_neighborhood,
    parse_estrato,
)
from robots_check import maybe_random_pre_navigation_delay, robots_allows_listing

NEXT_DATA_RE = re.compile(
    r'<script[^>]*id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)


def paginated_url(base_url: str, page_num: int) -> str:
    """Build Finca Raiz city-search page URLs: /pagina2, /pagina3, ..."""
    clean = base_url.rstrip("/")
    clean = re.sub(r"/pagina\d+$", "", clean)
    if page_num <= 1:
        return clean
    return f"{clean}/pagina{page_num}"


def fetch_html(url: str) -> str:
    last: BaseException | None = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": pick_user_agent(),
                    "Accept-Language": "es-CO,es;q=0.9,en;q=0.5",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                return resp.read().decode("utf-8", "replace")
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            http.client.IncompleteRead,
            TimeoutError,
            ConnectionError,
        ) as e:
            last = e
            if attempt < 3:
                time.sleep(2.0 * (attempt + 1))
    assert last is not None
    raise last


def extract_next_data(html: str) -> dict[str, Any]:
    m = NEXT_DATA_RE.search(html)
    if not m:
        raise ValueError("__NEXT_DATA__ script not found in HTML")
    return json.loads(m.group(1))


def extract_listings(next_data: dict[str, Any]) -> list[dict[str, Any]]:
    props = next_data.get("props", {})
    page_props = props.get("pageProps", {}) if isinstance(props, dict) else {}
    fetch_result = page_props.get("fetchResult", {}) if isinstance(page_props, dict) else {}
    search_fast = fetch_result.get("searchFast", {}) if isinstance(fetch_result, dict) else {}
    data = search_fast.get("data", []) if isinstance(search_fast, dict) else []
    if not isinstance(data, list):
        return []
    return [x for x in data if isinstance(x, dict)]


def parse_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, float):
        if value < 0:
            return None
        return int(value)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            n = int(float(s.replace(",", ".")))
            return n if n >= 0 else None
        except ValueError:
            return None
    return None


def parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    txt = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(txt)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def parse_money_to_int(value: Any) -> int | None:
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        return clean_price_cop(value)
    if isinstance(value, dict):
        for key in ("amount", "value", "cop", "name", "label", "text"):
            n = parse_money_to_int(value.get(key))
            if n is not None:
                return n
    return None


def extract_admin_fee(item: dict[str, Any], blob: str) -> int | None:
    common = item.get("commonExpenses")
    if isinstance(common, dict):
        n = parse_money_to_int(common.get("amount"))
        if n is not None:
            return n

    for key in ("admin", "adminPrice", "admin_fee", "administration"):
        if key in item:
            n = parse_money_to_int(item.get(key))
            if n is not None:
                return n

    finances = item.get("finances")
    if isinstance(finances, dict):
        for key in ("admin", "adminPrice", "administration", "hoa"):
            n = parse_money_to_int(finances.get(key))
            if n is not None:
                return n

    sheet_admin = parse_technical_sheet_value(item, "commonExpenses")
    if sheet_admin:
        n = clean_price_cop(sheet_admin)
        if n is not None:
            return n

    m = re.search(r"\+\s*\$\s*([\d.,]+)\s*admin", blob, flags=re.IGNORECASE)
    if m:
        return clean_price_cop(m.group(1))
    return None


def parse_area_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        n = float(value)
        return n if n > 0 else None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            n = float(s.replace(",", "."))
            return n if n > 0 else None
        except ValueError:
            return clean_area_m2(s)
    return None


def parse_technical_sheet_value(item: dict[str, Any], field: str) -> str | None:
    sheet = item.get("technicalSheet")
    if not isinstance(sheet, list):
        return None
    for row in sheet:
        if not isinstance(row, dict):
            continue
        if str(row.get("field") or "").strip() == field:
            val = row.get("value")
            if isinstance(val, str) and val.strip():
                return val.strip()
    return None


def parse_technical_sheet_fields(item: dict[str, Any]) -> dict[str, Any]:
    sheet = item.get("technicalSheet")
    if not isinstance(sheet, list):
        return {}
    out: dict[str, Any] = {}
    for row in sheet:
        if not isinstance(row, dict):
            continue
        field = str(row.get("field") or "").strip()
        value = row.get("value")
        if field and value is not None:
            out[field] = value
    return out


_TERRACE_AREA_RES = (
    re.compile(
        r"(?i)terraza\s+(?:de\s+)?([\d.,]+)\s*m(?:²|2|\b)",
    ),
    re.compile(
        r"(?i)([\d.,]+)\s*m(?:²|2)\s+(?:de\s+)?terraza",
    ),
    re.compile(
        r"(?i)terraza\s+de\s+([\d.,]+)",
    ),
)


def parse_terrace_area_from_text(text: str) -> float | None:
    if not text:
        return None
    for pat in _TERRACE_AREA_RES:
        m = pat.search(text.replace("\u00a0", " "))
        if not m:
            continue
        try:
            n = float(m.group(1).replace(",", "."))
            if 4 <= n <= 500:
                return n
        except ValueError:
            continue
    return None


def is_apartment_property(property_type: str | None, item: dict[str, Any]) -> bool:
    t = (property_type or "").casefold()
    if "apartamento" in t or "apto" in t:
        return True
    type_id = item.get("typeID") or item.get("property_type_id")
    return type_id == 2


def parse_barter_flag(item: dict[str, Any], tech: dict[str, Any]) -> bool:
    if bool(item.get("barter")):
        return True
    raw = tech.get("barter")
    if isinstance(raw, str):
        s = raw.strip().casefold()
        return s in {"si", "sí", "yes", "true", "1"}
    return False


def extract_facilities(item: dict[str, Any]) -> list[dict[str, Any]] | None:
    raw = item.get("facilities")
    if not isinstance(raw, list):
        return None
    out: list[dict[str, Any]] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        name = normalize_named_field(row.get("name"))
        if not name:
            continue
        entry: dict[str, Any] = {"name": name}
        if row.get("id") is not None:
            entry["id"] = row.get("id")
        group = normalize_named_field(row.get("group"))
        if group:
            entry["group"] = group
        out.append(entry)
    return out or None


def facilities_has_terrace(facilities: list[dict[str, Any]] | None) -> bool:
    if not facilities:
        return False
    for f in facilities:
        name = str(f.get("name") or "").casefold()
        if name == "terraza" or "terraza" in name:
            return True
    return False


def extract_owner_fields(item: dict[str, Any]) -> dict[str, Any]:
    owner = item.get("owner")
    if not isinstance(owner, dict):
        return {}
    out: dict[str, Any] = {}
    oid = owner.get("id")
    if isinstance(oid, int):
        out["owner_id"] = oid
    name = normalize_named_field(owner.get("name"))
    if name:
        out["owner_name"] = name[:200]
    otype = normalize_named_field(owner.get("type"))
    if otype:
        out["owner_type"] = otype[:50]
    if "particular" in owner:
        out["owner_particular"] = bool(owner.get("particular"))
    return out


def extract_location_main_meta(item: dict[str, Any]) -> dict[str, str | None]:
    """FR location_main name, type, slug for barrio resolution."""
    out: dict[str, str | None] = {
        "location_main_name": None,
        "location_type": None,
        "location_slug": None,
    }
    locs = item.get("locations")
    if not isinstance(locs, dict):
        return out
    lm = locs.get("location_main")
    if not isinstance(lm, dict):
        return out
    name = normalize_named_field(lm.get("name"))
    if name:
        out["location_main_name"] = name[:100]
    ltype = lm.get("location_type")
    if isinstance(ltype, str) and ltype.strip():
        out["location_type"] = ltype.strip()[:50]
    slug = first_slug(lm.get("slug"))
    if slug:
        out["location_slug"] = slug[:80]
    return out


def extract_location_enrichment(item: dict[str, Any]) -> dict[str, str | None]:
    locs = item.get("locations")
    out: dict[str, str | None] = {
        "neighborhood_source_id": None,
        "zone_name": None,
        "commune_name": None,
    }
    if not isinstance(locs, dict):
        return out

    for key, target in (
        ("neighbourhood", "neighborhood_source_id"),
        ("neighborhood", "neighborhood_source_id"),
    ):
        nodes = locs.get(key)
        if isinstance(nodes, list) and nodes and isinstance(nodes[0], dict):
            nid = nodes[0].get("id")
            if isinstance(nid, str) and nid.strip():
                out["neighborhood_source_id"] = nid.strip()[:120]
                break

    lm = locs.get("location_main")
    if out["neighborhood_source_id"] is None and isinstance(lm, dict):
        nid = lm.get("id")
        if isinstance(nid, str) and nid.strip():
            out["neighborhood_source_id"] = nid.strip()[:120]

    for key, target in (("zone", "zone_name"), ("commune", "commune_name")):
        nodes = locs.get(key)
        if isinstance(nodes, list) and nodes and isinstance(nodes[0], dict):
            name = normalize_named_field(nodes[0].get("name"))
            if name:
                out[target] = name[:100]
    return out


def resolve_listing_areas(
    item: dict[str, Any],
    *,
    property_type: str | None,
    blob: str,
) -> dict[str, Any]:
    tech = parse_technical_sheet_fields(item)
    is_apt = is_apartment_property(property_type, item)

    m2_total = parse_area_number(item.get("m2"))
    m2_built = parse_area_number(item.get("m2Built")) or parse_area_number(
        tech.get("m2Built")
    )
    m2_private = parse_area_number(item.get("m2apto")) or parse_area_number(
        tech.get("m2apto")
    )
    m2_terrain = parse_area_number(item.get("m2Terrain"))
    m2_terrace = parse_area_number(item.get("m2Terrace")) or parse_area_number(
        tech.get("m2Terrace")
    )
    if m2_terrace is None:
        m2_terrace = parse_terrace_area_from_text(blob)

    area_mismatch = False
    terrace_heavy = False

    if is_apt and m2_private:
        area = m2_private
        area_built = m2_private
        if m2_built and m2_built > m2_private * 1.12:
            area_mismatch = True
            terrace_heavy = True
        elif m2_total and m2_total > m2_private * 1.12:
            area_mismatch = True
            terrace_heavy = True
        if m2_terrace and m2_private and m2_terrace >= m2_private * 0.5:
            terrace_heavy = True
    else:
        area = m2_total or m2_built or m2_private
        area_built = m2_built or m2_private or m2_total
        if (
            m2_built
            and m2_private
            and max(m2_built, m2_private) / min(m2_built, m2_private) >= 1.25
        ):
            area_mismatch = True

    if area is None:
        area = clean_area_m2(blob)
    if area_built is None and area is not None:
        area_built = area

    return {
        "area_m2": area,
        "area_built_m2": area_built,
        "area_private_m2": m2_private,
        "area_terrain_m2": m2_terrain,
        "area_terrace_m2": m2_terrace,
        "area_mismatch_flag": area_mismatch,
        "terrace_heavy_flag": terrace_heavy,
        "construction_state": normalize_named_field(
            tech.get("construction_state_name")
        ),
    }


def normalize_named_field(value: Any) -> str | None:
    if isinstance(value, str):
        s = value.strip()
        return s[:100] if s else None
    if isinstance(value, dict):
        for key in ("name", "label", "value", "text"):
            s = normalize_named_field(value.get(key))
            if s:
                return s
    return None


def extract_neighborhood_structured(item: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    nodes = item.get("neighbourhood")
    if not (isinstance(nodes, list) and nodes and isinstance(nodes[0], dict)):
        return None, None, None
    n = nodes[0]
    name = normalize_named_field(n.get("name"))
    nid = n.get("id")
    neighborhood_id = nid.strip()[:120] if isinstance(nid, str) and nid.strip() else None
    nslug = first_slug(n.get("slug"))
    return name, neighborhood_id, nslug


def extract_zone_names(item: dict[str, Any]) -> list[str]:
    zones = item.get("zone")
    if not isinstance(zones, list):
        return []
    out: list[str] = []
    for z in zones:
        if not isinstance(z, dict):
            continue
        name = normalize_named_field(z.get("name"))
        if name:
            out.append(name)
    return out


def extract_neighborhood_from_locations(item: dict[str, Any]) -> str | None:
    """
    Many cards (e.g. Medellín) leave neighbourhood[] empty but put the barrio on
    locations.location_main with location_type == 'neighbourhood'.
    """
    locs = item.get("locations")
    if not isinstance(locs, dict):
        return None
    lm = locs.get("location_main")
    if not isinstance(lm, dict):
        return None
    ltype = str(lm.get("location_type") or "").strip().lower()
    if ltype != "neighbourhood":
        return None
    name = normalize_named_field(lm.get("name"))
    if name and is_valid_neighborhood_candidate(name):
        return name
    return None


def _is_street_address_fragment(s: str) -> bool:
    """True if string looks like a street line, not a barrio name."""
    t = s.strip()
    if not t:
        return True
    if "#" in t:
        return True
    if re.search(r"(?i)\b(calle|cll\.?|carrera|cra\.?|cr\.?|diag\.?onal|av\.|transversal)\b", t):
        return True
    if re.search(r"\d+\s*[-#]\s*\d", t):
        return True
    return False


def neighborhood_from_address(address: Any) -> str | None:
    if not isinstance(address, str):
        return None
    parts = [p.strip() for p in address.split(",") if p and p.strip()]
    if not parts:
        return None
    # "..., El Poblado, Medellín, Antioquia, Colombia" → barrio often before city
    city_pat = re.compile(
        r"(?i)\b(medell[ií]n|pereira|bogot[aá]|cali|envigado|itag[uú]i|bello|sabaneta)\b",
    )
    for i, p in enumerate(parts):
        if city_pat.search(p) and i > 0:
            cand = parts[i - 1]
            if not _is_street_address_fragment(cand) and is_valid_neighborhood_candidate(cand):
                return normalize_neighborhood(cand)
    first = parts[0]
    if not _is_street_address_fragment(first) and is_valid_neighborhood_candidate(first):
        return normalize_neighborhood(first)
    return None


def dedupe_names(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        key = v.strip().casefold()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(v.strip())
    return out


def is_valid_neighborhood_candidate(value: str | None) -> bool:
    if not value:
        return False
    s = " ".join(value.strip().split())
    if not s:
        return False
    low = s.casefold()
    if low in {"unknown", "desconocido", "n/a", "na", "-", "--", "none", "null"}:
        return False
    # Very long strings are usually full address lines, not neighborhoods.
    if len(s) > 60:
        return False
    # Require at least one alphabetic character.
    if not re.search(r"[a-zA-Z\u00C0-\u024F]", s):
        return False
    return True


def first_raw_neighborhood_label(candidates: list[str | None]) -> str | None:
    """First portal-style zone/barrio label (before catalog), for display / audit."""
    for c in candidates:
        if not is_valid_neighborhood_candidate(c):
            continue
        n = normalize_neighborhood(c)
        if n:
            return n[:200]
    return None


def neighborhood_fallback_raw_from_location_path(
    path: list[str] | None,
    city: str,
    department: str,
) -> str | None:
    """When structured/title/address miss barrio, use finest location segment (not city/dept)."""
    if not path:
        return None
    city_f = city.strip().casefold() if city else ""
    dept_f = department.strip().casefold() if department else ""
    skip = {city_f, dept_f, "colombia", ""}
    for seg in reversed(path):
        if not isinstance(seg, str):
            continue
        t = " ".join(seg.split())
        if not t or t.casefold() in skip:
            continue
        if not is_valid_neighborhood_candidate(t):
            continue
        n = normalize_neighborhood(t)
        if n:
            return n[:200]
    return None


_CONJUNTO_STRIP_RE = re.compile(
    r"(?i)^\s*(?:conjunto(?:\s+cerrado)?|condominio|cond\.?|urbanizaci[oó]n|unidad\s+residencial)\s*[:\s,\-]*",
)
# Capture a short name after common labels (Colombian listings).
# Conservative: name must start with a letter (not digit), limited run before comma/newline.
_CONJUNTO_TEXT_RES: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"(?i)\bcondominio\s+(?:[:\-]\s*)?([A-Za-záéíóúñüÁÉÍÓÚÑÜ][A-Za-z0-9áéíóúñüÁÉÍÓÚÑÜ\s\-\.']{1,48})(?=[\s,.\n]|$)",
    ),
    re.compile(
        r"(?i)\bconjunto\s+cerrado\s+(?:[:\-]\s*)?([A-Za-záéíóúñüÁÉÍÓÚÑÜ][A-Za-z0-9áéíóúñüÁÉÍÓÚÑÜ\s\-\.']{1,48})(?=[\s,.\n]|$)",
    ),
    re.compile(
        r"(?i)\bconjunto\s+(?:[:\-]\s*)?([A-Za-záéíóúñüÁÉÍÓÚÑÜ][A-Za-z0-9áéíóúñüÁÉÍÓÚÑÜ\s\-\.']{1,48})(?=[\s,.\n]|$)",
    ),
    re.compile(
        r"(?i)\burbanizaci[oó]n\s+(?:[:\-]\s*)?([A-Za-záéíóúñüÁÉÍÓÚÑÜ][A-Za-z0-9áéíóúñüÁÉÍÓÚÑÜ\s\-\.']{1,48})(?=[\s,.\n]|$)",
    ),
    re.compile(
        r"(?i)\bunidad\s+residencial\s+(?:[:\-]\s*)?([A-Za-záéíóúñüÁÉÍÓÚÑÜ][A-Za-z0-9áéíóúñüÁÉÍÓÚÑÜ\s\-\.']{1,48})(?=[\s,.\n]|$)",
    ),
)

_CONJUNTO_LEADING_STOPWORDS = {
    "en",
    "el",
    "la",
    "los",
    "las",
    "de",
    "del",
    "al",
    "a",
    "y",
    "o",
    "un",
    "una",
    "con",
    "por",
    "que",
    "su",
    "sus",
    "mi",
    "tu",
    "gracias",
    "este",
    "esta",
    "estos",
    "estas",
}


def is_valid_conjunto_name(value: str | None, *, from_structured: bool = False) -> bool:
    if not value:
        return False
    s = " ".join(value.strip().split())
    if len(s) < 2 or len(s) > 120:
        return False
    low = s.casefold()
    if low in {"unknown", "desconocido", "n/a", "na", "-", "--", "none", "null", "si", "no"}:
        return False
    if not re.search(r"[a-zA-Z\u00C0-\u024F]", s):
        return False
    if len(s.split()) > 12:
        return False
    if re.search(
        r"(?i)\b(se vende|venta|arriendo|oportunidad|inversi[oó]n|hermos[ao]|espectacular|minutos|peaje|ascensor|ascensores)\b",
        s,
    ):
        return False
    parts = s.split()
    while parts and parts[0].casefold() in _CONJUNTO_LEADING_STOPWORDS:
        parts.pop(0)
    s2 = " ".join(parts)
    min_total = 2 if from_structured else 6
    min_first = 2 if from_structured else 4
    if len(s2) < min_total:
        return False
    first_tok = parts[0] if parts else ""
    if len(first_tok) < min_first:
        return False
    if not from_structured:
        garbage = {"cerra", "casa", "lote", "apto", "piso", "nivel", "bloque", "torre"}
        if s2.casefold() in garbage or first_tok.casefold() in garbage:
            return False
    return True


def normalize_conjunto(value: str | None) -> str | None:
    if not value:
        return None
    s = " ".join(value.strip().split())
    prev = ""
    while s != prev:
        prev = s
        s = _CONJUNTO_STRIP_RE.sub("", s).strip()
    parts = s.split()
    while parts and parts[0].casefold() in _CONJUNTO_LEADING_STOPWORDS:
        parts.pop(0)
    s = " ".join(parts)
    return s[:120] if s else None


def extract_conjunto_structured(item: dict[str, Any]) -> str | None:
    for key in ("condominium", "condo", "urbanization"):
        if key not in item:
            continue
        name = normalize_named_field(item.get(key))
        if name and is_valid_conjunto_name(name, from_structured=True):
            return normalize_conjunto(name)
    project = item.get("project")
    if isinstance(project, (dict, str)):
        name = normalize_named_field(project)
        if name and is_valid_conjunto_name(name, from_structured=True):
            return normalize_conjunto(name)
    return None


def conjunto_from_address(address: Any) -> str | None:
    if not isinstance(address, str):
        return None
    for part in address.split(","):
        p = part.strip()
        if not p or not re.search(
            r"(?i)condominio|conjunto|urbanizaci|unidad\s+residencial", p
        ):
            continue
        stripped = _CONJUNTO_STRIP_RE.sub("", p).strip()
        if stripped and is_valid_conjunto_name(stripped):
            return normalize_conjunto(stripped)
        for pat in _CONJUNTO_TEXT_RES:
            m = pat.search(p)
            if m:
                cand = normalize_conjunto(m.group(1).strip())
                if cand and is_valid_conjunto_name(cand):
                    return cand
    return None


def conjunto_from_text_blob(blob: str) -> str | None:
    if not blob:
        return None
    for pat in _CONJUNTO_TEXT_RES:
        m = pat.search(blob.replace("\u00a0", " "))
        if m:
            cand = normalize_conjunto(m.group(1).strip())
            if cand and is_valid_conjunto_name(cand):
                return cand
    return None


def extract_conjunto(item: dict[str, Any], title: str, blob: str) -> str | None:
    structured = extract_conjunto_structured(item)
    if structured:
        return structured
    addr = conjunto_from_address(item.get("address"))
    if addr:
        return addr
    return conjunto_from_text_blob(f"{title}\n{blob}")


def score_completeness(flags: dict[str, bool]) -> float:
    if not flags:
        return 1.0
    missing = sum(1 for v in flags.values() if v)
    return round(max(0.0, 1.0 - (missing / len(flags))), 4)


def build_fingerprint(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def titleize_slug(value: str) -> str:
    return " ".join(part.capitalize() for part in value.replace("-", " ").split())


def first_slug(value: Any) -> str | None:
    if isinstance(value, str):
        s = value.strip()
        return s[:120] if s else None
    if isinstance(value, list) and value:
        first = value[0]
        if isinstance(first, str):
            s = first.strip()
            return s[:120] if s else None
    return None


def infer_city_department(
    item: dict[str, Any],
) -> tuple[str, str, str | None, str | None, str | None]:
    city = CITY_DEFAULT
    department = DEPARTMENT_DEFAULT
    city_id: str | None = None
    city_slug: str | None = None
    department_slug: str | None = None

    city_nodes = item.get("city")
    if isinstance(city_nodes, list) and city_nodes and isinstance(city_nodes[0], dict):
        c = city_nodes[0]
        c_name = normalize_named_field(c.get("name"))
        if c_name:
            city = c_name
        cid = c.get("id")
        if isinstance(cid, str) and cid.strip():
            city_id = cid.strip()[:120]
        cslug = first_slug(c.get("slug"))
        if cslug:
            city_slug = cslug

    for dep_key in ("state", "department"):
        dep_nodes = item.get(dep_key)
        if isinstance(dep_nodes, list) and dep_nodes and isinstance(dep_nodes[0], dict):
            d = dep_nodes[0]
            d_name = normalize_named_field(d.get("name"))
            if d_name:
                department = d_name
            dslug = first_slug(d.get("slug"))
            if dslug:
                department_slug = dslug
            break

    if city != CITY_DEFAULT or department != DEPARTMENT_DEFAULT:
        return city[:100], department[:100], city_id, city_slug, department_slug

    path = urllib.parse.urlparse(LISTING_URL.strip()).path.strip("/").split("/")
    city_seg: str | None = None
    dept_seg: str | None = None
    for i, seg in enumerate(path):
        if seg.lower() in ("venta", "arriendo"):
            rest = path[i + 1 :]
            while rest and re.match(r"^pagina\d+$", rest[-1], flags=re.IGNORECASE):
                rest = rest[:-1]
            if len(rest) >= 3:
                city_seg, dept_seg = rest[-2], rest[-1]
            elif len(rest) >= 2:
                city_seg, dept_seg = rest[0], rest[1]
            break
    if city_seg and dept_seg:
        city = titleize_slug(city_seg)
        department = titleize_slug(dept_seg)
        if not city_slug:
            city_slug = f"city-colombia-{city_seg.lower()}"
        if not department_slug:
            department_slug = f"state-colombia-{dept_seg.lower()}"

    return city[:100], department[:100], city_id, city_slug, department_slug


def parse_estrato_value(v: Any, fallback_text: str) -> int | None:
    if isinstance(v, int):
        return v if 1 <= v <= 6 else None
    if isinstance(v, float):
        n = int(v)
        return n if 1 <= n <= 6 else None
    if isinstance(v, str):
        m = re.search(r"(\d)", v)
        if m:
            n = int(m.group(1))
            return n if 1 <= n <= 6 else None
    if isinstance(v, dict):
        for key in ("name", "label", "value", "text"):
            n = parse_estrato_value(v.get(key), fallback_text)
            if n is not None:
                return n
    return parse_estrato(fallback_text)


def listing_to_row(item: dict[str, Any]) -> dict[str, Any] | None:
    listing_id = item.get("id") or item.get("idFincaLegacy")
    if listing_id is None:
        return None
    ext_id = str(listing_id)

    title = str(item.get("title") or "").strip() or ext_id
    description = str(item.get("description") or "")
    blob = f"{title}\n{description}"

    price_obj = item.get("price")
    price: int | None = None
    if isinstance(price_obj, dict):
        amount = price_obj.get("amount")
        if isinstance(amount, (int, float)):
            price = int(amount)
        elif isinstance(amount, str):
            p = clean_price_cop(amount)
            price = p if p is not None else None
    elif isinstance(price_obj, (int, float)):
        price = int(price_obj)
    elif isinstance(price_obj, str):
        price = clean_price_cop(price_obj)

    if price is None:
        price = clean_price_cop(blob)
    if price is None:
        return None

    property_type = normalize_named_field(item.get("property_type"))
    areas = resolve_listing_areas(item, property_type=property_type, blob=blob)
    area = areas["area_m2"]
    area_built = areas["area_built_m2"]
    area_private = areas["area_private_m2"]
    area_terrain = areas["area_terrain_m2"]
    area_terrace = areas["area_terrace_m2"]
    area_mismatch_flag = areas["area_mismatch_flag"]
    terrace_heavy_flag = areas["terrace_heavy_flag"]
    construction_state = areas["construction_state"]

    facilities = extract_facilities(item)
    if facilities_has_terrace(facilities):
        terrace_heavy_flag = True

    if area is None or area <= 0:
        return None

    tech_fields = parse_technical_sheet_fields(item)
    accepts_barter = parse_barter_flag(item, tech_fields)
    owner_fields = extract_owner_fields(item)
    location_enrichment = extract_location_enrichment(item)
    location_main = extract_location_main_meta(item)

    nb_structured, nb_structured_id, nb_structured_slug = extract_neighborhood_structured(item)
    if not is_valid_neighborhood_candidate(nb_structured):
        nb_structured = None

    neighborhood_source_id = (
        location_enrichment.get("neighborhood_source_id")
        or nb_structured_id
    )

    zone_names = [
        z for z in extract_zone_names(item) if is_valid_neighborhood_candidate(z)
    ]

    nb_from_locations = extract_neighborhood_from_locations(item)
    if not is_valid_neighborhood_candidate(nb_from_locations):
        nb_from_locations = None

    source_location_name = (
        location_main.get("location_main_name")
        or nb_structured
        or nb_from_locations
    )

    nb_text = neighborhood_from_title(title) or neighborhood_from_title(blob)
    if not is_valid_neighborhood_candidate(nb_text):
        nb_text = None

    nb_addr = neighborhood_from_address(item.get("address"))
    zone0 = zone_names[0] if zone_names else None
    city, department, city_id, city_slug, department_slug = infer_city_department(item)
    cat_key = catalog_key_for_city(city, city_slug)
    nb_candidates = [
        nb_structured,
        nb_from_locations,
        nb_text,
        nb_addr,
        zone0,
    ]
    nb_cleaned = [
        c for c in (normalize_neighborhood(x) for x in nb_candidates) if c
    ]
    nb_raw = first_raw_neighborhood_label(nb_candidates)
    peer_counts = getattr(listing_to_row, "_peer_counts", None)
    nb_resolution = resolve_neighborhood(
        candidates=nb_candidates,
        city=city,
        city_slug=city_slug,
        neighborhood_source_id=neighborhood_source_id,
        source_location_name=source_location_name,
        location_type=location_main.get("location_type"),
        location_slug=location_main.get("location_slug") or nb_structured_slug,
        zone_name=location_enrichment.get("zone_name"),
        peer_counts=peer_counts,
    )
    nb = nb_resolution.neighborhood
    conjunto = extract_conjunto(item, title, blob)

    estrato = parse_estrato_value(item.get("stratum"), blob)
    operation_type = normalize_named_field(item.get("operation_type"))
    admin_fee_cop = extract_admin_fee(item, blob)
    price_currency = item.get("price")
    currency_symbol: str | None = None
    if isinstance(price_currency, dict):
        currency = price_currency.get("currency")
        if isinstance(currency, dict):
            s = currency.get("name")
            if isinstance(s, str) and s.strip():
                currency_symbol = s.strip()[:10]

    latitude = item.get("latitude")
    longitude = item.get("longitude")
    lat = float(latitude) if isinstance(latitude, (int, float)) else None
    lon = float(longitude) if isinstance(longitude, (int, float)) else None

    locations = item.get("locations")
    location_path: list[str] | None = None
    if isinstance(locations, list):
        names: list[str] = []
        for loc in locations:
            label = normalize_named_field(loc)
            if label:
                names.append(label)
        if names:
            location_path = names[:8]
    elif isinstance(locations, dict):
        names = []
        lm = locations.get("location_main")
        if isinstance(lm, dict):
            label = normalize_named_field(lm.get("name"))
            if label:
                names.append(label)
        for key in ("city", "state", "country"):
            nodes = locations.get(key)
            if isinstance(nodes, list):
                for node in nodes:
                    if isinstance(node, dict):
                        label = normalize_named_field(node.get("name"))
                        if label:
                            names.append(label)
        if names:
            location_path = names[:8]

    if nb_raw is None:
        nb_raw = neighborhood_fallback_raw_from_location_path(
            location_path, city, department
        )

    source_created_at = parse_datetime(item.get("created_at"))
    source_updated_at = parse_datetime(item.get("updated_at"))

    link = str(item.get("link") or "").strip()
    if link.startswith("/"):
        url = f"https://www.fincaraiz.com.co{link}"
    else:
        url = link or f"{LISTING_URL.rstrip('/')}/{ext_id}"

    img = item.get("img")
    image_url = str(img).strip() if isinstance(img, str) and img else None

    bedrooms = parse_optional_int(item.get("bedrooms"))
    bathrooms = parse_optional_int(item.get("bathrooms"))
    rooms = parse_optional_int(item.get("rooms"))
    garage = parse_optional_int(item.get("garage"))
    floor = parse_optional_int(item.get("floor"))
    antiquity = parse_optional_int(item.get("antiquity"))
    image_count = parse_optional_int(item.get("image_count"))

    price_admin_included: int | None = None
    if isinstance(price_obj, dict):
        admin_inc = price_obj.get("admin_included")
        if isinstance(admin_inc, (int, float)):
            price_admin_included = int(admin_inc)

    highlight = parse_optional_int(item.get("highlight"))
    relevance_raw = item.get("relevance")
    relevance = float(relevance_raw) if isinstance(relevance_raw, (int, float)) else None
    paid_quota = bool(item.get("paid_quota")) if item.get("paid_quota") is not None else None
    is_project = bool(item.get("isProject"))

    description_stored = description.strip()[:8000] if description.strip() else None

    bool_flags = {
        "missing_estrato": estrato is None,
        "missing_neighborhood_label": not bool(nb_raw),
        "neighborhood_not_in_catalog": bool(
            cat_key
            and nb_cleaned
            and nb_resolution.confidence in {"weak", "missing"}
        ),
        "missing_geo": lat is None or lon is None,
        "missing_admin_fee": admin_fee_cop is None,
        "missing_source_updated_at": source_updated_at is None,
        "missing_area_terrain": area_terrain is None,
        "missing_bedrooms": bedrooms is None,
        "missing_bathrooms": bathrooms is None,
        "missing_rooms": rooms is None,
        "missing_conjunto": not bool(conjunto),
        "area_mismatch": area_mismatch_flag,
        "terrace_heavy": terrace_heavy_flag,
        "accepts_barter": accepts_barter,
        "missing_area_private": is_apartment_property(property_type, item)
        and area_private is None,
    }
    quality_flags = merge_quality_flags(bool_flags, nb_resolution)
    data_completeness_score = score_completeness(bool_flags)

    source_fingerprint = build_fingerprint(
        {
            "id": ext_id,
            "title": title,
            "price": price,
            "area_m2": area,
            "estrato": estrato,
            "property_type": property_type,
            "operation_type": operation_type,
            "area_built_m2": area_built,
            "area_terrain_m2": area_terrain,
            "area_private_m2": area_private,
            "area_terrace_m2": area_terrace,
            "accepts_barter": accepts_barter,
            "construction_state": construction_state,
            "latitude": lat,
            "longitude": lon,
            "city": city,
            "department": department,
            "city_id": city_id,
            "city_slug": city_slug,
            "department_slug": department_slug,
            "neighborhood": nb,
            "source_updated_at": source_updated_at.isoformat()
            if source_updated_at
            else None,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "rooms": rooms,
            "conjunto": conjunto,
            "area_private_m2": area_private,
            "area_terrace_m2": area_terrace,
            "accepts_barter": accepts_barter,
            "description_len": len(description_stored or ""),
        }
    )

    return {
        "external_id": ext_id,
        "title": title,
        "price_cop": price,
        "area_m2": area,
        "estrato": estrato,
        "neighborhood": nb,
        "neighborhood_raw": nb_raw,
        "conjunto": conjunto,
        "city": city,
        "city_id": city_id,
        "city_slug": city_slug,
        "department": department,
        "department_slug": department_slug,
        "url": url,
        "image_url": image_url,
        "property_type": property_type,
        "operation_type": operation_type,
        "area_built_m2": area_built,
        "area_terrain_m2": area_terrain,
        "area_terrace_m2": area_terrace,
        "area_private_m2": area_private,
        "description": description_stored,
        "garage": garage,
        "floor": floor,
        "antiquity": antiquity,
        "accepts_barter": accepts_barter,
        "construction_state": construction_state,
        "facilities": facilities,
        "image_count": image_count,
        "price_admin_included": price_admin_included,
        "highlight": highlight,
        "relevance": relevance,
        "paid_quota": paid_quota,
        "is_project": is_project,
        "area_mismatch_flag": area_mismatch_flag,
        "terrace_heavy_flag": terrace_heavy_flag,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "rooms": rooms,
        "admin_fee_cop": admin_fee_cop,
        "currency_symbol": currency_symbol,
        "latitude": lat,
        "longitude": lon,
        "location_path": location_path,
        "neighborhood_source_id": neighborhood_source_id,
        "zone_name": location_enrichment["zone_name"],
        "commune_name": location_enrichment["commune_name"],
        "source_created_at": source_created_at,
        "source_updated_at": source_updated_at,
        "quality_flags": quality_flags,
        "data_completeness_score": data_completeness_score,
        "source_fingerprint": source_fingerprint,
        **owner_fields,
    }


def run() -> None:
    if not robots_allows_listing(LISTING_URL):
        print("Aborting: robots.txt rules block this URL pattern.", file=sys.stderr)
        sys.exit(1)

    cap = MAX_LISTINGS_PER_RUN
    collected: dict[str, dict[str, Any]] = {}
    skipped_unchanged = 0
    skipped_ids: set[str] = set()

    maybe_random_pre_navigation_delay()
    page_num = START_PAGE
    no_action_pages = 0
    conn = connect()
    load_all_catalogs()
    listing_to_row._peer_counts = fetch_peer_counts(conn, CITY_DEFAULT)
    while cap <= 0 or len(collected) < cap:
        url = paginated_url(LISTING_URL, page_num)
        try:
            html = fetch_html(url)
            next_data = extract_next_data(html)
            page_items = extract_listings(next_data)
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            http.client.IncompleteRead,
            TimeoutError,
            ValueError,
            json.JSONDecodeError,
        ) as e:
            print(f"Page {page_num}: failed to fetch/parse ({e}).")
            break

        page_rows: list[dict[str, Any]] = []
        for item in page_items:
            row = listing_to_row(item)
            if row is None:
                continue
            page_rows.append(row)

        existing_meta = get_existing_listing_meta(
            conn, [str(r["external_id"]) for r in page_rows]
        )

        added = 0
        page_skipped_unchanged = 0
        for row in page_rows:
            key = str(row["external_id"])
            if key in collected:
                continue
            prev = existing_meta.get(key)
            prev_fp = prev[0] if prev else None
            prev_neighborhood = prev[1] if prev else None
            prev_conjunto = prev[2] if prev else None
            prev_cj_set = bool(
                prev_conjunto and str(prev_conjunto).strip()
            )
            row_cj = row.get("conjunto")
            row_cj_empty = not (row_cj and str(row_cj).strip())
            # Skip unchanged fingerprint when neighborhood is filled and we are not
            # waiting to backfill conjunto (DB empty but scrape still has nothing).
            if (
                prev_fp is not None
                and prev_fp == row.get("source_fingerprint")
                and prev_neighborhood is not None
                and (prev_cj_set or row_cj_empty)
            ):
                page_skipped_unchanged += 1
                skipped_unchanged += 1
                skipped_ids.add(key)
                continue
            collected[key] = row
            added += 1
            if cap > 0 and len(collected) >= cap:
                break

        print(
            f"Page {page_num}: +{added} actionable rows, "
            f"{page_skipped_unchanged} unchanged skipped (total actionable {len(collected)})."
        )
        if added == 0:
            no_action_pages += 1
        else:
            no_action_pages = 0
        if no_action_pages >= MAX_NO_ACTION_PAGES:
            print(
                f"Stopping pagination after {MAX_NO_ACTION_PAGES} pages with no actionable rows."
            )
            break

        page_num += 1
        pause_action()
        pause_short()

    rows = list(collected.values())
    if cap > 0 and len(rows) > cap:
        rows = rows[:cap]
    suffix = f" (cap {cap})" if cap > 0 else ""
    print(
        f"Prepared {len(rows)} actionable rows from listing-page __NEXT_DATA__ JSON{suffix}. "
        f"Skipped unchanged: {skipped_unchanged}."
    )

    try:
        stats = upsert_listings(conn, rows)
        print(
            "Upserted {written} rows. New: {new}, changed: {changed}, unchanged: {unchanged}.".format(
                **stats
            )
        )
        if skipped_ids:
            touched = touch_listings_last_seen(conn, list(skipped_ids))
            print(f"Touched last_seen for {touched} unchanged listings still on market.")
        if SKIP_DEAL_REFRESH:
            print("Skipped deal refresh (SKIP_DEAL_REFRESH=1).")
        else:
            refresh_deals_after_scrape(conn, city=CITY_DEFAULT)
            print(f"Recomputed is_deal for {CITY_DEFAULT} from neighborhood (or city) averages.")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
