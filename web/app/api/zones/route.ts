import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ZONE_CITY,
  mapRawZoneRow,
  parseMinCount,
  sqlBucketKey,
  sqlEffectivePpm2,
} from "@/lib/zones";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city")?.trim() || DEFAULT_ZONE_CITY;
  const minDataPoints = parseMinCount(
    searchParams.get("minDataPoints"),
    searchParams.get("minCount"),
  );
  const citySlug = city.toLowerCase().replace(/\s+/g, "-");

  try {
    const rows = await prisma.$queryRaw<
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

    const zones = rows.map((row) => mapRawZoneRow(row, citySlug));

    return NextResponse.json({
      city,
      citySlug,
      minDataPoints,
      minCount: minDataPoints,
      zones,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
