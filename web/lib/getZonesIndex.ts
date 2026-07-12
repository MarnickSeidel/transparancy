import { Prisma } from "@prisma/client";

import { catalogKeyForCity } from "@/lib/neighborhoodResolver";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MIN_ZONE_DATA_POINTS,
  DEFAULT_ZONE_CITY,
  mapRawZoneRow,
  sqlBucketKey,
  sqlEffectivePpm2,
  type PublishableZone,
} from "@/lib/zones";

async function queryZonesFromView(city: string, minDataPoints: number) {
  return prisma.$queryRaw<
    Array<{
      bucket_key: string;
      city: string;
      display_name: string | null;
      listing_count: bigint;
      data_point_count: bigint;
      median_ppm2: number | null;
      catalog_count: bigint;
      source_id_count: bigint;
      provisional_count: bigint;
      weak_count: bigint;
      missing_count: bigint;
    }>
  >(Prisma.sql`
    SELECT
      bucket_key,
      city,
      display_name,
      listing_count,
      data_point_count,
      median_ppm2,
      catalog_count,
      source_id_count,
      provisional_count,
      weak_count,
      missing_count
    FROM zone_list_aggregates
    WHERE city = ${city}
      AND data_point_count >= ${minDataPoints}
    ORDER BY data_point_count DESC, bucket_key ASC
  `);
}

async function queryZonesInline(city: string, minDataPoints: number) {
  return prisma.$queryRaw<
    Array<{
      bucket_key: string;
      city: string;
      display_name: string | null;
      listing_count: bigint;
      data_point_count: bigint;
      median_ppm2: number | null;
      catalog_count: bigint;
      source_id_count: bigint;
      provisional_count: bigint;
      weak_count: bigint;
      missing_count: bigint;
    }>
  >(Prisma.sql`
    WITH tagged AS (
      SELECT
        ${sqlBucketKey()} AS bucket_key,
        l.city,
        l.neighborhood,
        ${sqlEffectivePpm2()} AS ppm2,
        COALESCE(l.quality_flags->>'neighborhood_confidence', 'missing') AS confidence
      FROM listings l
      WHERE l.is_active = true
        AND l.city = ${city}
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
    GROUP BY bucket_key
    HAVING COUNT(*) FILTER (WHERE ppm2 IS NOT NULL) >= ${minDataPoints}
    ORDER BY COUNT(*) FILTER (WHERE ppm2 IS NOT NULL) DESC, bucket_key ASC
  `);
}

export async function getZonesForCity(
  city: string,
  minDataPoints = DEFAULT_MIN_ZONE_DATA_POINTS,
): Promise<{ city: string; citySlug: string; minDataPoints: number; minCount: number; zones: PublishableZone[] }> {
  const citySlug = city.toLowerCase().replace(/\s+/g, "-");
  let rows;
  try {
    rows = await queryZonesFromView(city, minDataPoints);
  } catch {
    rows = await queryZonesInline(city, minDataPoints);
  }
  return {
    city,
    citySlug,
    minDataPoints,
    minCount: minDataPoints,
    zones: rows.map((row) => mapRawZoneRow(row, citySlug)),
  };
}

export async function getZoneCities(
  minDataPoints = DEFAULT_MIN_ZONE_DATA_POINTS,
): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ city: string }>>(Prisma.sql`
      SELECT city
      FROM zone_list_aggregates
      WHERE data_point_count >= ${minDataPoints}
      GROUP BY city
      ORDER BY COUNT(*) DESC, city ASC
    `);
    const cities = rows.map((r) => r.city);
    if (cities.length > 0) return cities;
  } catch {
    /* fall through to inline aggregation */
  }

  const rows = await prisma.$queryRaw<Array<{ city: string }>>(Prisma.sql`
    WITH tagged AS (
      SELECT
        ${sqlBucketKey()} AS bucket_key,
        l.city,
        ${sqlEffectivePpm2()} AS ppm2
      FROM listings l
      WHERE l.is_active = true
    ),
    filtered AS (
      SELECT * FROM tagged WHERE bucket_key IS NOT NULL
    ),
    buckets AS (
      SELECT
        bucket_key,
        MAX(city) AS city,
        COUNT(*) FILTER (WHERE ppm2 IS NOT NULL)::bigint AS data_point_count
      FROM filtered
      GROUP BY bucket_key
      HAVING COUNT(*) FILTER (WHERE ppm2 IS NOT NULL) >= ${minDataPoints}
    )
    SELECT city
    FROM buckets
    GROUP BY city
    ORDER BY COUNT(*) DESC, city ASC
  `);
  const cities = rows.map((r) => r.city);
  return cities.length > 0 ? cities : [DEFAULT_ZONE_CITY];
}

export async function getZoneCountsByCity(
  minDataPoints = DEFAULT_MIN_ZONE_DATA_POINTS,
): Promise<Array<{ name: string; slug: string; zoneCount: number }>> {
  try {
    const rows = await prisma.$queryRaw<Array<{ city: string; zone_count: bigint }>>(Prisma.sql`
      SELECT city, COUNT(*)::bigint AS zone_count
      FROM zone_list_aggregates
      WHERE data_point_count >= ${minDataPoints}
      GROUP BY city
      ORDER BY zone_count DESC, city ASC
    `);
    if (rows.length > 0) {
      return rows.map((row) => ({
        name: row.city,
        slug:
          catalogKeyForCity(row.city) ??
          row.city.trim().toLowerCase().replace(/\s+/g, "-"),
        zoneCount: Number(row.zone_count),
      }));
    }
  } catch {
    /* fall through */
  }

  const cities = await getZoneCities(minDataPoints);
  return Promise.all(
    cities.slice(0, 8).map(async (name) => {
      const slug =
        catalogKeyForCity(name) ?? name.trim().toLowerCase().replace(/\s+/g, "-");
      const data = await getZonesForCity(name, minDataPoints);
      return { name, slug, zoneCount: data.zones.length };
    }),
  );
}
