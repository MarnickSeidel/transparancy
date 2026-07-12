import { Prisma } from "@prisma/client";

import { MIN_ANALYTICS_AREA_M2, MIN_SAMPLE_SIZE } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export type MonthlyTrendRow = {
  month: string;
  sample: number;
  medianPpm2: number | null;
  p25: number | null;
  p75: number | null;
  minSampleMet: boolean;
};

export function clampTrendMonths(raw: number | undefined): number {
  const parsed = raw ?? 12;
  if (Number.isNaN(parsed)) return 12;
  return Math.max(3, Math.min(24, parsed));
}

export async function queryMonthlyTrends(args: {
  city?: string | null;
  neighborhood?: string | null;
  estrato?: string | null;
  months?: number;
}): Promise<{ monthsRequested: number; minSampleSize: number; rows: MonthlyTrendRow[] }> {
  const months = clampTrendMonths(args.months);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`l.is_active = true`,
    Prisma.sql`l.price_per_m2 IS NOT NULL`,
    Prisma.sql`l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}`,
    Prisma.sql`l.date_scraped >= date_trunc('month', NOW()) - (${months - 1} * interval '1 month')`,
  ];

  if (args.city && args.city !== "all") {
    conditions.push(Prisma.sql`l.city = ${args.city}`);
  }
  if (args.neighborhood && args.neighborhood !== "all") {
    conditions.push(Prisma.sql`l.neighborhood = ${args.neighborhood}`);
  }
  if (args.estrato && args.estrato !== "all") {
    const parsed = Number.parseInt(args.estrato, 10);
    if (!Number.isNaN(parsed)) {
      conditions.push(Prisma.sql`l.estrato = ${parsed}`);
    }
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

  const mapped: MonthlyTrendRow[] = rows.map((r) => {
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

  return {
    monthsRequested: months,
    minSampleSize: MIN_SAMPLE_SIZE,
    rows: mapped,
  };
}
