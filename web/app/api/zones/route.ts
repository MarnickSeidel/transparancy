import { NextResponse } from "next/server";

import { getZonesForCity } from "@/lib/getZonesIndex";
import { DEFAULT_ZONE_CITY, parseMinCount } from "@/lib/zones";

export const revalidate = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city")?.trim() || DEFAULT_ZONE_CITY;
  const minDataPoints = parseMinCount(
    searchParams.get("minDataPoints"),
    searchParams.get("minCount"),
  );

  try {
    const data = await getZonesForCity(city, minDataPoints);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
