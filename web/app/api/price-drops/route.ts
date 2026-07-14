import { NextResponse } from "next/server"

import { getCachedRecentPriceDrops } from "@/lib/serverCache"

export const revalidate = 120

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get("city")
  const limitRaw = searchParams.get("limit")
  const daysRaw = searchParams.get("days")

  const limit =
    limitRaw != null && limitRaw.trim() !== ""
      ? Number.parseInt(limitRaw, 10)
      : 30
  const days =
    daysRaw != null && daysRaw.trim() !== ""
      ? Number.parseInt(daysRaw, 10)
      : 30

  try {
    const drops = await getCachedRecentPriceDrops({ city, limit, days })
    return NextResponse.json({ drops }, { headers: CACHE_HEADERS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
