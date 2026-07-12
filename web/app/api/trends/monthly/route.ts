import { NextResponse } from "next/server";

import { queryMonthlyTrends } from "@/lib/monthlyTrends";

export const revalidate = 90;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const neighborhood = searchParams.get("neighborhood");
  const estrato = searchParams.get("estrato");
  const monthsParam = Number.parseInt(searchParams.get("months") ?? "12", 10);

  try {
    const { monthsRequested, minSampleSize, rows } = await queryMonthlyTrends({
      city,
      neighborhood,
      estrato,
      months: monthsParam,
    });

    return NextResponse.json(
      {
        monthsRequested,
        minSampleSize,
        rows: rows.filter((r) => r.minSampleMet),
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
