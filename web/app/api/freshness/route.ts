import { NextResponse } from "next/server"

import { getCachedGlobalDataFreshness } from "@/lib/serverCache"

export const revalidate = 300

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
}

export async function GET() {
  try {
    const freshness = await getCachedGlobalDataFreshness()
    return NextResponse.json(
      {
        lastScrapedAt: freshness.lastScrapedAt?.toISOString() ?? null,
        activeSeenLast7Days: freshness.activeSeenLast7Days,
      },
      { headers: CACHE_HEADERS },
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
