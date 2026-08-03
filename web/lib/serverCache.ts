import { unstable_cache } from "next/cache"

import { getDashboardAggregates } from "@/lib/dashboardAggregates"
import { getDashboardFilters } from "@/lib/dashboardFilters"
import { getDashboardSummary } from "@/lib/dashboardSummary"
import { getFiltersData } from "@/lib/getFiltersData"
import { getHeatmapH3, type HeatmapH3Query } from "@/lib/getHeatmapH3"
import { GOOD_DEAL_DISCOUNT_PCT } from "@/lib/dealCompPool"
import {
  getTopOpportunities,
  type OpportunityQuery,
  type OpportunitiesResult,
} from "@/lib/getTopOpportunities"
import {
  fetchNearbyAmenities,
  roundCoordForCache,
  type NearbyAmenitiesResult,
} from "@/lib/nearbyAmenities"
import { queryMonthlyTrends } from "@/lib/monthlyTrends"
import { getRecentPriceDrops, type PriceDropQuery } from "@/lib/getPriceDrops"
import { getGlobalDataFreshness, normalizeDataFreshness } from "@/lib/getDataFreshness"

const REVALIDATE_SECONDS = 90
const NEARBY_AMENITIES_REVALIDATE = 86400
const OPPORTUNITIES_REVALIDATE = 60
const FILTERS_REVALIDATE = 120
const HEATMAP_REVALIDATE = 120
const PRICE_DROPS_REVALIDATE = 120
const FRESHNESS_REVALIDATE = 300

const opportunityCacheKey = (query: OpportunityQuery): string[] => [
  // v2: type-aware pools + default min discount aligned to good-deal verdict
  "top-opportunities-v2",
  query.city ?? "all",
  query.propertyType ?? "all",
  query.neighborhood ?? "all",
  query.excludeNeighborhoods?.join("|") ?? "",
  query.excludeUnknownNeighborhoods ? "1" : "0",
  query.hideLowConfidence === false ? "0" : "1",
  query.excludeBarter ? "1" : "0",
  query.excludeProjects ? "1" : "0",
  String(query.minDiscountPct ?? GOOD_DEAL_DISCOUNT_PCT),
  query.maxPriceCop?.toString() ?? "none",
  query.minPriceCop?.toString() ?? "none",
  String(query.minAreaM2 ?? ""),
  String(query.maxAreaM2 ?? ""),
  String(query.estrato ?? ""),
  query.conjunto ?? "",
  String(query.latitude ?? ""),
  String(query.longitude ?? ""),
  String(query.radiusMeters ?? ""),
  String(query.page ?? 1),
  String(query.pageSize ?? query.limit ?? 10),
  query.sortBy ?? "dealScore",
]

export const getCachedDashboardSummary = (city: string | null) =>
  unstable_cache(async () => getDashboardSummary(city), [`dashboard-summary`, city ?? "all"], {
    revalidate: REVALIDATE_SECONDS,
  })()

export const getCachedDashboardFilters = (city: string | null) =>
  unstable_cache(async () => getDashboardFilters(city), [`dashboard-filters`, city ?? "all"], {
    revalidate: REVALIDATE_SECONDS,
  })()

export const getCachedFiltersData = (city: string | null) =>
  unstable_cache(async () => getFiltersData(city), [`filters-data`, city ?? "all"], {
    revalidate: FILTERS_REVALIDATE,
  })()

export const getCachedTopOpportunities = (
  query: OpportunityQuery,
): Promise<OpportunitiesResult> =>
  unstable_cache(
    async () => getTopOpportunities(query),
    opportunityCacheKey(query),
    { revalidate: OPPORTUNITIES_REVALIDATE },
  )()

export const getCachedHeatmapH3 = (query: HeatmapH3Query) =>
  unstable_cache(
    async () => getHeatmapH3(query),
    [
      "heatmap-h3",
      query.city,
      query.propertyType ?? "all",
      query.estrato ?? "all",
      query.resolution ?? "default",
    ],
    { revalidate: HEATMAP_REVALIDATE },
  )()

export const getCachedDashboardAggregates = (
  city: string | null,
  estrato: string | null,
  neighborhood: string | null,
) =>
  unstable_cache(
    async () => getDashboardAggregates(city, estrato, neighborhood),
    [
      "dashboard-aggregates",
      city ?? "all",
      estrato ?? "all",
      neighborhood ?? "all",
    ],
    { revalidate: REVALIDATE_SECONDS },
  )()

export const getCachedMonthlyTrends = (params: {
  city: string | null
  neighborhood: string | null
  estrato: string | null
  months: number
}) =>
  unstable_cache(
    async () => queryMonthlyTrends(params),
    [
      "monthly-trends",
      params.city ?? "all",
      params.neighborhood ?? "all",
      params.estrato ?? "all",
      String(params.months),
    ],
    { revalidate: REVALIDATE_SECONDS },
  )()

export const getCachedNearbyAmenities = (
  lat: number,
  lng: number,
  radiusM: number,
): Promise<NearbyAmenitiesResult> => {
  const latKey = String(roundCoordForCache(lat))
  const lngKey = String(roundCoordForCache(lng))
  return unstable_cache(
    async () => {
      const result = await fetchNearbyAmenities(lat, lng, radiusM)
      if (result.unavailable) {
        throw new Error("nearby_amenities_unavailable")
      }
      return result
    },
    ["nearby-amenities", latKey, lngKey, String(radiusM)],
    { revalidate: NEARBY_AMENITIES_REVALIDATE },
  )().catch(() => fetchNearbyAmenities(lat, lng, radiusM))
}

export const getCachedGlobalDataFreshness = () =>
  unstable_cache(
    async () => getGlobalDataFreshness(),
    ["global-data-freshness"],
    { revalidate: FRESHNESS_REVALIDATE },
  )().then(normalizeDataFreshness)

const priceDropCacheKey = (query: PriceDropQuery): string[] => [
  "price-drops",
  query.city ?? "all",
  String(query.limit ?? 30),
  String(query.days ?? 30),
]

export const getCachedRecentPriceDrops = (query: PriceDropQuery) =>
  unstable_cache(
    async () => getRecentPriceDrops(query),
    priceDropCacheKey(query),
    { revalidate: PRICE_DROPS_REVALIDATE },
  )()
