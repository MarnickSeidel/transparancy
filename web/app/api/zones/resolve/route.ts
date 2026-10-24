import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { localePath } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import {
  parseMinCount,
  slugFromCityNeighborhood,
  sqlBucketKey,
  sqlEffectivePpm2,
} from "@/lib/zones";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city")?.trim();
  const neighborhood = searchParams.get("neighborhood")?.trim();
  const minDataPoints = parseMinCount(
    searchParams.get("minDataPoints"),
    searchParams.get("minCount"),
  );

  if (!city || !neighborhood) {
    return NextResponse.json({ published: false });
  }

  const slugs = slugFromCityNeighborhood(city, neighborhood);
  if (!slugs) {
    return NextResponse.json({ published: false });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ data_point_count: bigint }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE ${sqlEffectivePpm2()} IS NOT NULL)::bigint AS data_point_count
      FROM listings l
      WHERE l.is_active = true
        AND ${sqlBucketKey()} = ${slugs.bucketKey}
    `);

    const dataPointCount = Number(rows[0]?.data_point_count ?? 0);
    const published = dataPointCount >= minDataPoints;

    return NextResponse.json({
      published,
      citySlug: slugs.citySlug,
      zoneSlug: slugs.zoneSlug,
      href: published ? localePath("es", slugs.href) : null,
      dataPointCount,
      minDataPoints,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
