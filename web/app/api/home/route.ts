import { NextResponse } from "next/server"

import { getHomePageData } from "@/lib/getHomeStats"
import { DEFAULT_OPPORTUNITIES_CITY } from "@/lib/getTopOpportunities"
import { enforceRateLimit } from "@/lib/rateLimit"

export const revalidate = 60

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
}

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "home", 90, 60_000)
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const city = searchParams.get("city")?.trim() || DEFAULT_OPPORTUNITIES_CITY

  try {
    const data = await getHomePageData(city)
    return NextResponse.json(data, { headers: CACHE_HEADERS })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    )
  }
}
