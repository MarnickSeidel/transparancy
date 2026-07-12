-- Partial index for dashboard monthly-trend queries (active listings with price/area).

CREATE INDEX IF NOT EXISTS "listings_active_trends_idx"
  ON "listings" ("date_scraped", "city")
  WHERE "is_active" = true
    AND "price_per_m2" IS NOT NULL
    AND "area_m2" >= 5;
