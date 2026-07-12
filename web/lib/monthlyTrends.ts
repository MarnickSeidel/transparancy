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

function buildListingFilters(args: {
  city?: string | null;
  neighborhood?: string | null;
  estrato?: string | null;
}): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`l.price_per_m2 IS NOT NULL`,
    Prisma.sql`l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}`,
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

  return conditions;
}

function mapTrendRows(
  rows: Array<{
    month: Date;
    sample: bigint;
    median_ppm2: number | null;
    p25_ppm2: number | null;
    p75_ppm2: number | null;
  }>,
): MonthlyTrendRow[] {
  return rows.map((r) => {
    const sample = Number(r.sample);
    return {
      month: r.month.toISOString().slice(0, 7),
      sample,
      medianPpm2: sample > 0 ? r.median_ppm2 : null,
      p25: sample > 0 ? r.p25_ppm2 : null,
      p75: sample > 0 ? r.p75_ppm2 : null,
      minSampleMet: sample >= MIN_SAMPLE_SIZE,
    };
  });
}

type RawTrendRow = {
  month: Date;
  sample: bigint;
  median_ppm2: number | null;
  p25_ppm2: number | null;
  p75_ppm2: number | null;
};

/** Listings on market during each calendar month (supports neighborhood/estrato filters). */
async function queryActivityWindowTrends(args: {
  city?: string | null;
  neighborhood?: string | null;
  estrato?: string | null;
  months: number;
}): Promise<RawTrendRow[]> {
  const listingFilters = buildListingFilters(args);

  return prisma.$queryRaw<RawTrendRow[]>(Prisma.sql`
    WITH month_series AS (
      SELECT gs::date AS month_start
      FROM generate_series(
        date_trunc('month', NOW())::date - ((${args.months} - 1) * interval '1 month'),
        date_trunc('month', NOW())::date,
        interval '1 month'
      ) AS gs
    ),
    eligible AS (
      SELECT
        l.price_per_m2,
        COALESCE(l.source_created_at, l.first_seen_at, l.date_scraped) AS market_start,
        l.last_seen_at AS market_end
      FROM listings l
      WHERE ${Prisma.join(listingFilters, " AND ")}
    ),
    paired AS (
      SELECT
        ms.month_start,
        e.price_per_m2
      FROM month_series ms
      INNER JOIN eligible e ON
        e.market_start < (ms.month_start + interval '1 month')
        AND e.market_end >= ms.month_start
    )
    SELECT
      ms.month_start AS month,
      COUNT(p.price_per_m2)::bigint AS sample,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY p.price_per_m2)::float8 AS median_ppm2,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY p.price_per_m2)::float8 AS p25_ppm2,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY p.price_per_m2)::float8 AS p75_ppm2
    FROM month_series ms
    LEFT JOIN paired p ON p.month_start = ms.month_start
    GROUP BY ms.month_start
    ORDER BY ms.month_start ASC
  `);
}

/** City-level snapshots captured during monthly refresh (no neighborhood/estrato filters). */
async function querySnapshotTrends(args: {
  city: string;
  months: number;
}): Promise<RawTrendRow[]> {
  return prisma.$queryRaw<RawTrendRow[]>(Prisma.sql`
    WITH month_series AS (
      SELECT gs::date AS month_start
      FROM generate_series(
        date_trunc('month', NOW())::date - ((${args.months} - 1) * interval '1 month'),
        date_trunc('month', NOW())::date,
        interval '1 month'
      ) AS gs
    )
    SELECT
      ms.month_start AS month,
      COALESCE(s.sample, 0)::bigint AS sample,
      s.median_ppm2,
      s.p25_ppm2,
      s.p75_ppm2
    FROM month_series ms
    LEFT JOIN monthly_market_snapshots s
      ON s.month = ms.month_start
      AND s.city = ${args.city}
    ORDER BY ms.month_start ASC
  `);
}

function hasSubCityFilters(args: {
  neighborhood?: string | null;
  estrato?: string | null;
}): boolean {
  return (
    (args.neighborhood != null && args.neighborhood !== "all") ||
    (args.estrato != null && args.estrato !== "all")
  );
}

/** Merge snapshot rows with live activity-window rows, preferring higher sample per month. */
function mergeTrendRows(snapshot: RawTrendRow[], live: RawTrendRow[]): RawTrendRow[] {
  const liveByMonth = new Map(live.map((r) => [r.month.toISOString().slice(0, 7), r]));
  return snapshot.map((s) => {
    const key = s.month.toISOString().slice(0, 7);
    const l = liveByMonth.get(key);
    if (!l) return s;
    if (Number(s.sample) >= Number(l.sample)) return s;
    return l;
  });
}

export async function queryMonthlyTrends(args: {
  city?: string | null;
  neighborhood?: string | null;
  estrato?: string | null;
  months?: number;
}): Promise<{ monthsRequested: number; minSampleSize: number; rows: MonthlyTrendRow[] }> {
  const months = clampTrendMonths(args.months);
  const city = args.city && args.city !== "all" ? args.city : null;

  let rows: RawTrendRow[];
  if (city && !hasSubCityFilters(args)) {
    let snapshotRows: RawTrendRow[] = [];
    try {
      snapshotRows = await querySnapshotTrends({ city, months });
    } catch {
      // Table may not exist until migration 20260712180000 is applied.
      snapshotRows = [];
    }
    const liveRows = await queryActivityWindowTrends({ ...args, months });
    rows =
      snapshotRows.length > 0 ? mergeTrendRows(snapshotRows, liveRows) : liveRows;
  } else {
    rows = await queryActivityWindowTrends({ ...args, months });
  }

  return {
    monthsRequested: months,
    minSampleSize: MIN_SAMPLE_SIZE,
    rows: mapTrendRows(rows),
  };
}
