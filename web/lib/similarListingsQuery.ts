import { MIN_ANALYTICS_AREA_M2 } from "@/lib/analytics"
import type { Locale } from "@/lib/locale"
import { opportunitiesPath } from "@/lib/locale"

type EstimateResultLike = {
  city: string
  areaM2: number
  totalCop: { low: number; high: number }
  filtersUsed: {
    neighborhood: boolean
    propertyType: boolean
    estrato: boolean
  }
  geo: {
    latitude: number
    longitude: number
    radiusMeters: number
  } | null
}

type EstimateSubmittedLike = {
  neighborhood: string
  propertyType: string
  estrato: string
  useGeo: boolean
}

/** Build /explore query params aligned with an estimate result. */
export function buildSimilarListingsSearchParams(
  result: EstimateResultLike,
  submitted: EstimateSubmittedLike,
): URLSearchParams {
  const p = new URLSearchParams()
  p.set("city", result.city)
  p.set("similar", "1")

  if (result.geo) {
    p.set("latitude", String(result.geo.latitude))
    p.set("longitude", String(result.geo.longitude))
    p.set("radiusMeters", String(result.geo.radiusMeters))
  } else if (result.filtersUsed.neighborhood && submitted.neighborhood.trim()) {
    p.set("neighborhood", submitted.neighborhood.trim())
  }

  if (result.filtersUsed.propertyType && submitted.propertyType.trim()) {
    p.set("propertyType", submitted.propertyType.trim())
  }
  if (result.filtersUsed.estrato && submitted.estrato.trim()) {
    p.set("estrato", submitted.estrato.trim())
  }

  const areaSpread = Math.max(Math.round(result.areaM2 * 0.25), 15)
  const minArea = Math.max(MIN_ANALYTICS_AREA_M2, Math.round(result.areaM2 - areaSpread))
  const maxArea = Math.round(result.areaM2 + areaSpread)
  p.set("minAreaM2", String(minArea))
  p.set("maxAreaM2", String(maxArea))

  p.set("minPriceCop", String(Math.round(result.totalCop.low * 0.9)))
  p.set("maxPriceCop", String(Math.round(result.totalCop.high * 1.1)))

  p.set("sortBy", "pricePerM2")

  return p
}

/** Build localized opportunities query params aligned with an estimate result. */
export function buildSimilarOpportunitiesSearchParams(
  result: EstimateResultLike,
  submitted: EstimateSubmittedLike,
): URLSearchParams {
  const p = buildSimilarListingsSearchParams(result, submitted)
  p.delete("sortBy")
  return p
}

export function similarListingsHref(
  result: EstimateResultLike,
  submitted: EstimateSubmittedLike,
): string {
  return `/explore?${buildSimilarListingsSearchParams(result, submitted).toString()}`
}

export function similarOpportunitiesHref(
  result: EstimateResultLike,
  submitted: EstimateSubmittedLike,
  locale: Locale = "es",
): string {
  return opportunitiesPath(
    locale,
    buildSimilarOpportunitiesSearchParams(result, submitted).toString(),
  )
}
