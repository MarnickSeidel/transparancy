import { NextResponse } from "next/server"

import { getCachedTopOpportunities } from "@/lib/serverCache"

export const revalidate = 60

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
}

function parseExcludeNeighborhoods(searchParams: URLSearchParams): string[] {
  const set = new Set<string>()
  for (const raw of searchParams.getAll("excludeNeighborhood")) {
    for (const part of raw.split(",")) {
      const t = part.trim()
      if (t) set.add(t)
    }
  }
  return Array.from(set)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get("city")
  const propertyType = searchParams.get("propertyType")
  const neighborhood = searchParams.get("neighborhood")
  const excludeNeighborhoods = parseExcludeNeighborhoods(searchParams)
  const excludeUnknownNeighborhoods =
    searchParams.get("excludeUnknownNeighborhoods") === "1"
  const hideLowConfidence = searchParams.get("hideLowConfidence") !== "0"
  const excludeBarter = searchParams.get("excludeBarter") === "1"
  const excludeProjects = searchParams.get("excludeProjects") === "1"
  const minDiscountRaw = searchParams.get("minDiscountPct")
  const minDiscountPct =
    minDiscountRaw != null && minDiscountRaw.trim() !== ""
      ? Number.parseFloat(minDiscountRaw)
      : 0

  const maxPriceRaw = searchParams.get("maxPriceCop")
  let maxPriceCop: bigint | null = null
  if (maxPriceRaw != null && maxPriceRaw.trim() !== "") {
    const n = Number.parseInt(maxPriceRaw.replace(/\D/g, ""), 10)
    if (Number.isFinite(n) && n >= 1 && n <= 1_000_000_000_000) {
      maxPriceCop = BigInt(n)
    }
  }

  const limitRaw = searchParams.get("limit")
  const limit =
    limitRaw != null && limitRaw.trim() !== ""
      ? Math.min(50, Math.max(1, Number.parseInt(limitRaw, 10) || 10))
      : 10

  try {
    const opportunities = await getCachedTopOpportunities({
      city,
      propertyType,
      neighborhood,
      excludeNeighborhoods,
      excludeUnknownNeighborhoods,
      hideLowConfidence,
      excludeBarter,
      excludeProjects,
      minDiscountPct,
      maxPriceCop,
      limit,
    })

    return NextResponse.json({ opportunities }, { headers: CACHE_HEADERS })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    )
  }
}
