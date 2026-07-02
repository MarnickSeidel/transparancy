"""Manizales listing counts vs Finca total and field fill rates."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

def finca_total() -> int | None:
    try:
        from scrape import extract_next_data, fetch_html

        url = "https://www.fincaraiz.com.co/venta/apartamentos/manizales/caldas"
        nd = extract_next_data(fetch_html(url))
        pi = (
            nd.get("props", {})
            .get("pageProps", {})
            .get("fetchResult", {})
            .get("searchFast", {})
            .get("paginatorInfo", {})
        )
        t = pi.get("total")
        return int(t) if t is not None else None
    except Exception as e:
        print("(Could not fetch live Finca total:", e, ")", file=sys.stderr)
        return None


def main() -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    base = "FROM listings WHERE city = 'Manizales' AND department = 'Caldas'"
    cur.execute(f"SELECT COUNT(*) {base}")
    n = cur.fetchone()[0]
    finca = finca_total()
    print(f"Rows (Manizales, Caldas): {n}")
    print(
        "Finca index total (venta/apartamentos/manizales/caldas):",
        finca if finca is not None else "unknown",
    )
    if finca:
        print(f"Approx. index coverage vs Finca total: {100.0 * n / finca:.1f}%")
    checks = [
        ("neighborhood", "neighborhood IS NOT NULL AND btrim(neighborhood) <> ''"),
        ("neighborhood_raw", "neighborhood_raw IS NOT NULL AND btrim(neighborhood_raw) <> ''"),
        ("estrato", "estrato IS NOT NULL"),
        ("lat+lon", "latitude IS NOT NULL AND longitude IS NOT NULL"),
        ("bedrooms", "bedrooms IS NOT NULL"),
        ("bathrooms", "bathrooms IS NOT NULL"),
        ("image_url", "image_url IS NOT NULL AND btrim(image_url) <> ''"),
        ("conjunto", "conjunto IS NOT NULL AND btrim(conjunto) <> ''"),
        ("data_completeness_score", "data_completeness_score IS NOT NULL"),
    ]
    for label, cond in checks:
        cur.execute(f"SELECT COUNT(*) {base} AND {cond}")
        c = cur.fetchone()[0]
        pct = 100.0 * c / n if n else 0
        print(f"  {label}: {c} ({pct:.1f}%)")
    cur.execute(
        f"SELECT AVG(data_completeness_score) {base} AND data_completeness_score IS NOT NULL"
    )
    row = cur.fetchone()[0]
    print(
        "Avg data_completeness_score (non-null):",
        round(float(row), 3) if row is not None else None,
    )
    conn.close()


if __name__ == "__main__":
    main()
