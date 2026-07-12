import { NextResponse } from "next/server";

import { getDashboardAggregates } from "@/lib/dashboardAggregates";

export const revalidate = 90;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const estrato = searchParams.get("estrato");
  const neighborhood = searchParams.get("neighborhood");

  try {
    const data = await getDashboardAggregates(city, estrato, neighborhood);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
