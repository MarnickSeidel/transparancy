import { Prisma } from "@prisma/client"
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
 * Asking-price discounts this deep are more often data errors than bargains:
 * score penalty above PLAUSIBLE, no "high" confidence from LARGE.
 */
export const PLAUSIBLE_DISCOUNT_PCT = 35
export const LARGE_DISCOUNT_PCT = 40
const MAX_PLAUSIBILITY_PENALTY = 15

/**
 * Portals fall back to a city/zone centroid when the address is unknown; a point
 * shared by many listings across several barrios is not a real location.
 */
const PLACEHOLDER_COORD_MIN_LISTINGS = 8
const PLACEHOLDER_COORD_MIN_BARRIOS = 3
const PLACEHOLDER_COORD_DECIMALS = 4

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

const coordKey = (lat: number, lng: number): string =>
  `${lat.toFixed(PLACEHOLDER_COORD_DECIMALS)},${lng.toFixed(PLACEHOLDER_COORD_DECIMALS)}`

/** Rounded lat/lng keys that are portal placeholders in this city. */
export const getPlaceholderCoordKeys = (city: string): Promise<string[]> =>
  unstable_cache(
    async () => {
      const rows = await prisma.$queryRaw<{ lat: number; lng: number }[]>(Prisma.sql`
        SELECT
          ROUND(latitude::numeric, ${PLACEHOLDER_COORD_DECIMALS}::int)::float8 AS lat,
          ROUND(longitude::numeric, ${PLACEHOLDER_COORD_DECIMALS}::int)::float8 AS lng
        FROM listings
        WHERE is_active = true
          AND city = ${city}
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        GROUP BY 1, 2
        HAVING COUNT(*) >= ${PLACEHOLDER_COORD_MIN_LISTINGS}
          AND COUNT(DISTINCT LOWER(TRIM(neighborhood))) >= ${PLACEHOLDER_COORD_MIN_BARRIOS}
      `)
      return rows.map((r) => coordKey(Number(r.lat), Number(r.lng)))
    },
    ["deal-placeholder-coords-v1", city],
    { revalidate: DEAL_COMP_POOL_REVALIDATE_SEC },
  )()

export const hasPlaceholderCoords = (
  listing: Pick<DealListingInput, "latitude" | "longitude">,
  keys: Set<string>,
): boolean =>
  listing.latitude != null &&
  listing.longitude != null &&
  keys.has(coordKey(listing.latitude, listing.longitude))

const withoutCoords = (listing: DealListingInput): DealListingInput => ({
  ...listing,
  latitude: null,
  longitude: null,
})

const strippedPools = new WeakMap<DealListingInput[], DealListingInput[]>()

/** Same pool without placeholder coordinates so geo_1km only uses real points. */
const stripPlaceholderCoords = (
  pool: DealListingInput[],
  keys: Set<string>,
): DealListingInput[] => {
  if (keys.size === 0) return pool
  const cached = strippedPools.get(pool)
  if (cached) return cached
  const stripped = pool.map((l) => (hasPlaceholderCoords(l, keys) ? withoutCoords(l) : l))
  strippedPools.set(pool, stripped)
  return stripped
}

/** Deep discounts and approximate locations lower confidence and score. */
const applyPlausibility = (
  analysis: DealAnalysis,
  approximateLocation: boolean,
): DealAnalysis => {
  const discount = analysis.discountVsRefPct
  const reasons = [...analysis.confidenceReasons]
  if (approximateLocation) reasons.push("approximate_location")
  const largeDiscount =
    discount != null && discount >= LARGE_DISCOUNT_PCT && !reasons.includes("extreme_discount")
  if (largeDiscount) reasons.push("large_discount")

  const confidence =
    analysis.confidence === "high" && (approximateLocation || largeDiscount)
      ? "medium"
      : analysis.confidence

  const penalty =
    discount != null && discount > PLAUSIBLE_DISCOUNT_PCT
      ? Math.min(MAX_PLAUSIBILITY_PENALTY, discount - PLAUSIBLE_DISCOUNT_PCT)
      : 0
  if (penalty === 0 || analysis.breakdown == null || analysis.dealScore == null) {
    return { ...analysis, confidence, confidenceReasons: reasons }
  }
  return {
    ...analysis,
    confidence,
    confidenceReasons: reasons,
    dealScore: Number(Math.max(0, analysis.dealScore - penalty).toFixed(4)),
    breakdown: {
      ...analysis.breakdown,
      priceSanityPenalty: Number(
        (analysis.breakdown.priceSanityPenalty + penalty).toFixed(4),
      ),
    },
  }
}

export type AnalyzeListingDealOptions = {
  priceEvents?: PriceEventInput[]
  /** Opportunities list filter only — do not pass from listing detail. */
  requirePositiveDiscount?: boolean
  /** Prefetched type pool (batch paths). */
  pool?: DealListingInput[]
  /** Prefetched city house floor (batch paths). */
  houseFloor?: number
  /** Prefetched placeholder coordinate keys (batch paths). */
  placeholderCoordKeys?: Set<string>
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
  const keys =
    opts?.placeholderCoordKeys ?? new Set(await getPlaceholderCoordKeys(subject.city))
  const approximateLocation = hasPlaceholderCoords(subject, keys)

  const analysis = analyzeDeal(
    approximateLocation ? withoutCoords(subject) : subject,
    stripPlaceholderCoords(pool, keys),
    {
      priceEvents: opts?.priceEvents,
      minBuiltPpm2ForHouse: houseFloor,
      requirePositiveDiscount: opts?.requirePositiveDiscount,
    },
  )
  return applyPlausibility(analysis, approximateLocation)
}
