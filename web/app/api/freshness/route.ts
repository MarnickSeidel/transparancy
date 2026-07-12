import { NextResponse } from "next/server"

import { getGlobalDataFreshness } from "@/lib/getDataFreshness"

export const revalidate = 300

export async function GET() {
  try {
    const freshness = await getGlobalDataFreshness()
    return NextResponse.json({
      lastScrapedAt: freshness.lastScrapedAt?.toISOString() ?? null,
      activeSeenLast7Days: freshness.activeSeenLast7Days,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
