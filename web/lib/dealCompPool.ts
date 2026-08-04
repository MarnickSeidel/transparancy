import type { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"

import { MIN_ANALYTICS_AREA_M2, percentile } from "@/lib/analytics"
import {
  analyzeDeal,
  toDealListingInput,
  type DealAnalysis,
  type DealListingInput,
  type PriceEventInput,
} from "@/lib/dealEngine"
import { prisma } from "@/lib/prisma"

/** City comps for analyzeDeal — cached; neighborhood/geo filter happens in-engine. */
export const DEAL_COMP_POOL_SIZE = 1500
const DEAL_COMP_POOL_REVALIDATE_SEC = 90
const DEFAULT_HOUSE_BUILT_PPM2_FLOOR = 900_000

/**
 * Discount vs reference for "Buena oportunidad" verdict and the opportunities
 * list floor — keep these aligned so list vs detail never disagree on framing.
 */
export const GOOD_DEAL_DISCOUNT_PCT = 12
export const OVERPRICED_DISCOUNT_PCT = -12

/**
 * Lean select for comparable pools.
 * Omit description (multi-KB text) so unstable_cache stays under Next's 2MB limit.
 * Terrain/promo flags on comps are unused; only the subject needs description/paidQuota.
 */
export const dealCompPoolSelect = {
  id: true,
  city: true,
  neighborhood: true,
  zoneName: true,
  propertyType: true,
  constructionState: true,
  estrato: true,
  operationType: true,
  areaM2: true,
  areaBuiltM2: true,
  areaPrivateM2: true,
  areaTerrainM2: true,
  areaTerraceM2: true,
  priceCop: true,
  pricePerM2: true,
  pricePerM2Built: true,
  pricePerM2Private: true,
  pricePerM2Terrain: true,
  priceAdminIncluded: true,
  adminFeeCop: true,
  bedrooms: true,
  bathrooms: true,
  latitude: true,
  longitude: true,
  sourceUpdatedAt: true,
  firstSeenAt: true,
  dataCompletenessScore: true,
  acceptsBarter: true,
  terraceHeavyFlag: true,
  areaMismatchFlag: true,
  isProject: true,
} satisfies Prisma.ListingSelect

/** JSON-safe shape for unstable_cache (BigInt / Date are not JSON-serializable). */
type CacheableDealListing = Omit<
  DealListingInput,
  "priceCop" | "priceAdminIncluded" | "adminFeeCop" | "sourceUpdatedAt" | "firstSeenAt"
> & {
  priceCop: number
  priceAdminIncluded: number | null
  adminFeeCop: number | null
  sourceUpdatedAt: string | null
  firstSeenAt: string | null
}

const toCacheableDealListing = (listing: DealListingInput): CacheableDealListing => ({
  ...listing,
  externalId: undefined,
  description: null,
  paidQuota: null,
  highlight: null,
  priceCop: Number(listing.priceCop),
  priceAdminIncluded:
    listing.priceAdminIncluded == null ? null : Number(listing.priceAdminIncluded),
  adminFeeCop: listing.adminFeeCop == null ? null : Number(listing.adminFeeCop),
  sourceUpdatedAt: listing.sourceUpdatedAt?.toISOString() ?? null,
  firstSeenAt: listing.firstSeenAt?.toISOString() ?? null,
})

const fromCacheableDealListing = (listing: CacheableDealListing): DealListingInput => ({
  ...listing,
  sourceUpdatedAt: listing.sourceUpdatedAt ? new Date(listing.sourceUpdatedAt) : null,
  firstSeenAt: listing.firstSeenAt ? new Date(listing.firstSeenAt) : null,
})

export const poolCacheKeyForPropertyType = (propertyType?: string | null): string => {
  const trimmed = propertyType?.trim()
  return trimmed ? trimmed.toLowerCase() : "all"
}

export const minBuiltPpm2ForHouse = (pool: DealListingInput[]): number => {
  const builtHousePpm2 = pool
    .filter((l) => (l.propertyType ?? "").toLowerCase().includes("casa"))
    .map((l) => l.pricePerM2Built)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
  const p15 = percentile(builtHousePpm2, 0.15)
  return p15 != null
    ? Math.max(DEFAULT_HOUSE_BUILT_PPM2_FLOOR, p15 * 0.75)
    : DEFAULT_HOUSE_BUILT_PPM2_FLOOR
}

const loadDealCompPool = async (
  city: string,
  propertyType?: string | null,
): Promise<DealListingInput[]> => {
  const trimmedType = propertyType?.trim() || null
  const where: Prisma.ListingWhereInput = {
    isActive: true,
    city,
    operationType: { contains: "venta", mode: "insensitive" },
    pricePerM2: { not: null },
    areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
  }
  if (trimmedType) {
    where.propertyType = { equals: trimmedType, mode: "insensitive" }
  }

  const rows = await prisma.listing.findMany({
    where,
    take: DEAL_COMP_POOL_SIZE,
    orderBy: [{ dateScraped: "desc" }],
    select: dealCompPoolSelect,
  })
  return rows.map((r) => toDealListingInput(r))
}

const loadHouseFloorPool = async (city: string): Promise<DealListingInput[]> => {
  const rows = await prisma.listing.findMany({
    where: {
      isActive: true,
      city,
      operationType: { contains: "venta", mode: "insensitive" },
      pricePerM2: { not: null },
      pricePerM2Built: { not: null },
      areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
      propertyType: { contains: "casa", mode: "insensitive" },
    },
    take: DEAL_COMP_POOL_SIZE,
    orderBy: [{ dateScraped: "desc" }],
    select: dealCompPoolSelect,
  })
  return rows.map((r) => toDealListingInput(r))
}

/** Type-aware city comparable pool shared by opportunities + listing detail. */
export const getDealCompPool = (
  city: string,
  propertyType?: string | null,
): Promise<DealListingInput[]> => {
  const typeKey = poolCacheKeyForPropertyType(propertyType)
  return unstable_cache(
    async () => {
      const rows = await loadDealCompPool(city, propertyType)
      return rows.map(toCacheableDealListing)
    },
    // v4: property-type-aware pools (fixes opp vs detail median mismatch)
    ["deal-comp-pool-v4", city, typeKey],
    { revalidate: DEAL_COMP_POOL_REVALIDATE_SEC },
  )().then((rows) => rows.map(fromCacheableDealListing))
}

/** City-calibrated built $/m² floor for house area sanity checks. */
export const getCityHouseFloor = (city: string): Promise<number> =>
  unstable_cache(
    async () => {
      const pool = await loadHouseFloorPool(city)
      return minBuiltPpm2ForHouse(pool)
    },
    ["deal-house-floor-v1", city],
    { revalidate: DEAL_COMP_POOL_REVALIDATE_SEC },
  )()

export type AnalyzeListingDealOptions = {
  priceEvents?: PriceEventInput[]
  /** Opportunities list filter only — do not pass from listing detail. */
  requirePositiveDiscount?: boolean
  /** Prefetched type pool (batch paths). */
  pool?: DealListingInput[]
  /** Prefetched city house floor (batch paths). */
  houseFloor?: number
}

/**
 * Single analyze entry point so opportunities and /anuncio share pool + floor.
 */
export const analyzeListingDeal = async (
  subject: DealListingInput,
  opts?: AnalyzeListingDealOptions,
): Promise<DealAnalysis> => {
  const pool =
    opts?.pool ?? (await getDealCompPool(subject.city, subject.propertyType))
  const houseFloor =
    opts?.houseFloor ?? (await getCityHouseFloor(subject.city))

  return analyzeDeal(subject, pool, {
    priceEvents: opts?.priceEvents,
    minBuiltPpm2ForHouse: houseFloor,
    requirePositiveDiscount: opts?.requirePositiveDiscount,
  })
}
