import { NextResponse } from "next/server"

import {
  DEFAULT_NEARBY_RADIUS_M,
  MAX_NEARBY_RADIUS_M,
  normalizeListingCoordinates,
  type NearbyAmenitiesResult,
} from "@/lib/nearbyAmenities"
import { getCachedNearbyAmenities } from "@/lib/serverCache"
import { enforceRateLimit } from "@/lib/rateLimit"

export const dynamic = "force-dynamic"

const parseCoord = (raw: string | null): number | null => {
  if (raw == null || raw.trim() === "") return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return value
}

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "nearby-amenities", 30, 60_000)
  if (limited) return limited

  try {
    const { searchParams } = new URL(req.url)
    const latitude = parseCoord(searchParams.get("latitude"))
    const longitude = parseCoord(searchParams.get("longitude"))

    if (latitude == null || longitude == null) {
      return NextResponse.json({ error: "coordinates_required" }, { status: 400 })
    }

    const { lat, lng } = normalizeListingCoordinates(latitude, longitude)

    const radiusRaw = parseCoord(searchParams.get("radiusM"))
    const radiusM = Math.min(
      MAX_NEARBY_RADIUS_M,
      Math.max(200, radiusRaw ?? DEFAULT_NEARBY_RADIUS_M),
    )

    const result: NearbyAmenitiesResult = await getCachedNearbyAmenities(
      lat,
      lng,
      radiusM,
    )

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
