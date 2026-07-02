import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { MIN_ANALYTICS_AREA_M2, MIN_SAMPLE_SIZE } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const neighborhood = searchParams.get("neighborhood");
  const estrato = searchParams.get("estrato");
  const monthsParam = Number.parseInt(searchParams.get("months") ?? "12", 10);
  const months = Number.isNaN(monthsParam)
    ? 12
    : Math.max(3, Math.min(24, monthsParam));

  try {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`l.price_per_m2 IS NOT NULL`,
      Prisma.sql`l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}`,
      Prisma.sql`l.date_scraped >= date_trunc('month', NOW()) - (${months - 1} * interval '1 month')`,
    ];

    if (city && city !== "all") conditions.push(Prisma.sql`l.city = ${city}`);
    if (neighborhood && neighborhood !== "all") {
      conditions.push(Prisma.sql`l.neighborhood = ${neighborhood}`);
    }
    if (estrato && estrato !== "all") {
      const parsed = Number.parseInt(estrato, 10);
      if (!Number.isNaN(parsed)) conditions.push(Prisma.sql`l.estrato = ${parsed}`);
    }

    const rows = await prisma.$queryRaw<
      Array<{
        month: Date;
        sample: bigint;
        median_ppm2: number | null;
        p25_ppm2: number | null;
        p75_ppm2: number | null;
      }>
    >(Prisma.sql`
      WITH monthly AS (
        SELECT
          date_trunc('month', l.date_scraped) AS month,
          l.price_per_m2
        FROM listings l
        WHERE ${Prisma.join(conditions, " AND ")}
      )
      SELECT
        month,
        COUNT(*)::bigint AS sample,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS median_ppm2,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p25_ppm2,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p75_ppm2
      FROM monthly
      GROUP BY month
      ORDER BY month ASC
    `);

    const mapped = rows.map((r) => {
      const sample = Number(r.sample);
      return {
        month: r.month.toISOString().slice(0, 7),
        sample,
        medianPpm2: r.median_ppm2,
        p25: r.p25_ppm2,
        p75: r.p75_ppm2,
        minSampleMet: sample >= MIN_SAMPLE_SIZE,
      };
    });

    return NextResponse.json({
      monthsRequested: months,
      minSampleSize: MIN_SAMPLE_SIZE,
      rows: mapped.filter((r) => r.minSampleMet),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
