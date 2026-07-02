"""Print listing counts for Barranquilla by property_type."""
from __future__ import annotations

import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def main() -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COALESCE(property_type, '(null)'), COUNT(*)
        FROM listings
        WHERE city ILIKE 'Barranquilla'
        GROUP BY 1
        ORDER BY 2 DESC
        """
    )
    rows = cur.fetchall()
    cur.execute(
        "SELECT COUNT(*) FROM listings WHERE city ILIKE 'Barranquilla'"
    )
    total = cur.fetchone()[0]
    conn.close()

    for pt, n in rows:
        print(f"{pt}: {n}")
    print(f"TOTAL: {total}")


if __name__ == "__main__":
    main()
