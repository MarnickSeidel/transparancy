import { cityNameToSlug } from "@/lib/getCityFromSlug"
import { localePath, localeToolPath, opportunitiesPath, type Locale } from "@/lib/locale"
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods"

export type ListingContext = {
  lang: Locale
  city: string
  neighborhood?: string | null
  propertyType?: string | null
  estrato?: number | null
  areaM2?: number | null
}

function baseParams(ctx: ListingContext): URLSearchParams {
  const p = new URLSearchParams()
  p.set("city", ctx.city)
  if (ctx.neighborhood?.trim()) p.set("neighborhood", ctx.neighborhood.trim())
  if (ctx.propertyType?.trim()) p.set("propertyType", ctx.propertyType.trim())
  if (ctx.estrato != null) p.set("estrato", String(ctx.estrato))
  return p
}

export function buildListingContextLinks(ctx: ListingContext) {
  const exploreP = baseParams(ctx)

  const estimateP = new URLSearchParams()
  estimateP.set("city", ctx.city)
  if (ctx.neighborhood?.trim()) estimateP.set("neighborhood", ctx.neighborhood.trim())
  if (ctx.propertyType?.trim()) estimateP.set("propertyType", ctx.propertyType.trim())
  if (ctx.estrato != null) estimateP.set("estrato", String(ctx.estrato))
  if (ctx.areaM2 != null && ctx.areaM2 > 0) estimateP.set("areaM2", String(ctx.areaM2))

  const heatmapP = new URLSearchParams()
  heatmapP.set("city", ctx.city)
  if (ctx.propertyType?.trim()) heatmapP.set("propertyType", ctx.propertyType.trim())
  if (ctx.estrato != null) heatmapP.set("estrato", String(ctx.estrato))

  const nb = ctx.neighborhood?.trim()
  const zoneHref =
    nb && ctx.city
      ? localePath(
          ctx.lang,
          `/zones/${cityNameToSlug(ctx.city)}/${encodeURIComponent(normalizeNeighborhoodKey(nb))}`,
        )
      : ctx.city
        ? localePath(ctx.lang, `/zones/${cityNameToSlug(ctx.city)}`)
        : null

  return {
    exploreHref: localeToolPath(ctx.lang, "/explore", exploreP.toString()),
    opportunitiesHref: opportunitiesPath(ctx.lang, exploreP.toString()),
    estimateHref: localeToolPath(ctx.lang, "/estimate", estimateP.toString()),
    heatmapHref: localeToolPath(ctx.lang, "/heatmap", heatmapP.toString()),
    zoneHref,
    zonesIndexHref: localePath(ctx.lang, "/zones"),
    analyzeHref: localePath(ctx.lang, "/analyze-url"),
  }
}
