import { NextResponse } from "next/server";

import {
  getCachedDashboardAggregates,
  getCachedDashboardFilters,
  getCachedDashboardSummary,
  getCachedMonthlyTrends,
} from "@/lib/serverCache";

export const revalidate = 90;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const estrato = searchParams.get("estrato");
  const neighborhood = searchParams.get("neighborhood");
  const monthsParam = Number.parseInt(searchParams.get("months") ?? "6", 10);

  try {
    const [summary, filters, aggregates, trends] = await Promise.all([
      getCachedDashboardSummary(city),
      getCachedDashboardFilters(city),
      getCachedDashboardAggregates(city, estrato, neighborhood),
      getCachedMonthlyTrends({ city, neighborhood, estrato, months: monthsParam }),
    ]);

    return NextResponse.json(
      {
        summary,
        filters,
        typeStats: aggregates.typeStats,
        neighborhoodStats: aggregates.neighborhoodStats,
        estratoTypeMatrix: aggregates.estratoTypeMatrix,
        pricingIntelligence: aggregates.pricingIntelligence,
        monthlyTrends: {
          monthsRequested: trends.monthsRequested,
          minSampleSize: trends.minSampleSize,
          rows: trends.rows,
        },
      },
      { headers: CACHE_HEADERS },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
