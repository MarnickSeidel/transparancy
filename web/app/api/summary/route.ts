import { NextResponse } from "next/server";

import { getCachedDashboardSummary } from "@/lib/serverCache";

export const revalidate = 90;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  try {
    const data = await getCachedDashboardSummary(city);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
