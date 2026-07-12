import { NextResponse } from "next/server";

import { getDashboardAggregates } from "@/lib/dashboardAggregates";
import { getDashboardFilters } from "@/lib/dashboardFilters";
import { getDashboardSummary } from "@/lib/dashboardSummary";
import { queryMonthlyTrends } from "@/lib/monthlyTrends";

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
      getDashboardSummary(city),
      getDashboardFilters(city),
      getDashboardAggregates(city, estrato, neighborhood),
      queryMonthlyTrends({ city, neighborhood, estrato, months: monthsParam }),
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
