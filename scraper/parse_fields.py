"""Extract price, area, neighborhood, estrato from listing card or title text."""

from __future__ import annotations

import re
from typing import Optional

PRICE_RE = re.compile(r"\$\s*([\d.,]+)")
# m², m2, or Unicode ㎡ (some cards use the single-character square meter)
AREA_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(?:m²|m2|㎡)", re.IGNORECASE
)
ESTRATO_RE = re.compile(r"estrato\s*[:\s]*(\d{1,2})", re.IGNORECASE)
# "Apartamento en Venta en El Poblado, Medellín" / "… en arriendo en Belén, Pereira"
TITLE_NB_RES: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*pereira"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*medell[ií]n"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*bogot[aá]"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*cali"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*envigado"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*itag[uú]i"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*manizales"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*bucaramanga"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*cartagena"),
    re.compile(r"(?i)en (?:venta|arriendo) en\s+([^,]+),\s*barranquilla"),
)


def clean_price_cop(text: str) -> Optional[int]:
    """Colombian format uses '.' as thousands separator."""
    if not text:
        return None
    candidates: list[int] = []
    for m in PRICE_RE.finditer(text.replace("\u00a0", " ")):
        raw = m.group(1).strip()
        if "," in raw and "." in raw:
            parts = raw.rsplit(",", 1)
            if len(parts) == 2 and len(parts[1]) <= 2:
                whole = parts[0].replace(".", "")
                frac = parts[1]
                try:
                    candidates.append(int(float(f"{whole}.{frac}")))
                except ValueError:
                    continue
                continue
        cleaned = raw.replace(".", "").replace(",", "")
        if cleaned.isdigit():
            candidates.append(int(cleaned))
    if not candidates:
        return None
    # Prefer the main listing price; small numbers are often admin / secondary fees.
    big = [c for c in candidates if c >= 50_000_000]
    if big:
        return max(big)
    mid = [c for c in candidates if c >= 5_000_000]
    if mid:
        return max(mid)
    return max(candidates)


def clean_area_m2(text: str) -> Optional[float]:
    if not text:
        return None
    m = AREA_RE.search(text.replace("\u00a0", " "))
    if not m:
        return None
    raw = m.group(1).replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def parse_estrato(text: str) -> Optional[int]:
    m = ESTRATO_RE.search(text)
    if not m:
        return None
    try:
        e = int(m.group(1))
        return e if 1 <= e <= 6 else None
    except ValueError:
        return None


def neighborhood_from_title(title: str) -> Optional[str]:
    if not title:
        return None
    t = title.replace("\u00a0", " ")
    for pat in TITLE_NB_RES:
        m = pat.search(t)
        if m:
            return normalize_neighborhood(m.group(1))
    return None


def normalize_neighborhood(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    s = " ".join(name.strip().split())
    if not s:
        return None
    return s[:200]


def title_from_block(text: str) -> str:
    """First line that looks like a headline."""
    for line in text.splitlines():
        line = line.strip()
        if len(line) > 15 and not line.startswith("$"):
            return line[:500]
    return text[:500] if text else ""
