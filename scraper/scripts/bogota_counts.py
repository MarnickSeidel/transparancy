from __future__ import annotations

import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

def main() -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COALESCE(property_type, '(null)'), COUNT(*)
        FROM listings
        WHERE city ILIKE 'Bogota' OR city ILIKE 'Bogot%%'
        GROUP BY 1
        ORDER BY 2 DESC
        """
    )
    print("Bogota by property_type:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")
    cur.execute(
        """
        SELECT COUNT(*) FROM listings
        WHERE city ILIKE 'Bogota' OR city ILIKE 'Bogot%%'
        """
    )
    print("Total:", cur.fetchone()[0])
    conn.close()

if __name__ == "__main__":
    main()
