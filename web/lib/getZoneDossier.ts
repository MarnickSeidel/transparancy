import { Prisma } from "@prisma/client";

import { queryMonthlyTrends } from "@/lib/monthlyTrends";
import { prisma } from "@/lib/prisma";
import {
  bucketKeyFromSlug,
  citySlugFromBucketKey,
  DEFAULT_MIN_ZONE_DATA_POINTS,
  mapRawZoneRow,
  sqlBucketKey,
  sqlEffectivePpm2,
  zoneSlugFromBucketKey,
  type ZoneAlias,
  type ZoneDossier,
  type ZoneMonthlyTrend,
  type ZonePropertyTypeStat,
} from "@/lib/zones";

export async function getZoneDossier(
  citySlug: string,
  zoneSlug: string,
  minDataPoints = DEFAULT_MIN_ZONE_DATA_POINTS,
): Promise<ZoneDossier | null> {
  const bucketKey = bucketKeyFromSlug(citySlug, zoneSlug);

  const summaryRows = await prisma.$queryRaw<
    Array<{
      bucket_key: string;
      city: string;
      display_name: string | null;
      listing_count: bigint;
      data_point_count: bigint;
      median_ppm2: number | null;
      median_price_cop: number | null;
      catalog_count: bigint;
      source_id_count: bigint;
      provisional_count: bigint;
      weak_count: bigint;
      missing_count: bigint;
      centroid_lat: number | null;
      centroid_lng: number | null;
      geo_count: bigint;
    }>
  >(Prisma.sql`
    WITH tagged AS (
      SELECT
        ${sqlBucketKey()} AS bucket_key,
        l.city,
        l.neighborhood,
        l.latitude,
        l.longitude,
        l.price_cop::float8 AS price_cop,
        ${sqlEffectivePpm2()} AS ppm2,
        COALESCE(l.quality_flags->>'neighborhood_confidence', 'missing') AS confidence
      FROM listings l
      WHERE l.is_active = true
    ),
    bucket AS (
      SELECT * FROM tagged WHERE bucket_key = ${bucketKey}
    )
    SELECT
      bucket_key,
      MAX(city) AS city,
      MODE() WITHIN GROUP (ORDER BY neighborhood) AS display_name,
      COUNT(*)::bigint AS listing_count,
      COUNT(*) FILTER (WHERE ppm2 IS NOT NULL)::bigint AS data_point_count,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ppm2)
        FILTER (WHERE ppm2 IS NOT NULL)::float8 AS median_ppm2,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cop)::float8 AS median_price_cop,
      COUNT(*) FILTER (WHERE confidence = 'catalog')::bigint AS catalog_count,
      COUNT(*) FILTER (WHERE confidence = 'source_id')::bigint AS source_id_count,
      COUNT(*) FILTER (WHERE confidence = 'provisional')::bigint AS provisional_count,
      COUNT(*) FILTER (WHERE confidence = 'weak')::bigint AS weak_count,
      COUNT(*) FILTER (WHERE confidence = 'missing')::bigint AS missing_count,
      AVG(latitude) FILTER (WHERE latitude IS NOT NULL)::float8 AS centroid_lat,
      AVG(longitude) FILTER (WHERE longitude IS NOT NULL)::float8 AS centroid_lng,
      COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::bigint AS geo_count
    FROM bucket
    GROUP BY bucket_key
  `);

  const summary = summaryRows[0];
  if (!summary) return null;

  if (citySlugFromBucketKey(summary.bucket_key) !== citySlug) return null;
  if (zoneSlugFromBucketKey(summary.bucket_key) !== zoneSlug) return null;

  const dataPointCount = Number(summary.data_point_count);
  const published = dataPointCount >= minDataPoints;
  const exploreNeighborhood = summary.display_name?.trim() || zoneSlug;

  const [aliasRows, typeRows, trendResult, opportunityRows, freshnessRows] = await Promise.all([
    prisma.$queryRaw<Array<{ label: string; count: bigint }>>(Prisma.sql`
      SELECT
        btrim(l.neighborhood_raw) AS label,
        COUNT(*)::bigint AS count
      FROM listings l
      WHERE l.is_active = true
        AND ${sqlBucketKey()} = ${bucketKey}
        AND l.neighborhood_raw IS NOT NULL
        AND btrim(l.neighborhood_raw) <> ''
      GROUP BY btrim(l.neighborhood_raw)
      ORDER BY COUNT(*) DESC, label ASC
      LIMIT 12
    `),
    prisma.$queryRaw<
      Array<{
        property_type: string;
        count: bigint;
        median_ppm2: number | null;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(NULLIF(btrim(l.property_type), ''), 'Unknown') AS property_type,
        COUNT(*)::bigint AS count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY ${sqlEffectivePpm2()})
          FILTER (WHERE ${sqlEffectivePpm2()} IS NOT NULL)::float8 AS median_ppm2
      FROM listings l
      WHERE l.is_active = true
        AND ${sqlBucketKey()} = ${bucketKey}
      GROUP BY COALESCE(NULLIF(btrim(l.property_type), ''), 'Unknown')
      ORDER BY COUNT(*) DESC, property_type ASC
    `),
    queryMonthlyTrends({
      city: summary.city,
      neighborhood: exploreNeighborhood,
      months: 6,
    }),
    prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n
      FROM listings l
      WHERE l.is_active = true
        AND ${sqlBucketKey()} = ${bucketKey}
        AND l.is_deal = true
        AND l.operation_type ILIKE '%venta%'
    `),
    prisma.$queryRaw<Array<{ last_updated: Date | null }>>(Prisma.sql`
      SELECT MAX(l.date_scraped) AS last_updated
      FROM listings l
      WHERE l.is_active = true
        AND ${sqlBucketKey()} = ${bucketKey}
    `),
  ]);

  const aliases: ZoneAlias[] = aliasRows
    .map((row) => ({
      label: row.label,
      count: Number(row.count),
    }))
    .filter((row) => row.label.toLowerCase() !== exploreNeighborhood.toLowerCase());

  const propertyTypes: ZonePropertyTypeStat[] = typeRows.map((row) => ({
    type: row.property_type,
    count: Number(row.count),
    medianPricePerM2: row.median_ppm2,
  }));

  const monthlyTrend: ZoneMonthlyTrend[] = trendResult.rows
    .filter((row) => row.minSampleMet)
    .map((row) => ({
      month: row.month,
      sample: row.sample,
      medianPpm2: row.medianPpm2,
    }));

  const base = mapRawZoneRow(summary, citySlug);
  return {
    ...base,
    published,
    minDataPoints,
    medianPriceCop: summary.median_price_cop,
    opportunityCount: Number(opportunityRows[0]?.n ?? 0),
    propertyTypes,
    aliases,
    exploreNeighborhood,
    monthlyTrend,
    lastUpdatedAt: freshnessRows[0]?.last_updated?.toISOString() ?? null,
    centroidLatitude: summary.centroid_lat,
    centroidLongitude: summary.centroid_lng,
    geoListingCount: Number(summary.geo_count),
  };
}
