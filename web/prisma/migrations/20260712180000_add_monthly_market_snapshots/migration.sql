CREATE TABLE IF NOT EXISTS monthly_market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  city TEXT NOT NULL,
  sample INT NOT NULL,
  median_ppm2 DOUBLE PRECISION,
  p25_ppm2 DOUBLE PRECISION,
  p75_ppm2 DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (month, city)
);

CREATE INDEX IF NOT EXISTS monthly_market_snapshots_city_month_idx
  ON monthly_market_snapshots (city, month DESC);

-- Backfill city-level snapshots from listing market-start dates.
INSERT INTO monthly_market_snapshots (month, city, sample, median_ppm2, p25_ppm2, p75_ppm2)
SELECT
  date_trunc('month', COALESCE(l.source_created_at, l.first_seen_at, l.date_scraped))::date AS month,
  l.city,
  COUNT(*)::int,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY l.price_per_m2)::float8,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY l.price_per_m2)::float8
FROM listings l
WHERE l.price_per_m2 IS NOT NULL
  AND l.area_m2 >= 5
  AND COALESCE(l.source_created_at, l.first_seen_at, l.date_scraped)
      >= date_trunc('month', NOW()) - interval '23 months'
GROUP BY 1, 2
ON CONFLICT (month, city) DO NOTHING;
