import { Prisma } from "@prisma/client";

import { hasMinSample } from "@/lib/analytics";
import { listingAnalyticsConditions } from "@/lib/dashboardFilterSql";
import { prisma } from "@/lib/prisma";

const NULL_TYPE = "__NULL__";

function buildPricingDrivers(
  cityMedian: number,
  typeRow: {
    prop_type: string | null;
    cnt: bigint;
    p50: number | null;
  } | null,
  estratoRow: {
    estrato: number;
    cnt: bigint;
    med: number | null;
  } | null,
  neighborhoodRow: {
    nh_label: string | null;
    cnt: bigint;
    p50: number | null;
  } | null,
) {
  const drivers = [
    {
      label: "Type",
      name:
        typeRow?.prop_type != null && typeRow.prop_type !== ""
          ? typeRow.prop_type
          : null,
      impactPct:
        typeRow?.p50 != null && cityMedian > 0
          ? ((typeRow.p50 - cityMedian) / cityMedian) * 100
          : 0,
      sample: typeRow ? Number(typeRow.cnt) : 0,
    },
    {
      label: "Estrato",
      name: estratoRow != null ? String(estratoRow.estrato) : null,
      impactPct:
        estratoRow?.med != null && cityMedian > 0
          ? ((estratoRow.med - cityMedian) / cityMedian) * 100
          : 0,
      sample: estratoRow ? Number(estratoRow.cnt) : 0,
    },
    {
      label: "Neighborhood",
      name:
        neighborhoodRow?.nh_label != null && neighborhoodRow.nh_label !== ""
          ? neighborhoodRow.nh_label
          : null,
      impactPct:
        neighborhoodRow?.p50 != null && cityMedian > 0
          ? ((neighborhoodRow.p50 - cityMedian) / cityMedian) * 100
          : 0,
      sample: neighborhoodRow ? Number(neighborhoodRow.cnt) : 0,
    },
  ];
  return drivers.sort((a, b) => Math.abs(b.impactPct) - Math.abs(a.impactPct));
}

export type DashboardAggregatesData = {
  typeStats: Array<{
    type: string | null;
    count: number;
    medianPpm2: number | null;
    p25: number | null;
    p75: number | null;
    medianArea: number | null;
  }>;
  neighborhoodStats: Array<{
    name: string | null;
    count: number;
    sampleSize: number;
    minSampleMet: boolean;
    medianPpm2: number | null;
    p25: number | null;
    p75: number | null;
    deltaPct: number | null;
  }>;
  estratoTypeMatrix: {
    types: string[];
    rows: Array<{
      estrato: number;
      cells: Array<{ type: string; count: number; medianPpm2: number | null }>;
    }>;
  };
  pricingIntelligence: {
    cityMedian: number;
    expectedPpm2: number;
    lowBand: number;
    highBand: number;
    drivers: Array<{
      label: string;
      name: string | null;
      impactPct: number;
      sample: number;
    }>;
  } | null;
};

export async function getDashboardAggregates(
  city: string | null,
  estrato: string | null,
  neighborhood: string | null,
): Promise<DashboardAggregatesData> {
  const cond = listingAnalyticsConditions(city, estrato, neighborhood);
  const whereSql = Prisma.join(cond, " AND ");

  const [winRow, typeRows, neighborhoodRows, matrixRows, topEstratoRows] =
    await Promise.all([
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
      prisma.$queryRaw<
        Array<{
          prop_type: string | null;
          cnt: bigint;
          p25: number | null;
          p50: number | null;
          p75: number | null;
          med_area: number | null;
        }>
      >(Prisma.sql`
        SELECT
          l.property_type AS prop_type,
          COUNT(*)::bigint AS cnt,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p25,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p75,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.area_m2)::float8 AS med_area
        FROM listings l
        WHERE ${whereSql}
        GROUP BY l.property_type
        ORDER BY cnt DESC
      `),
      prisma.$queryRaw<
        Array<{
          nh_label: string | null;
          cnt: bigint;
          p25: number | null;
          p50: number | null;
          p75: number | null;
        }>
      >(Prisma.sql`
        WITH nh AS (
          SELECT
            NULLIF(TRIM(COALESCE(l.neighborhood, l.neighborhood_raw)), '') AS nh_label,
            l.price_per_m2
          FROM listings l
          WHERE ${whereSql}
        ),
        agg AS (
          SELECT
            nh_label,
            COUNT(*)::bigint AS cnt,
            percentile_cont(0.25) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p25,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p50,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p75
          FROM nh
          GROUP BY nh_label
        )
        SELECT * FROM agg
        ORDER BY cnt DESC
        LIMIT 12
      `),
      prisma.$queryRaw<
        Array<{
          estrato: number;
          prop_type: string | null;
          cnt: bigint;
          med: number | null;
        }>
      >(Prisma.sql`
        SELECT
          l.estrato AS estrato,
          l.property_type AS prop_type,
          COUNT(*)::bigint AS cnt,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS med
        FROM listings l
        WHERE ${whereSql}
          AND l.estrato IS NOT NULL
        GROUP BY l.estrato, l.property_type
      `),
      prisma.$queryRaw<
        Array<{
          estrato: number;
          cnt: bigint;
          med: number | null;
        }>
      >(Prisma.sql`
        SELECT
          l.estrato AS estrato,
          COUNT(*)::bigint AS cnt,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS med
        FROM listings l
        WHERE ${whereSql}
          AND l.estrato IS NOT NULL
        GROUP BY l.estrato
        ORDER BY cnt DESC
        LIMIT 1
      `),
    ]);

  const w = winRow[0];
  const cityMedian = w?.p50 ?? null;

  const typeStats = typeRows.map((r) => ({
    type: r.prop_type,
    count: Number(r.cnt),
    medianPpm2: r.p50,
    p25: r.p25,
    p75: r.p75,
    medianArea: r.med_area,
  }));

  const neighborhoodStats = neighborhoodRows.map((r) => {
    const sampleSize = Number(r.cnt);
    const med = r.p50;
    const deltaPct =
      med != null && cityMedian != null && cityMedian > 0
        ? ((med - cityMedian) / cityMedian) * 100
        : null;
    return {
      name: r.nh_label,
      count: sampleSize,
      sampleSize,
      minSampleMet: hasMinSample(sampleSize),
      medianPpm2: med,
      p25: r.p25,
      p75: r.p75,
      deltaPct,
    };
  });

  const typeKeys = Array.from(
    new Set(matrixRows.map((r) => r.prop_type ?? NULL_TYPE)),
  ).sort();
  const estratoKeys = Array.from(new Set(matrixRows.map((r) => r.estrato))).sort(
    (a, b) => a - b,
  );
  const cellMap = new Map<
    string,
    { type: string; count: number; medianPpm2: number | null }
  >();
  for (const r of matrixRows) {
    const t = r.prop_type ?? NULL_TYPE;
    cellMap.set(`${r.estrato}|${t}`, {
      type: t,
      count: Number(r.cnt),
      medianPpm2: r.med,
    });
  }
  const estratoTypeMatrix = {
    types: typeKeys,
    rows: estratoKeys.map((e) => ({
      estrato: e,
      cells: typeKeys.map((t) => {
        const hit = cellMap.get(`${e}|${t}`);
        return hit ?? { type: t, count: 0, medianPpm2: null };
      }),
    })),
  };

  let pricingIntelligence: DashboardAggregatesData["pricingIntelligence"] = null;

  if (cityMedian != null && cityMedian > 0) {
    const drivers = buildPricingDrivers(
      cityMedian,
      typeRows[0] ?? null,
      topEstratoRows[0] ?? null,
      neighborhoodRows[0] ?? null,
    );
    const expected =
      cityMedian * (1 + drivers.reduce((acc, d) => acc + d.impactPct / 300, 0));
    const p25 = w?.p25 ?? null;
    const p75 = w?.p75 ?? null;
    pricingIntelligence = {
      cityMedian,
      expectedPpm2: expected,
      lowBand: p25 ?? expected * 0.92,
      highBand: p75 ?? expected * 1.08,
      drivers: drivers.slice(0, 3),
    };
  }

  return {
    typeStats,
    neighborhoodStats,
    estratoTypeMatrix,
    pricingIntelligence,
  };
}
