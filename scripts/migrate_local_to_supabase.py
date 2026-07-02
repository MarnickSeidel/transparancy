#!/usr/bin/env python3
"""
Copy listings + subscribers from local Docker Postgres to Supabase.

Usage (from project root):
  scraper\\.venv\\Scripts\\python.exe scripts\\migrate_local_to_supabase.py

Env (optional overrides in scraper/.env or shell):
  LOCAL_DATABASE_URL  — default: postgresql://postgres:postgres@localhost:5433/pereira_realestate
  DATABASE_URL        — Supabase target (from scraper/.env)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import Json, execute_values
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "scraper" / ".env")

LOCAL_URL = os.environ.get(
    "LOCAL_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/pereira_realestate",
).strip()
REMOTE_URL = os.environ.get("DATABASE_URL", "").strip()

TABLES = ("listings", "subscribers")


def connect(url: str, label: str):
    try:
        return psycopg2.connect(url)
    except psycopg2.Error as exc:
        print(f"Failed to connect to {label}: {exc}", file=sys.stderr)
        sys.exit(1)


def fetch_columns(cur, table: str) -> list[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,),
    )
    return [row[0] for row in cur.fetchall()]


def copy_table(local_cur, remote_cur, table: str) -> int:
    local_cols = fetch_columns(local_cur, table)
    remote_cols = fetch_columns(remote_cur, table)
    cols = [c for c in local_cols if c in remote_cols]
    if not cols:
        print(f"  skip {table}: no matching columns")
        return 0

    missing = set(local_cols) - set(remote_cols)
    if missing:
        print(f"  note {table}: dropping local-only columns: {sorted(missing)}")

    col_sql = ", ".join(cols)
    local_cur.execute(f"SELECT {col_sql} FROM {table}")
    raw_rows = local_cur.fetchall()
    rows = [
        tuple(Json(v) if isinstance(v, (dict, list)) else v for v in row)
        for row in raw_rows
    ]
    if not rows:
        print(f"  {table}: 0 rows")
        return 0

    remote_cur.execute(f"TRUNCATE TABLE {table} CASCADE")
    insert_sql = f"INSERT INTO {table} ({col_sql}) VALUES %s"
    execute_values(remote_cur, insert_sql, rows, page_size=500)
    return len(rows)


def main() -> int:
    if not REMOTE_URL or "supabase" not in REMOTE_URL:
        print("DATABASE_URL in scraper/.env must point at Supabase.", file=sys.stderr)
        return 1

    print("Source (local):", LOCAL_URL.split("@")[-1])
    print("Target (remote):", REMOTE_URL.split("@")[-1].split("?")[0])
    print()

    local = connect(LOCAL_URL, "local Postgres")
    remote = connect(REMOTE_URL, "Supabase")

    try:
        with local.cursor() as lc, remote.cursor() as rc:
            total = 0
            for table in TABLES:
                print(f"Copying {table}...")
                n = copy_table(lc, rc, table)
                total += n
                print(f"  -> {n:,} rows")
            remote.commit()
        print(f"\nDone. {total:,} rows copied.")
        return 0
    except Exception:
        remote.rollback()
        raise
    finally:
        local.close()
        remote.close()


if __name__ == "__main__":
    raise SystemExit(main())
