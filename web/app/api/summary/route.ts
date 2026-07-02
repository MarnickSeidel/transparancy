import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  MIN_ANALYTICS_AREA_M2,
  MIN_SAMPLE_SIZE,
  hasMinSample,
} from "@/lib/analytics";
import { summaryCityConditions } from "@/lib/dashboardFilterSql";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  try {
    const todayStart = (() => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      return d;
    })();

    const cityWhere = city && city !== "all" ? { city } : {};
    const cond = summaryCityConditions(city);
    const whereSql = Prisma.join(cond, " AND ");

    const [
      avgRow,
      totalListings,
      listingsToday,
      withEstrato,
      withGeo,
      newToday,
      winRow,
    ] = await Promise.all([
      prisma.listing.aggregate({
        where: {
          ...cityWhere,
          pricePerM2: { not: null },
          areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
        },
        _avg: { pricePerM2: true },
      }),
      prisma.listing.count({ where: cityWhere }),
      prisma.listing.count({
        where: { ...cityWhere, dateScraped: { gte: todayStart } },
      }),
      prisma.listing.count({ where: { ...cityWhere, estrato: { not: null } } }),
      prisma.listing.count({
        where: { ...cityWhere, latitude: { not: null }, longitude: { not: null } },
      }),
      prisma.listing.count({
        where: { ...cityWhere, firstSeenAt: { gte: todayStart } },
      }),
      prisma.$queryRaw<
        Array<{
          n: bigint;
          p25: number | null;
          p50: number | null;
          p75: number | null;
        }>
      >(Prisma.sql`
        WITH filtered AS (
          SELECT l.price_per_m2 AS ppm2
          FROM listings l
          WHERE ${whereSql}
        ),
        bounds AS (
          SELECT
            COUNT(*)::bigint AS n,
            percentile_cont(0.02) WITHIN GROUP (ORDER BY ppm2) AS lo,
            percentile_cont(0.98) WITHIN GROUP (ORDER BY ppm2) AS hi
          FROM filtered
        ),
        clipped AS (
          SELECT LEAST(GREATEST(f.ppm2, b.lo), b.hi) AS v
          FROM filtered f
          CROSS JOIN bounds b
          WHERE b.n > 0
        )
        SELECT
          b.n AS n,
          (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p25,
          (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p50,
          (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p75
        FROM bounds b
      `),
    ]);

    const w = winRow[0];
    const n = w?.n != null ? Number(w.n) : 0;
    const medianPpm2 = w?.p50 ?? null;
    const p25 = w?.p25 ?? null;
    const p75 = w?.p75 ?? null;
    const iqr = p25 != null && p75 != null ? p75 - p25 : null;

    return NextResponse.json({
      avgPricePerM2Pereira: avgRow._avg.pricePerM2 ?? null,
      avgPricePerM2City: avgRow._avg.pricePerM2 ?? null,
      medianPricePerM2City: medianPpm2,
      p25PricePerM2City: p25,
      p75PricePerM2City: p75,
      iqrPricePerM2City: iqr,
      minSampleSize: MIN_SAMPLE_SIZE,
      sampleSizePricePerM2: n,
      minSampleMet: hasMinSample(n),
      outlierRule: "winsorize_p2_p98",
      cityScope: city && city !== "all" ? city : "all",
      cityLabel: city && city !== "all" ? city : "All cities",
      totalListings,
      listingsScrapedToday: listingsToday,
      listingsNewToday: newToday,
      coverageEstratoPct:
        totalListings > 0 ? Number(((withEstrato / totalListings) * 100).toFixed(2)) : 0,
      coverageGeoPct:
        totalListings > 0 ? Number(((withGeo / totalListings) * 100).toFixed(2)) : 0,
      coveragePricePerM2Pct:
        totalListings > 0 ? Number(((n / totalListings) * 100).toFixed(2)) : 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
