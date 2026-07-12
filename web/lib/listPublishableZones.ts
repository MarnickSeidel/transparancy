import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  citySlugFromBucketKey,
  DEFAULT_MIN_ZONE_DATA_POINTS,
  sqlBucketKey,
  sqlEffectivePpm2,
  zoneSlugFromBucketKey,
} from "@/lib/zones";

export type PublishableZonePath = {
  citySlug: string;
  zoneSlug: string;
  city: string;
  displayName: string;
  updatedAt: Date;
};

async function fetchUpdatedAtMap(
  bucketKeys: string[],
): Promise<Map<string, Date>> {
  if (bucketKeys.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Array<{ bucket_key: string; updated_at: Date | null }>>(
    Prisma.sql`
      SELECT
        ${sqlBucketKey()} AS bucket_key,
        MAX(l.date_scraped) AS updated_at
      FROM listings l
      WHERE l.is_active = true
        AND ${sqlBucketKey()} = ANY(${bucketKeys}::text[])
      GROUP BY 1
    `,
  );
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row.updated_at) map.set(row.bucket_key, new Date(row.updated_at));
  }
  return map;
}

async function queryFromView(minDataPoints: number): Promise<PublishableZonePath[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      bucket_key: string;
      city: string;
      display_name: string | null;
    }>
  >(Prisma.sql`
    SELECT bucket_key, city, display_name
    FROM zone_list_aggregates
    WHERE data_point_count >= ${minDataPoints}
    ORDER BY city ASC, bucket_key ASC
  `);

  const keys = rows.map((r) => r.bucket_key);
  let updatedMap = new Map<string, Date>();
  try {
    updatedMap = await fetchUpdatedAtMap(keys);
  } catch {
    /* optional */
  }

  return rows.map((row) => ({
    citySlug: citySlugFromBucketKey(row.bucket_key),
    zoneSlug: zoneSlugFromBucketKey(row.bucket_key),
    city: row.city,
    displayName: row.display_name?.trim() || zoneSlugFromBucketKey(row.bucket_key),
    updatedAt: updatedMap.get(row.bucket_key) ?? new Date(),
  }));
}

async function queryInline(minDataPoints: number): Promise<PublishableZonePath[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      bucket_key: string;
      city: string;
      display_name: string | null;
    }>
  >(Prisma.sql`
    WITH tagged AS (
      SELECT
        ${sqlBucketKey()} AS bucket_key,
        l.city,
        l.neighborhood,
        ${sqlEffectivePpm2()} AS ppm2
      FROM listings l
      WHERE l.is_active = true
    ),
    filtered AS (
      SELECT * FROM tagged WHERE bucket_key IS NOT NULL
    )
    SELECT
      bucket_key,
      MAX(city) AS city,
      MODE() WITHIN GROUP (ORDER BY neighborhood) AS display_name
    FROM filtered
    GROUP BY bucket_key
    HAVING COUNT(*) FILTER (WHERE ppm2 IS NOT NULL) >= ${minDataPoints}
    ORDER BY MAX(city) ASC, bucket_key ASC
  `);

  const keys = rows.map((r) => r.bucket_key);
  let updatedMap = new Map<string, Date>();
  try {
    updatedMap = await fetchUpdatedAtMap(keys);
  } catch {
    /* optional */
  }

  return rows.map((row) => ({
    citySlug: citySlugFromBucketKey(row.bucket_key),
    zoneSlug: zoneSlugFromBucketKey(row.bucket_key),
    city: row.city,
    displayName: row.display_name?.trim() || zoneSlugFromBucketKey(row.bucket_key),
    updatedAt: updatedMap.get(row.bucket_key) ?? new Date(),
  }));
}

export async function listPublishableZones(
  minDataPoints = DEFAULT_MIN_ZONE_DATA_POINTS,
): Promise<PublishableZonePath[]> {
  try {
    return await queryFromView(minDataPoints);
  } catch {
    return queryInline(minDataPoints);
  }
}

export async function listPublishableCitySlugs(
  minDataPoints = DEFAULT_MIN_ZONE_DATA_POINTS,
): Promise<Array<{ city: string; citySlug: string; zoneCount: number }>> {
  const zones = await listPublishableZones(minDataPoints);
  const byCity = new Map<string, { city: string; citySlug: string; zoneCount: number }>();
  for (const z of zones) {
    const existing = byCity.get(z.citySlug);
    if (existing) {
      existing.zoneCount += 1;
    } else {
      byCity.set(z.citySlug, { city: z.city, citySlug: z.citySlug, zoneCount: 1 });
    }
  }
  return Array.from(byCity.values()).sort((a, b) => b.zoneCount - a.zoneCount);
}
