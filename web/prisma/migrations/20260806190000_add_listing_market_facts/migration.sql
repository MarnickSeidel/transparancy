-- Thin archive for aged inactive listings: keep market-stat columns only.
CREATE TABLE IF NOT EXISTS listing_market_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  neighborhood TEXT,
  estrato INT,
  property_type TEXT,
  operation_type TEXT,
  price_cop BIGINT NOT NULL,
  area_m2 DOUBLE PRECISION NOT NULL,
  price_per_m2 DOUBLE PRECISION NOT NULL,
  source_created_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_market_facts_city_last_seen_at_idx
  ON listing_market_facts (city, last_seen_at);

CREATE INDEX IF NOT EXISTS listing_market_facts_city_neighborhood_idx
  ON listing_market_facts (city, neighborhood);

CREATE INDEX IF NOT EXISTS listing_market_facts_last_seen_at_idx
  ON listing_market_facts (last_seen_at);

ALTER TABLE "public"."listing_market_facts" ENABLE ROW LEVEL SECURITY;
