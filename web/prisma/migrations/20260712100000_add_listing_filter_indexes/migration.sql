-- Composite and partial indexes for common listing filters and trend queries.

CREATE INDEX IF NOT EXISTS "listings_is_active_city_idx"
  ON "listings" ("is_active", "city");

CREATE INDEX IF NOT EXISTS "listings_is_active_city_neighborhood_idx"
  ON "listings" ("is_active", "city", "neighborhood");

CREATE INDEX IF NOT EXISTS "listings_price_per_m2_not_null_idx"
  ON "listings" ("price_per_m2")
  WHERE "price_per_m2" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "listings_date_scraped_city_idx"
  ON "listings" ("date_scraped", "city");
