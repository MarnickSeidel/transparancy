import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MIN_ZONE_DATA_POINTS,
  parseMinCount,
  sqlBucketKey,
  sqlEffectivePpm2,
} from "@/lib/zones";

export const revalidate = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const minDataPoints = parseMinCount(
    searchParams.get("minDataPoints"),
    searchParams.get("minCount"),
  );

  try {
    const rows = await prisma.$queryRaw<Array<{ city: string; zone_count: bigint }>>(Prisma.sql`
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
      SELECT city, COUNT(*)::bigint AS zone_count
      FROM buckets
      GROUP BY city
      ORDER BY COUNT(*) DESC, city ASC
    `);

    const cities = rows.map((r) => r.city);

    return NextResponse.json(
      { cities, minDataPoints: minDataPoints || DEFAULT_MIN_ZONE_DATA_POINTS },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  }
}
