import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

# MVP: single city (Pereira search on Finca Raiz).
LISTING_URL = os.environ.get(
    "LISTING_URL",
    "https://www.fincaraiz.com.co/venta/pereira/risaralda",
)
CITY_DEFAULT = os.environ.get("CITY_DEFAULT", "Pereira").strip() or "Pereira"
DEPARTMENT_DEFAULT = (
    os.environ.get("DEPARTMENT_DEFAULT", "Risaralda").strip() or "Risaralda"
)

# Stop after this many unique listing cards (0 = no limit). Default 100 for MVP.
MAX_LISTINGS_PER_RUN = int(os.environ.get("MAX_LISTINGS_PER_RUN", "100"))
# Continue pagination from this page number (default 1).
START_PAGE = max(1, int(os.environ.get("START_PAGE", "1")))
# Stop after this many consecutive listing pages with zero new actionable rows.
MAX_NO_ACTION_PAGES = max(1, int(os.environ.get("MAX_NO_ACTION_PAGES", "8")))

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise SystemExit(
        "DATABASE_URL is not set. Copy scraper/.env.example to scraper/.env and adjust."
    )

DEAL_THRESHOLD_PCT = float(os.environ.get("DEAL_THRESHOLD_PCT", "15"))

# Skip full deal recompute after each scrape (useful on Supabase free tier / automations).
SKIP_DEAL_REFRESH = os.environ.get("SKIP_DEAL_REFRESH", "").strip().lower() in (
    "1",
    "true",
    "yes",
)

MIN_DELAY_SEC = float(os.environ.get("MIN_DELAY_SEC", "2.5"))
MAX_DELAY_SEC = float(os.environ.get("MAX_DELAY_SEC", "8.0"))

# Scroll / pagination safety limits (avoid unbounded runs)
MAX_SCROLL_ROUNDS = 80
STABLE_ROUNDS_BEFORE_STOP = 4

ROBOTS_URL = "https://www.fincaraiz.com.co/robots.txt"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]
