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

  return rows.map((row) => ({
    citySlug: citySlugFromBucketKey(row.bucket_key),
    zoneSlug: zoneSlugFromBucketKey(row.bucket_key),
    city: row.city,
    displayName: row.display_name?.trim() || zoneSlugFromBucketKey(row.bucket_key),
    updatedAt: new Date(),
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

  return rows.map((row) => ({
    citySlug: citySlugFromBucketKey(row.bucket_key),
    zoneSlug: zoneSlugFromBucketKey(row.bucket_key),
    city: row.city,
    displayName: row.display_name?.trim() || zoneSlugFromBucketKey(row.bucket_key),
    updatedAt: new Date(),
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
