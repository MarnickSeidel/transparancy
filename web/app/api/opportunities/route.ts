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

function parseOptionalInt(raw: string | null): number | null {
  if (!raw?.trim()) return null
  const n = Number.parseInt(raw.replace(/\D/g, ""), 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

function parseOptionalFloat(raw: string | null): number | null {
  if (!raw?.trim()) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : null
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

  const minPriceRaw = searchParams.get("minPriceCop")
  let minPriceCop: bigint | null = null
  if (minPriceRaw != null && minPriceRaw.trim() !== "") {
    const n = Number.parseInt(minPriceRaw.replace(/\D/g, ""), 10)
    if (Number.isFinite(n) && n >= 1 && n <= 1_000_000_000_000) {
      minPriceCop = BigInt(n)
    }
  }

  const minAreaM2 = parseOptionalInt(searchParams.get("minAreaM2"))
  const maxAreaM2 = parseOptionalInt(searchParams.get("maxAreaM2"))
  const estratoRaw = searchParams.get("estrato")
  const estrato =
    estratoRaw != null && estratoRaw.trim() !== "" && estratoRaw !== "all"
      ? Number.parseInt(estratoRaw, 10)
      : Number.NaN
  const estratoFilter = Number.isFinite(estrato) ? estrato : null
  const conjunto = searchParams.get("conjunto")
  const latitude = parseOptionalFloat(searchParams.get("latitude"))
  const longitude = parseOptionalFloat(searchParams.get("longitude"))
  const radiusMeters = parseOptionalInt(searchParams.get("radiusMeters"))

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
      minPriceCop,
      minAreaM2,
      maxAreaM2,
      estrato: estratoFilter,
      conjunto,
      latitude,
      longitude,
      radiusMeters,
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
