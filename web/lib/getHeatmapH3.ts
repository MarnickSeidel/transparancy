import { MIN_ANALYTICS_AREA_M2, MIN_SAMPLE_SIZE } from "@/lib/analytics"
import { aggregateListingsToH3, parseH3Resolution } from "@/lib/h3Heatmap"
import {
  isValidColombiaCoordinate,
  normalizeListingCoordinates,
} from "@/lib/nearbyAmenities"
import { prisma } from "@/lib/prisma"

export type HeatmapH3Query = {
  city: string
  propertyType?: string | null
  estrato?: string | null
  resolution?: string | null
}

export type HeatmapH3Data = {
  city: string
  resolution: number
  cells: ReturnType<typeof aggregateListingsToH3>["cells"]
  scale: ReturnType<typeof aggregateListingsToH3>["scale"]
  listingCount: number
  cellCount: number
  minSampleMet: boolean
}

export async function getHeatmapH3(query: HeatmapH3Query): Promise<HeatmapH3Data> {
  const { city, propertyType, estrato } = query
  const resolution = parseH3Resolution(query.resolution ?? null)

  const estratoParsed =
    estrato && estrato !== "all" ? Number.parseInt(estrato, 10) : Number.NaN

  const where = {
    isActive: true,
    city,
    latitude: { not: null },
    longitude: { not: null },
    pricePerM2: { not: null },
    areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
    ...(propertyType && propertyType !== "all" ? { propertyType } : {}),
    ...(!Number.isNaN(estratoParsed) ? { estrato: estratoParsed } : {}),
  }

  const rows = await prisma.listing.findMany({
    where,
    select: {
      latitude: true,
      longitude: true,
      pricePerM2: true,
      neighborhood: true,
    },
  })

  const listings = rows
    .filter(
      (r) =>
        r.latitude != null &&
        r.longitude != null &&
        r.pricePerM2 != null &&
        Number.isFinite(r.latitude) &&
        Number.isFinite(r.longitude),
    )
    .map((r) => {
      const { lat, lng } = normalizeListingCoordinates(
        r.latitude as number,
        r.longitude as number,
      )
      return {
        latitude: lat,
        longitude: lng,
        pricePerM2: r.pricePerM2 as number,
        neighborhood: r.neighborhood,
      }
    })
    .filter((r) => isValidColombiaCoordinate(r.latitude, r.longitude))

  if (listings.length < MIN_SAMPLE_SIZE) {
    return {
      city,
      resolution,
      cells: [],
      scale: { p25: null, p50: null, p75: null },
      listingCount: listings.length,
      cellCount: 0,
      minSampleMet: false,
    }
  }

  const { cells, scale, listingCount } = aggregateListingsToH3(listings, resolution)

  return {
    city,
    resolution,
    cells,
    scale,
    listingCount,
    cellCount: cells.length,
    minSampleMet: true,
  }
}
