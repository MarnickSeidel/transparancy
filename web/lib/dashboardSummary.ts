import { Prisma } from "@prisma/client";

import {
  MIN_ANALYTICS_AREA_M2,
  MIN_SAMPLE_SIZE,
  hasMinSample,
} from "@/lib/analytics";
import { summaryCityConditions } from "@/lib/dashboardFilterSql";
import { prisma } from "@/lib/prisma";

export type SummaryData = {
  avgPricePerM2Pereira: number | null;
  avgPricePerM2City: number | null;
  medianPricePerM2City: number | null;
  p25PricePerM2City: number | null;
  p75PricePerM2City: number | null;
  iqrPricePerM2City: number | null;
  minSampleSize: number;
  sampleSizePricePerM2: number;
  minSampleMet: boolean;
  outlierRule: string;
  cityScope: string;
  cityLabel: string;
  totalListings: number;
  activeListings: number;
  inactiveListings: number;
  catalogTotal: number;
  cityCount: number;
  neighborhoodCount: number;
  listingsScrapedToday: number;
  listingsNewToday: number;
  coverageEstratoPct: number;
  coverageGeoPct: number;
  coveragePricePerM2Pct: number;
};

export async function getDashboardSummary(city: string | null): Promise<SummaryData> {
  const todayStart = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();

  const cityWhereActive =
    city && city !== "all" ? { city, isActive: true } : { isActive: true };
  const cond = summaryCityConditions(city);
  const whereSql = Prisma.join(
    [...cond, Prisma.sql`l.is_active = true`],
    " AND ",
  );
  const cityFilterSql =
    city && city !== "all" ? Prisma.sql`AND l.city = ${city}` : Prisma.empty;

  const [
    avgRow,
    countsRow,
    winRow,
    distinctCounts,
  ] = await Promise.all([
    prisma.listing.aggregate({
      where: {
        ...cityWhereActive,
        pricePerM2: { not: null },
        areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
      },
      _avg: { pricePerM2: true },
    }),
    prisma.$queryRaw<
      Array<{
        active_listings: bigint;
        catalog_total: bigint;
        inactive_listings: bigint;
        listings_today: bigint;
        with_estrato: bigint;
        with_geo: bigint;
        new_today: bigint;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE l.is_active = true)::bigint AS active_listings,
        COUNT(*)::bigint AS catalog_total,
        COUNT(*) FILTER (WHERE l.is_active = false)::bigint AS inactive_listings,
        COUNT(*) FILTER (
          WHERE l.is_active = true AND l.date_scraped >= ${todayStart}
        )::bigint AS listings_today,
        COUNT(*) FILTER (
          WHERE l.is_active = true AND l.estrato IS NOT NULL
        )::bigint AS with_estrato,
        COUNT(*) FILTER (
          WHERE l.is_active = true
            AND l.latitude IS NOT NULL
            AND l.longitude IS NOT NULL
        )::bigint AS with_geo,
        COUNT(*) FILTER (
          WHERE l.is_active = true AND l.first_seen_at >= ${todayStart}
        )::bigint AS new_today
      FROM listings l
      WHERE 1=1
      ${cityFilterSql}
    `),
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
      Array<{ city_count: bigint; neighborhood_count: bigint }>
    >(Prisma.sql`
      SELECT
        COUNT(DISTINCT l.city)::bigint AS city_count,
        COUNT(DISTINCT l.neighborhood) FILTER (
          WHERE l.neighborhood IS NOT NULL AND btrim(l.neighborhood) <> ''
        )::bigint AS neighborhood_count
      FROM listings l
      WHERE l.is_active = true
      ${city && city !== "all" ? Prisma.sql`AND l.city = ${city}` : Prisma.empty}
    `),
  ]);

  const w = winRow[0];
  const counts = distinctCounts[0];
  const c = countsRow[0];
  const activeListings = c?.active_listings != null ? Number(c.active_listings) : 0;
  const catalogTotal = c?.catalog_total != null ? Number(c.catalog_total) : 0;
  const inactiveListings = c?.inactive_listings != null ? Number(c.inactive_listings) : 0;
  const listingsToday = c?.listings_today != null ? Number(c.listings_today) : 0;
  const withEstrato = c?.with_estrato != null ? Number(c.with_estrato) : 0;
  const withGeo = c?.with_geo != null ? Number(c.with_geo) : 0;
  const newToday = c?.new_today != null ? Number(c.new_today) : 0;
  const n = w?.n != null ? Number(w.n) : 0;
  const medianPpm2 = w?.p50 ?? null;
  const p25 = w?.p25 ?? null;
  const p75 = w?.p75 ?? null;
  const iqr = p25 != null && p75 != null ? p75 - p25 : null;

  return {
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
    totalListings: catalogTotal,
    activeListings,
    inactiveListings,
    catalogTotal,
    cityCount: counts?.city_count != null ? Number(counts.city_count) : 0,
    neighborhoodCount:
      counts?.neighborhood_count != null ? Number(counts.neighborhood_count) : 0,
    listingsScrapedToday: listingsToday,
    listingsNewToday: newToday,
    coverageEstratoPct:
      activeListings > 0 ? Number(((withEstrato / activeListings) * 100).toFixed(2)) : 0,
    coverageGeoPct:
      activeListings > 0 ? Number(((withGeo / activeListings) * 100).toFixed(2)) : 0,
    coveragePricePerM2Pct:
      activeListings > 0 ? Number(((n / activeListings) * 100).toFixed(2)) : 0,
  };
}
