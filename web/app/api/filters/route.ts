import { NextResponse } from "next/server";

import { getCachedFiltersData } from "@/lib/serverCache";

export const revalidate = 120;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  try {
    const data = await getCachedFiltersData(city);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  }
}
