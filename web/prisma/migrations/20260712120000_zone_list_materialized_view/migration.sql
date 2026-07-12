-- Materialized view for zone list aggregates (W-P1).
-- Refresh after bulk listing updates:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY zone_list_aggregates;
--
-- Performance notes (W-P3):
-- - /api/zones and /api/zones/[city]/[zone] benefit from listings_is_active_city_idx
-- - /api/listings sort uses deal_score index below
-- - /api/filters uses groupBy on indexed columns (city, neighborhood)

CREATE MATERIALIZED VIEW IF NOT EXISTS zone_list_aggregates AS
WITH tagged AS (
  SELECT
    COALESCE(
      NULLIF(btrim(l.quality_flags->>'dossier_key'), ''),
      CASE
        WHEN l.neighborhood IS NOT NULL AND btrim(l.neighborhood) <> '' THEN
          lower(
            regexp_replace(
              regexp_replace(btrim(COALESCE(l.city_slug, l.city)), '^city-colombia-', ''),
              '[_\s]+',
              '-',
              'g'
            )
          )
          || ':'
          || regexp_replace(
            regexp_replace(
              lower(
                translate(
                  btrim(l.neighborhood),
                  'ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòù',
                  'AEIOUUNaeiouunAEIOUaeiou'
                )
              ),
              '\y(calle|carrera|cra|cr|cll|cl|apto|apt|apartamento)\y',
              ' ',
              'gi'
            ),
            '[^a-z0-9]+',
            '',
            'g'
          )
      END
    ) AS bucket_key,
    l.city,
    l.neighborhood,
    COALESCE(
      NULLIF(l.price_per_m2, 0),
      NULLIF(l.price_per_m2_private, 0),
      CASE
        WHEN l.price_cop IS NOT NULL AND l.price_cop > 0
          AND l.area_m2 IS NOT NULL AND l.area_m2 > 0
        THEN l.price_cop::float8 / l.area_m2
      END
    ) AS ppm2,
    COALESCE(l.quality_flags->>'neighborhood_confidence', 'missing') AS confidence
  FROM listings l
  WHERE l.is_active = true
),
filtered AS (
  SELECT * FROM tagged WHERE bucket_key IS NOT NULL
)
SELECT
  bucket_key,
  MAX(city) AS city,
  MODE() WITHIN GROUP (ORDER BY neighborhood) AS display_name,
  COUNT(*)::bigint AS listing_count,
  COUNT(*) FILTER (WHERE ppm2 IS NOT NULL)::bigint AS data_point_count,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY ppm2)
    FILTER (WHERE ppm2 IS NOT NULL)::float8 AS median_ppm2,
  COUNT(*) FILTER (WHERE confidence = 'catalog')::bigint AS catalog_count,
  COUNT(*) FILTER (WHERE confidence = 'source_id')::bigint AS source_id_count,
  COUNT(*) FILTER (WHERE confidence = 'provisional')::bigint AS provisional_count,
  COUNT(*) FILTER (WHERE confidence = 'weak')::bigint AS weak_count,
  COUNT(*) FILTER (WHERE confidence = 'missing')::bigint AS missing_count
FROM filtered
GROUP BY bucket_key;

CREATE UNIQUE INDEX IF NOT EXISTS zone_list_aggregates_bucket_key_idx
  ON zone_list_aggregates (bucket_key);

CREATE INDEX IF NOT EXISTS zone_list_aggregates_city_data_points_idx
  ON zone_list_aggregates (city, data_point_count DESC);

CREATE INDEX IF NOT EXISTS listings_deal_score_not_null_idx
  ON listings (deal_score DESC NULLS LAST)
  WHERE deal_score IS NOT NULL AND is_active = true;
